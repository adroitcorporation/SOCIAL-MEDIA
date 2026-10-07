'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Home,
  Compass,
  Users,
  Lightbulb,
  CalendarDays,
  MessageCircle,
  Bell,
  Search,
  LogOut,
  Circle,
  Menu,
  X,
  Check,
  ChevronDown,
  ShieldCheck,
} from 'lucide-react';
import { NotificationToasts } from './notification-toasts';
import { ProfileCompletionPrompt } from './profile-completion-prompt';
import { getProfileCompletion } from '@/shared/contracts/profile-completion';
import { ApiError } from '@/frontend/api/http-client';
import { applyConnection } from '@/frontend/state/connection-update';
import { useNotificationToasts } from '@/frontend/hooks/use-notification-toasts';
import { notificationDestination } from '@/frontend/state/notification-tracker';
import { applyNotificationSnapshot } from '@/frontend/state/notification-update';
import { brand } from '@/shared/config/brand';
import { useCircleController } from '@/frontend/hooks/use-circle-controller';
import type { Student } from '@/shared/contracts/responses';
import { CircleContext } from '@/frontend/state/circle-context';
import { profilePath } from '@/frontend/utils/profile-path';
import { Avatar, Loading } from './ui';

const AuthForm = dynamic(
  () => import('@/frontend/features/auth/auth-form').then((module) => module.AuthForm),
  { loading: () => <Loading /> },
);
const nav = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/ideas', label: 'Idea Board', icon: Lightbulb },
  { path: '/discover', label: 'Discover', icon: Compass },
  { path: '/events', label: 'Events', icon: CalendarDays },
  { path: '/connections', label: 'Connections', icon: Users },
  { path: '/messages', label: 'Messages', icon: MessageCircle },
];
export function CircleApp({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const query = useSearchParams().toString();
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [mobile, setMobile] = useState(false);
  const [missingProfileFields, setMissingProfileFields] = useState<string[] | null>(null);
  const connecting = useRef(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const [search, setSearch] = useState('');
  const toast = useCallback((text: string, error = false) => setNotice({ text, error }), []);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(null), 5000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  const {
    config,
    signedIn,
    ready,
    state,
    screenPending,
    loadError,
    busy,
    api,
    refresh,
    mutate,
    prefetch,
    logout,
    onAuthenticated,
  } = useCircleController(path, query, toast);
  const activity = useNotificationToasts(
    signedIn ? state?.me.id : undefined,
    state?.notifications ?? [],
  );
  useEffect(() => setMissingProfileFields(null), [state?.me.id]);
  useEffect(() => {
    if (!mobile) return;
    const previous = document.activeElement as HTMLElement | null;
    const sidebar = sidebarRef.current;
    sidebar?.querySelector<HTMLButtonElement>('.mobile-close')?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobile(false);
        return;
      }
      if (event.key !== 'Tab' || !sidebar) return;
      const focusable = [
        ...sidebar.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input:not(:disabled)',
        ),
      ].filter((node) => node.getClientRects().length > 0);
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, [mobile]);
  const prefetchScreen = useCallback(
    (destination: string) => {
      void prefetch(destination).catch((error: unknown) => {
        console.warn(`Unable to prefetch ${destination}`, error);
      });
    },
    [prefetch],
  );
  const navigate = useCallback(
    (to: string) => {
      setMobile(false);
      router.push(to);
    },
    [router],
  );
  const requestConnection = useCallback(
    async (student: Student, animate?: () => Promise<void>) => {
      if (!state || busy || connecting.current) return false;
      const userId = student.id;
      const incoming = state.connections.some(
        (item) =>
          item.requesterId === userId &&
          item.receiverId === state.me.id &&
          item.status === 'PENDING',
      );
      const completion = getProfileCompletion(state.me);
      if (!incoming && !completion.isComplete) {
        setMissingProfileFields(completion.missingFields);
        return false;
      }
      if (!state.me.collegeVerified) {
        navigate('/profile');
        toast('Verify your college email or ID before sending connection requests.');
        return false;
      }
      connecting.current = true;
      try {
        await mutate(
          async () => {
            const [result] = await Promise.all([api.connections.request({ userId }), animate?.()]);
            return result;
          },
          (current, result) => applyConnection(current, result, student),
        );
        toast(incoming ? 'You’re connected.' : 'Request sent.');
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.code === 'PROFILE_INCOMPLETE')
          setMissingProfileFields(error.missingFields ?? completion.missingFields);
        return false;
      } finally {
        connecting.current = false;
      }
    },
    [state, busy, navigate, toast, mutate, api],
  );
  const contextValue = useMemo(
    () =>
      state
        ? {
            state,
            busy,
            mutate,
            api,
            refresh,
            requestConnection,
            toast,
            viewProfile: (student: Pick<Student, 'id' | 'name'>) => {
              navigate(profilePath(student));
              void api.recommendations.opened(student.id).catch(() => {});
            },
            navigate,
          }
        : null,
    [state, busy, mutate, api, refresh, requestConnection, toast, navigate],
  );
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
          <button className="button secondary" onClick={logout}>
            Sign out
          </button>
        </section>
      </main>
    );
  if (!signedIn || path === '/reset-password')
    return (
      <AuthForm
        key={path}
        configured={Boolean(config?.configured)}
        initialMode={path === '/reset-password' ? 'reset' : path === '/signup' ? 'signup' : 'login'}
        onAuthenticated={onAuthenticated}
      />
    );
  if (!state) return <Loading />;
  const unread = state.notificationUnread ?? state.notifications.filter((n) => !n.readAt).length;
  const messagesUnread = state.conversations.reduce((sum, c) => sum + c.unread, 0);
  const title =
    path === '/moderation/roles'
      ? 'Role management'
      : path === '/moderation'
        ? 'Moderation'
        : path.startsWith('/posts/')
          ? 'Post'
          : path.startsWith('/u/')
            ? 'User profile'
            : path === '/profile'
              ? 'Profile'
              : path === '/notifications'
                ? 'Notifications'
                : nav.find((n) => n.path === path)?.label || 'Home';
  return (
    <CircleContext.Provider value={contextValue}>
      <div className="app-shell">
        <aside ref={sidebarRef} className={`sidebar ${mobile ? 'open' : ''}`}>
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
                onPointerEnter={() => prefetchScreen(item.path)}
                onFocus={() => prefetchScreen(item.path)}
                key={item.path}
                href={item.path}
                className={`nav-link ${path === item.path ? 'active' : ''}`}
              >
                <item.icon size={19} />
                <span>{item.label}</span>
                {item.path === '/messages' && messagesUnread > 0 ? (
                  <b className="nav-count">{messagesUnread}</b>
                ) : null}
              </Link>
            ))}
            {state.isModerator && (
              <Link
                href="/moderation"
                prefetch={false}
                onClick={() => setMobile(false)}
                onPointerEnter={() => prefetchScreen('/moderation')}
                onFocus={() => prefetchScreen('/moderation')}
                className={`nav-link ${path === '/moderation' ? 'active' : ''}`}
              >
                <ShieldCheck size={19} />
                <span>Moderation</span>
              </Link>
            )}
          </nav>

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
                placeholder="Search people"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>↵</kbd>
            </form>
            <div className="topbar-actions">
              <Link
                href="/messages"
                onPointerEnter={() => prefetchScreen('/messages')}
                onFocus={() => prefetchScreen('/messages')}
                className="icon-button message-button"
                aria-label="Messages"
              >
                <MessageCircle size={20} />
                {messagesUnread > 0 && <span />}
              </Link>
              <Link
                href="/notifications"
                onPointerEnter={() => prefetchScreen('/notifications')}
                onFocus={() => prefetchScreen('/notifications')}
                className="icon-button notification-button"
                aria-label={`${unread} unread notifications`}
              >
                <Bell size={20} />
                {unread > 0 && (
                  <span className="notification-count">{unread > 99 ? '99+' : unread}</span>
                )}
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
            {screenPending ? (
              <Loading variant="screen" />
            ) : (
              <div className="screen-transition" key={`${path}?${query}`}>
                {children}
              </div>
            )}
          </main>
        </div>
        <nav className="bottom-nav">
          {nav.slice(0, 5).map((n) => (
            <Link
              key={n.path}
              href={n.path}
              onPointerEnter={() => prefetchScreen(n.path)}
              onFocus={() => prefetchScreen(n.path)}
              className={path === n.path ? 'active' : ''}
            >
              <n.icon size={20} />
              <span>{n.label}</span>
            </Link>
          ))}
          <button onClick={() => setMobile(true)} aria-label="More">
            <Menu size={20} />
            <span>More</span>
          </button>
        </nav>
      </div>
      <NotificationToasts
        items={activity.toasts}
        dismiss={activity.dismiss}
        open={async (item) => {
          try {
            await mutate(() => api.notifications.markRead(item.id), applyNotificationSnapshot);
            activity.dismiss(item.id);
            navigate(notificationDestination(item.href));
          } catch {
            /* The shared mutation handler displays the error and leaves the toast retryable. */
          }
        }}
      />
      {missingProfileFields && (
        <ProfileCompletionPrompt
          missingFields={missingProfileFields}
          close={() => setMissingProfileFields(null)}
          edit={() => {
            setMissingProfileFields(null);
            navigate('/profile?edit=1');
          }}
        />
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
