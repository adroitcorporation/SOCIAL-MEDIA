'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ApiConfig, AppState } from '@/shared/contracts/responses';
import { browserAuth } from '@/frontend/auth/browser-auth';
import { createHttpClient } from '@/frontend/api/http-client';
import { createCommunityClient } from '@/frontend/api/community-client';
import { subscribeToLiveUpdates } from '@/frontend/api/live-updates';
import { syncPageSession, clearPageSession } from '@/frontend/api/page-session';

const publicApi = createCommunityClient(createHttpClient());
export function useCircleController(
  path: string,
  query: string,
  toast: (text: string, error?: boolean) => void,
) {
  const router = useRouter();
  const [config, setConfig] = useState<ApiConfig | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<AppState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const refreshVersion = useRef(0);
  const pageToken = useRef<string | undefined>(undefined);
  const inFlight = useRef<{ key: string; promise: Promise<void> } | null>(null);
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    publicApi
      .config()
      .then(async (c) => {
        if (!active) return;
        setConfig(c);
        if (c.demo) setSignedIn(true);
        else if (c.configured) {
          const session = await browserAuth.session();
          if (!active) return;
          setSignedIn(session.signedIn);
          unsubscribe = browserAuth.subscribe((session) => {
            if (!active) return;
            setSignedIn(session.signedIn);
            if (!session.signedIn) {
              refreshVersion.current++;
              inFlight.current = null;
              pageToken.current = undefined;
              setState(null);
            }
            if (session.recoveringPassword) router.push('/reset-password');
          });
        }
        if (active) setReady(true);
      })
      .catch(() => {
        if (!active) return;
        setLoadError('Could not reach the server. Please refresh the page.');
        setReady(true);
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [router]);
  const api = useMemo(
    () =>
      createCommunityClient(
        createHttpClient({
          getAccessToken: async () =>
            config?.configured && !config.demo
              ? (await browserAuth.session()).accessToken
              : undefined,
          onUnauthorized: () => {
            refreshVersion.current++;
            inFlight.current = null;
            setSignedIn(false);
            setState(null);
          },
        }),
      ),
    [config],
  );
  const refresh = useCallback((): Promise<void> => {
    if (!signedIn) return Promise.resolve();
    const params = new URLSearchParams(query);
    params.set('view', path);
    const key = params.toString();
    if (inFlight.current?.key === key) return inFlight.current.promise;
    const version = ++refreshVersion.current;
    const promise = (async () => {
      const token =
        config?.configured && !config.demo ? (await browserAuth.session()).accessToken : undefined;
      if (token && token !== pageToken.current) {
        try {
          await syncPageSession(token);
        } catch (error) {
          if (version !== refreshVersion.current) return;
          setState(null);
          throw error;
        }
        pageToken.current = token;
      }
      if (version !== refreshVersion.current) return;
      let result: AppState;
      try {
        result = await api.state(key);
      } catch (error) {
        if (version !== refreshVersion.current) return;
        setState(null);
        setLoadError(error instanceof Error ? error.message : 'Account unavailable.');
        throw error;
      }
      if (version !== refreshVersion.current) return;
      setState((previous) => {
        if (!previous) return result;
        // Keep unchanged sections stable so polling does not retrigger dependent effects.
        const shared = { ...result };
        for (const key of Object.keys(result) as (keyof AppState)[]) {
          if (JSON.stringify(previous[key]) === JSON.stringify(result[key]))
            Object.assign(shared, { [key]: previous[key] });
        }
        return Object.keys(shared).length === Object.keys(previous).length &&
          Object.keys(shared).every(
            (key) => shared[key as keyof AppState] === previous[key as keyof AppState],
          )
          ? previous
          : shared;
      });
      setLoadError('');
    })().finally(() => {
      if (inFlight.current?.promise === promise) inFlight.current = null;
    });
    inFlight.current = { key, promise };
    return promise;
  }, [api, signedIn, path, query, config]);
  refreshRef.current = refresh;
  useEffect(() => {
    if (signedIn) refresh().catch((e) => setLoadError(e.message));
    return () => {
      refreshVersion.current++;
      inFlight.current = null;
    };
  }, [signedIn, refresh, path]);
  useEffect(() => {
    if (!signedIn || !config) return;
    return subscribeToLiveUpdates(api, () => refreshRef.current());
  }, [signedIn, config, api]);
  const mutate = useCallback(
    async <T>(
      operation: () => Promise<T>,
      update?: (state: AppState, result: T) => AppState,
    ): Promise<T> => {
      setBusy(true);
      try {
        const result = await operation();
        refreshVersion.current++;
        inFlight.current = null;
        if (update) setState((current) => (current ? update(current, result) : current));
        else await refresh();
        return result;
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Something went wrong.', true);
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [refresh, toast],
  );
  async function logout() {
    if (config?.demo) {
      toast('Local demo uses a fixed sample account. Turn off LOCAL_DEMO to use authentication.');
      return;
    }
    try {
      await clearPageSession();
      pageToken.current = undefined;
      await browserAuth.signOut();
    } catch (error) {
      toast((error as Error).message, true);
      return;
    }
    setState(null);
    setSignedIn(false);
    router.push('/login');
  }
  function onAuthenticated() {
    setSignedIn(true);
    router.push('/');
  }
  return {
    config,
    signedIn,
    ready,
    state,
    loadError,
    busy,
    api,
    refresh,
    mutate,
    logout,
    onAuthenticated,
  };
}
