'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ApiConfig, AppState } from '@/shared/contracts/responses';
import { browserAuth } from '@/frontend/auth/browser-auth';
import { createHttpClient } from '@/frontend/api/http-client';
import { createCommunityClient } from '@/frontend/api/community-client';
import { subscribeToLiveUpdates } from '@/frontend/api/live-updates';
import { syncPageSession, clearPageSession } from '@/frontend/api/page-session';

const maxCachedViews = 8;
const prefetchedStateMaxAge = 3000;

function rememberView(cache: Map<string, AppState>, location: string, state: AppState) {
  cache.delete(location);
  cache.set(location, state);
  while (cache.size > maxCachedViews) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function reuseUnchangedSections(previous: AppState | undefined, result: AppState) {
  if (!previous) return result;
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
}

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
  const [stateLocation, setStateLocation] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const refreshVersion = useRef(0);
  const authVersion = useRef(0);
  const pageToken = useRef<string | undefined>(undefined);
  const inFlight = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const viewCache = useRef(new Map<string, AppState>());
  const viewRequests = useRef(new Map<string, Promise<AppState>>());
  const prefetchedAt = useRef(new Map<string, number>());
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
              authVersion.current++;
              refreshVersion.current++;
              inFlight.current = null;
              pageToken.current = undefined;
              viewCache.current.clear();
              viewRequests.current.clear();
              prefetchedAt.current.clear();
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
            authVersion.current++;
            refreshVersion.current++;
            inFlight.current = null;
            viewCache.current.clear();
            viewRequests.current.clear();
            prefetchedAt.current.clear();
            setSignedIn(false);
            setState(null);
          },
        }),
      ),
    [config],
  );
  const loadView = useCallback(
    (location: string, key: string) => {
      const pending = viewRequests.current.get(location);
      if (pending) return pending;
      const promise = api.state(key).finally(() => {
        if (viewRequests.current.get(location) === promise) viewRequests.current.delete(location);
      });
      viewRequests.current.set(location, promise);
      return promise;
    },
    [api],
  );
  const prefetch = useCallback(
    (destination: string): Promise<void> => {
      if (!signedIn || destination === path) return Promise.resolve();
      const params = new URLSearchParams();
      params.set('view', destination);
      const location = `${destination}?`;
      const prefetchedTime = prefetchedAt.current.get(location);
      if (prefetchedTime !== undefined && Date.now() - prefetchedTime < prefetchedStateMaxAge)
        return Promise.resolve();
      const version = authVersion.current;
      return (async () => {
        const token =
          config?.configured && !config.demo
            ? (await browserAuth.session()).accessToken
            : undefined;
        if (token && token !== pageToken.current) {
          await syncPageSession(token);
          if (version !== authVersion.current) return;
          pageToken.current = token;
        }
        const result = await loadView(location, params.toString());
        if (version !== authVersion.current) return;
        rememberView(
          viewCache.current,
          location,
          reuseUnchangedSections(viewCache.current.get(location), result),
        );
        prefetchedAt.current.set(location, Date.now());
      })();
    },
    [config, loadView, path, signedIn],
  );
  const refresh = useCallback((): Promise<void> => {
    if (!signedIn) return Promise.resolve();
    const location = `${path}?${query}`;
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
          viewCache.current.clear();
          setState(null);
          throw error;
        }
        pageToken.current = token;
      }
      if (version !== refreshVersion.current) return;
      const prefetchedState = viewCache.current.get(location);
      const prefetchedTime = prefetchedAt.current.get(location);
      if (
        prefetchedState &&
        prefetchedTime !== undefined &&
        Date.now() - prefetchedTime < prefetchedStateMaxAge
      ) {
        prefetchedAt.current.delete(location);
        setStateLocation(location);
        setState(prefetchedState);
        setLoadError('');
        return;
      }
      prefetchedAt.current.delete(location);
      let result: AppState;
      try {
        result = await loadView(location, key);
      } catch (error) {
        if (version !== refreshVersion.current) return;
        viewCache.current.clear();
        setState(null);
        setLoadError(error instanceof Error ? error.message : 'Account unavailable.');
        throw error;
      }
      if (version !== refreshVersion.current) return;
      const next = reuseUnchangedSections(viewCache.current.get(location), result);
      rememberView(viewCache.current, location, next);
      setStateLocation(location);
      setState(next);
      setLoadError('');
    })().finally(() => {
      if (inFlight.current?.promise === promise) inFlight.current = null;
    });
    inFlight.current = { key, promise };
    return promise;
  }, [loadView, signedIn, path, query, config]);
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
        prefetchedAt.current.clear();
        refreshVersion.current++;
        inFlight.current = null;
        if (update) {
          const location = `${path}?${query}`;
          const current =
            viewCache.current.get(location) ?? (stateLocation === location ? state : null);
          if (current) {
            const next = update(current, result);
            rememberView(viewCache.current, location, next);
            setStateLocation(location);
            setState(next);
          }
        } else await refresh();
        return result;
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Something went wrong.', true);
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [path, query, refresh, state, stateLocation, toast],
  );
  async function logout() {
    if (config?.demo) {
      toast('Local demo uses a fixed sample account. Turn off LOCAL_DEMO to use authentication.');
      return;
    }
    try {
      await clearPageSession();
      authVersion.current++;
      pageToken.current = undefined;
      await browserAuth.signOut();
    } catch (error) {
      toast((error as Error).message, true);
      return;
    }
    setState(null);
    viewCache.current.clear();
    viewRequests.current.clear();
    prefetchedAt.current.clear();
    setSignedIn(false);
    router.push('/login');
  }
  function onAuthenticated() {
    setSignedIn(true);
    router.push('/');
  }
  const location = `${path}?${query}`;
  const cachedState = viewCache.current.get(location);
  const activeState = cachedState ?? state;
  return {
    config,
    signedIn,
    ready,
    state: activeState,
    screenPending: Boolean(stateLocation && stateLocation !== location && !cachedState),
    loadError,
    busy,
    api,
    refresh,
    mutate,
    prefetch,
    logout,
    onAuthenticated,
  };
}
