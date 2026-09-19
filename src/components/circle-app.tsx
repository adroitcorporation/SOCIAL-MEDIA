'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Home,
  Compass,
  Users,
  Lightbulb,
  CalendarDays,
  MessageCircle,
  Bell,
  UserRound,
  ArrowUpRight,
  Search,
  LogOut,
  Circle,
  Menu,
  X,
  Check,
  Sprout,
  ChevronDown,
} from 'lucide-react';
import { brand } from '@/lib/brand';
import { authClient } from '@/lib/supabase';
import type { AppState, Student } from '@/lib/types';
import { CircleContext } from './circle-context';
import { AuthForm } from './auth-form';
import { Avatar, Loading, Modal } from './ui';
import { ProfileDetails, ProfileForm } from './profile-form';
import {
  HomePage,
  DiscoverPage,
  ConnectionsPage,
  ProfilePage,
  NotificationsPage,
  EventsPage,
} from './pages';
import { IdeasPage } from './ideas';
import { MessagesPage } from './messages';

const nav = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/discover', label: 'Discover', icon: Compass },
  { path: '/connections', label: 'Connections', icon: Users },
  { path: '/ideas', label: 'IdeaBoard', icon: Lightbulb },
  { path: '/events', label: 'Events', icon: CalendarDays },
  { path: '/messages', label: 'Messages', icon: MessageCircle },
  { path: '/notifications', label: 'Notifications', icon: Bell },
  { path: '/profile', label: 'Profile', icon: UserRound },
];
export function CircleApp() {
  const path = usePathname();
  const router = useRouter();
  const query = useSearchParams().toString();
  const [config, setConfig] = useState<{ demo: boolean; configured: boolean } | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<AppState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [profile, setProfile] = useState<Student | null>(null);
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState('');
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const streamTick = useRef(0);
  const refreshVersion = useRef(0);
  const toast = useCallback((text: string, error = false) => setNotice({ text, error }), []);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(null), 5000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    fetch('/api/config')
      .then((r) => r.json())
      .then(async (c) => {
        if (!active) return;
        setConfig(c);
        if (c.demo) setSignedIn(true);
        else if (c.configured) {
          const auth = authClient().auth;
          const { data } = await auth.getSession();
          if (active) setSignedIn(Boolean(data.session));
          const { data: subscription } = auth.onAuthStateChange((event, session) => {
            setSignedIn(Boolean(session));
            if (!session) setState(null);
            if (event === 'PASSWORD_RECOVERY') router.push('/reset-password');
          });
          unsubscribe = () => subscription.subscription.unsubscribe();
        }
        if (active) setReady(true);
      })
      .catch(() => {
        setLoadError('Could not reach the server. Please refresh the page.');
        setReady(true);
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [router]);
  const api = useCallback(
    async <T,>(endpoint: string, body?: unknown, method = 'POST'): Promise<T> => {
      const headers: Record<string, string> = {};
      if (config?.configured && !config.demo) {
        const { data } = await authClient().auth.getSession();
        if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
      }
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const response = await fetch(`/api/${endpoint}`, {
        method: body === undefined ? 'GET' : method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          setSignedIn(false);
          setState(null);
        }
        throw new Error(result.error || 'Unable to complete this action.');
      }
      return result as T;
    },
    [config],
  );
  const refresh = useCallback(async () => {
    if (!signedIn) return;
    const version = ++refreshVersion.current;
    const params = path === '/discover' && query ? `?${query}` : '';
    const result = await api<AppState>(`state${params}`);
    if (version !== refreshVersion.current) return;
    setState(result);
    setLoadError('');
  }, [api, signedIn, path, query]);
  refreshRef.current = refresh;
  useEffect(() => {
    if (signedIn) refresh().catch((e) => setLoadError(e.message));
  }, [signedIn, refresh, path]);
  useEffect(() => {
    if (!signedIn || !config) return;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout>;
    const connect = async () => {
      try {
        const headers: Record<string, string> = {};
        if (!config.demo) {
          const { data } = await authClient().auth.getSession();
          if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
        }
        const response = await fetch('/api/live', { headers, signal: controller.signal });
        if (!response.ok || !response.body) throw new Error('Live connection unavailable');
        const reader = response.body.getReader();
        while (!controller.signal.aborted) {
          const { done } = await reader.read();
          if (done) break;
          if (document.visibilityState === 'visible' && Date.now() - streamTick.current > 2000) {
            streamTick.current = Date.now();
            await refreshRef.current();
            window.dispatchEvent(new Event('circle-refresh'));
          }
        }
      } catch {
        /* reconnect with refreshed credentials; all writes report errors separately */
      }
      if (!controller.signal.aborted) timeout = setTimeout(connect, 3000);
    };
    void connect();
    const focus = () => {
      refreshRef.current().catch(() => {});
      window.dispatchEvent(new Event('circle-refresh'));
    };
    window.addEventListener('focus', focus);
    return () => {
      controller.abort();
      clearTimeout(timeout);
      window.removeEventListener('focus', focus);
    };
  }, [signedIn, config]);
  const mutate = useCallback(
    async <T,>(endpoint: string, body: unknown = {}, method = 'POST'): Promise<T> => {
      setBusy(true);
      try {
        const result = await api<T>(endpoint, body, method);
        await refresh();
        return result;
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Something went wrong.', true);
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [api, refresh, toast],
  );
  const navigate = (to: string) => {
    setMobile(false);
    router.push(to);
  };
  async function logout() {
    if (config?.demo) {
      toast('Local demo uses a fixed sample account. Turn off LOCAL_DEMO to use authentication.');
      return;
    }
    const { error } = await authClient().auth.signOut();
    if (error) {
      toast(error.message, true);
      return;
    }
    setState(null);
    setSignedIn(false);
    router.push('/login');
  }
  if (!ready) return <Loading />;
  if (loadError && !state)
    return (
      <main className="auth-page">
        <section className="panel">
          <h2>We couldn’t load your circle.</h2>
          <p className="error">{loadError}</p>
          <button className="button primary" onClick={() => location.reload()}>
            Try again
          </button>
        </section>
      </main>
    );
  if (!signedIn || path === '/reset-password')
    return (
      <AuthForm
        configured={Boolean(config?.configured)}
        initialMode={path === '/reset-password' ? 'reset' : path === '/signup' ? 'signup' : 'login'}
        onAuthenticated={() => {
          setSignedIn(true);
          router.push('/');
        }}
      />
    );
  if (!state) return <Loading />;
  if (!state.me.onboarded)
    return (
      <main className="onboarding">
        <div className="wordmark">
          <span className="brand-mark">
            <Circle />
          </span>
          {brand.name}
        </div>
        <h1>Make yourself at home.</h1>
        <p>Let’s introduce you to your future collaborators.</p>
        <section className="panel">
          <ProfileForm
            user={state.me}
            save={async (body) => {
              await mutate('profile', body, 'PATCH');
              toast('Your profile is ready. Welcome to the circle!');
            }}
          />
        </section>
      </main>
    );
  const unread = state.notifications.filter((n) => !n.readAt).length;
  const messagesUnread = state.conversations.reduce((sum, c) => sum + c.unread, 0);
  const title = nav.find((n) => n.path === path)?.label || 'Home';
  return (
    <CircleContext.Provider
      value={{ state, busy, mutate, api, refresh, toast, viewProfile: setProfile, navigate }}
    >
      <div className="app-shell">
        <aside className={`sidebar ${mobile ? 'open' : ''}`}>
          <Link href="/" className="wordmark">
            <span className="brand-mark">
              <Circle size={22} />
            </span>
            <span>{brand.name}</span>
          </Link>
          <button
            className="mobile-close icon-button"
            aria-label="Close menu"
            onClick={() => setMobile(false)}
          >
            <X />
          </button>
          <div className="workspace-label">YOUR COMMUNITY</div>
          <nav>
            {nav.map((item) => (
              <Link
                onClick={() => setMobile(false)}
                key={item.path}
                href={item.path}
                className={`nav-link ${path === item.path ? 'active' : ''}`}
              >
                <item.icon size={19} />
                <span>{item.label}</span>
                {item.path === '/messages' && messagesUnread > 0 ? (
                  <b className="nav-count">{messagesUnread}</b>
                ) : item.path === '/notifications' && unread > 0 ? (
                  <b className="nav-count">{unread}</b>
                ) : null}
              </Link>
            ))}
          </nav>
          <div className="sidebar-note">
            <Sprout size={26} />
            <h4>
              Great things grow
              <br />
              in good company.
            </h4>
            <p>
              Your next big thing starts
              <br />
              with a small hello.
            </p>
            <Link href="/discover">
              Find your people <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="sidebar-user">
            <button onClick={() => navigate('/profile')}>
              <Avatar user={state.me} size="small" />
              <span>
                <strong>{state.me.name}</strong>
                <small>{state.me.college}</small>
              </span>
            </button>
            <button className="icon-button" onClick={logout} aria-label="Log out">
              <LogOut size={16} />
            </button>
          </div>
        </aside>
        {mobile && <div className="mobile-overlay" onClick={() => setMobile(false)} />}
        <div className="main-shell">
          <header className="topbar">
            <div className="topbar-left">
              <button
                className="mobile-menu icon-button"
                onClick={() => setMobile(true)}
                aria-label="Open navigation"
              >
                <Menu size={22} />
              </button>
              <span className="breadcrumb">
                Your space <span>/</span> <strong>{title}</strong>
              </span>
            </div>
            <form
              className="global-search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(`/discover?search=${encodeURIComponent(search)}`);
              }}
            >
              <Search size={17} />
              <input
                aria-label="Search students"
                placeholder="Find people, find possibilities…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>↵</kbd>
            </form>
            <div className="topbar-actions">
              <Link
                href="/notifications"
                className="icon-button notification-button"
                aria-label={`${unread} unread notifications`}
              >
                <Bell size={20} />
                {unread > 0 && <span />}
              </Link>
              <button className="topbar-profile" onClick={() => navigate('/profile')}>
                <Avatar user={state.me} size="small" />
                <ChevronDown size={15} />
              </button>
            </div>
          </header>
          {config?.demo && (
            <div className="demo-strip">
              LOCAL DEMO · Sample students and events · Changes are saved to your local database
            </div>
          )}
          <main className={`page-content ${path === '/messages' ? 'message-page' : ''}`}>
            {path === '/discover' ? (
              <DiscoverPage />
            ) : path === '/connections' ? (
              <ConnectionsPage />
            ) : path === '/ideas' ? (
              <IdeasPage />
            ) : path === '/events' ? (
              <EventsPage />
            ) : path === '/messages' ? (
              <MessagesPage />
            ) : path === '/notifications' ? (
              <NotificationsPage />
            ) : path === '/profile' ? (
              <ProfilePage />
            ) : (
              <HomePage />
            )}
          </main>
          <footer className="footer">
            <span>Made for the ones who make things happen.</span>
            <span>
              {brand.name} <span className="footer-dot">✳</span>
            </span>
          </footer>
        </div>
        <nav className="bottom-nav">
          {nav
            .filter((n) => ['/', '/discover', '/ideas', '/messages'].includes(n.path))
            .map((n) => (
              <Link key={n.path} href={n.path} className={path === n.path ? 'active' : ''}>
                <n.icon size={20} />
                <span>{n.label}</span>
              </Link>
            ))}
          <button onClick={() => setMobile(true)}>
            <Menu size={20} />
            <span>More</span>
          </button>
        </nav>
      </div>
      {profile && (
        <Modal title="Meet your next collaborator" onClose={() => setProfile(null)}>
          <ProfileDetails user={profile} />
          {profile.id !== state.me.id && (
            <button
              className="text-link danger"
              onClick={async () => {
                try {
                  await mutate(`blocks/${profile.id}`);
                  setProfile(null);
                  toast('Student blocked. You can undo this from your profile.');
                } catch {}
              }}
            >
              Block student
            </button>
          )}
        </Modal>
      )}
      {notice && (
        <div
          className={`toast ${notice.error ? 'toast-error' : ''}`}
          role={notice.error ? 'alert' : 'status'}
        >
          {notice.error ? <X size={18} /> : <Check size={18} />}
          {notice.text}
          <button aria-label="Dismiss notification" onClick={() => setNotice(null)}>
            <X size={16} />
          </button>
        </div>
      )}
    </CircleContext.Provider>
  );
}
