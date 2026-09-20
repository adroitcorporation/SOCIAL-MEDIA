'use client';
import { useCallback, useEffect, useState } from 'react';
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
import { brand } from '@/shared/config/brand';
import { useCircleController } from '@/frontend/hooks/use-circle-controller';
import type { Student } from '@/shared/contracts/responses';
import { CircleContext } from '@/frontend/state/circle-context';
import { AuthForm } from '@/frontend/features/auth/auth-form';
import { Avatar, Loading, Modal } from './ui';
import { ProfileDetails, ProfileForm } from '@/frontend/features/profile/profile-form';
import {
  HomePage,
  DiscoverPage,
  ConnectionsPage,
  ProfilePage,
  NotificationsPage,
  EventsPage,
} from '@/frontend/pages/community-pages';
import { IdeasPage } from '@/frontend/features/ideas/ideas-page';
import { MessagesPage } from '@/frontend/features/messages/messages-page';

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
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [profile, setProfile] = useState<Student | null>(null);
  const [mobile, setMobile] = useState(false);
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
    loadError,
    busy,
    api,
    refresh,
    mutate,
    logout,
    onAuthenticated,
  } = useCircleController(path, query, toast);
  const navigate = (to: string) => {
    setMobile(false);
    router.push(to);
  };
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
        onAuthenticated={onAuthenticated}
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
              await mutate(() => api.profiles.update(body));
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
                  await mutate(() => api.blocks.add(profile.id));
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
