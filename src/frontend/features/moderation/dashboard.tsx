'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Pagination } from '@/frontend/components/pagination';
import { useCircle } from '@/frontend/state/circle-context';
import type { Dashboard, ModerationUser, ReportItem } from '@/shared/contracts/moderation';
import {
  accountStatuses,
  canAssignRole,
  roleLabels,
  userRoles,
  reportStatuses,
} from '@/shared/contracts/permissions';
import type { AccountStatus, UserRole, ReportStatus } from '@/shared/contracts/permissions';
import { PageHeading } from '@/frontend/components/page-heading';
import { ModerationPage } from './moderation-page';

const metricLabels: Record<keyof Dashboard['metrics'], string> = {
  activeUsers: 'Active users',
  totalEvents: 'Events posted',
  verifiedUsers: 'Verified users',
  unverifiedUsers: 'Unverified users',
  totalReports: 'Reports',
  flaggedUsers: 'Flagged users',
  suspendedUsers: 'Suspended',
  bannedUsers: 'Banned',
  restrictedUsers: 'Restricted',
  deactivatedUsers: 'Deactivated',
};
export function ModerationDashboard() {
  const { api, state } = useCircle();
  const [tab, setTab] = useState('Overview');
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    if (tab === 'Overview') {
      setData(null);
      setError('');
      api.moderation
        .dashboard()
        .then((value) => {
          if (active) setData(value);
        })
        .catch((err) => {
          if (active) setError(err.message);
        });
    }
    return () => {
      active = false;
    };
  }, [api, tab]);
  return (
    <>
      <PageHeading
        eyebrow={roleLabels[state.me.role]}
        title="Moderation dashboard"
        description="Review reports, protect the community, and keep track of moderation decisions."
      />
      <div className="category-chips">
        {['Overview', 'Reports', 'Accounts', 'Verification'].map((item) => (
          <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
        {canAssignRole(state.me, 'STUDENT') && (
          <Link className="button secondary" href="/moderation/roles" prefetch={false}>
            Manage roles
          </Link>
        )}
      </div>
      {tab === 'Verification' ? (
        <ModerationPage />
      ) : tab === 'Reports' ? (
        <ReportsQueue />
      ) : tab === 'Accounts' ? (
        <UserManagement />
      ) : error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : !data ? (
        <p role="status">Loading dashboard…</p>
      ) : (
        <>
          <div className="moderation-metrics">
            {Object.entries(data.metrics).map(([key, value]) => (
              <section className="panel metric-card" key={key}>
                <span className="muted">{metricLabels[key as keyof Dashboard['metrics']]}</span>
                <strong>{value}</strong>
              </section>
            ))}
          </div>
          <div className="moderation-columns">
            <section className="panel moderation-section">
              <h2>Recent events</h2>
              {!data.recentEvents.length && <p className="muted">No events posted yet.</p>}
              {data.recentEvents.map((event) => (
                <p key={event.id}>
                  <strong>{event.title}</strong>
                  <br />
                  <span className="muted">
                    {event.organizer} · {new Date(event.createdAt).toLocaleDateString()}
                  </span>
                </p>
              ))}
            </section>
            <section className="panel moderation-section">
              <h2>Recent reports</h2>
              {!data.recentReports.length && <p className="muted">No reports submitted.</p>}
              {data.recentReports.map((report) => (
                <p key={report.id}>
                  <strong>{report.target.name}</strong> <span className="tag">{report.status}</span>
                  <br />
                  {report.reason}
                </p>
              ))}
            </section>
            <section className="panel moderation-section">
              <h2>Recent verification requests</h2>
              {!data.recentVerifications.length && (
                <p className="muted">No verification requests.</p>
              )}
              {data.recentVerifications.map((item) => (
                <p key={item.id}>
                  {item.user.name} <span className="tag">{item.status}</span>
                </p>
              ))}
            </section>
            <section className="panel moderation-section">
              <h2>Moderation activity summary</h2>
              {!data.activitySummary.length && <p className="muted">No moderation activity yet.</p>}
              {data.activitySummary.map((item) => (
                <p key={item.action}>
                  {item.action.replaceAll('_', ' ')} <strong>{item.count}</strong>
                </p>
              ))}
            </section>
          </div>
          <section className="panel moderation-section">
            <h2>Recent activity</h2>
            <p className="muted">Latest 50 actions</p>
            {!data.activity.length && <p>No actions recorded.</p>}
            {data.activity.map((item) => (
              <article className="audit-row" key={item.id}>
                <strong>{item.actor.name}</strong> · {item.action.replaceAll('_', ' ')}
                <p>{item.reason}</p>
                <small className="muted">
                  {item.targetId} · {new Date(item.createdAt).toLocaleString()}
                </small>
              </article>
            ))}
          </section>
        </>
      )}
    </>
  );
}

function UserEditor({
  user,
  rolesOnly,
  onSaved,
}: {
  user: ModerationUser;
  rolesOnly: boolean;
  onSaved: () => void;
}) {
  const { api, mutate, busy, state, toast } = useCircle();
  const [role, setRole] = useState<UserRole>(user.role);
  const [status, setStatus] = useState<AccountStatus>(user.accountStatus);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const protectedUser =
    state.me.role !== 'ULTIMATE_MODERATOR' && user.role === 'ULTIMATE_MODERATOR';
  return (
    <form
      className="panel moderation-item"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          await mutate(() =>
            rolesOnly
              ? api.moderation.changeRole(user.id, role, reason)
              : api.moderation.changeStatus(user.id, status, reason),
          );
          toast(rolesOnly ? 'Role updated.' : 'Account status updated.');
          setReason('');
          onSaved();
        } catch {
        } finally {
          setSaving(false);
        }
      }}
    >
      <h3>{user.name}</h3>
      <small className="muted">{user.id}</small>
      <p>
        <span className="tag">{roleLabels[user.role]}</span>{' '}
        <span className="tag">{user.accountStatus}</span>{' '}
        <span className="tag">{user.collegeVerified ? 'Verified' : 'Unverified'}</span>
      </p>
      {protectedUser ? (
        <p className="muted">Only an Ultimate Moderator can change this account.</p>
      ) : (
        <>
          <label>
            {rolesOnly ? 'Assign role' : 'Account status'}
            {rolesOnly ? (
              <select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
                {userRoles.map((value) => (
                  <option key={value} value={value}>
                    {roleLabels[value]}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as AccountStatus)}
              >
                {accountStatuses.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            )}
          </label>
          <label>
            Reason
            <input
              required
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <button
            className="button primary"
            disabled={
              saving || busy || (rolesOnly ? role === user.role : status === user.accountStatus)
            }
          >
            {saving ? 'Saving…' : rolesOnly ? 'Save role' : 'Save status'}
          </button>
        </>
      )}
    </form>
  );
}
export function UserManagement({ rolesOnly = false }: { rolesOnly?: boolean }) {
  const { api } = useCircle();
  const [users, setUsers] = useState<ModerationUser[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const timer = setTimeout(() => {
      api.moderation
        .users(
          new URLSearchParams({
            page: String(page),
            search,
            ...(status ? { status } : {}),
          }).toString(),
          rolesOnly,
        )
        .then((value) => {
          if (active) setUsers(value);
        })
        .catch((err) => {
          if (active) setError(err.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [api, search, status, rolesOnly, revision, page]);
  return (
    <>
      {rolesOnly && (
        <PageHeading
          eyebrow="ULTIMATE MODERATOR"
          title="Role management"
          description="Select a user and record a reason for their new role. Current roles are shown on each account."
        />
      )}
      {rolesOnly && (
        <Link className="text-link" href="/moderation" prefetch={false}>
          Back to dashboard
        </Link>
      )}
      <div className="filter-panel filter-top">
        <label>
          Search users
          <input
            placeholder="Name or exact user ID"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label>
          Filter account status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All statuses</option>
            {accountStatuses.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted">100 accounts per page. Search by name or exact user ID.</p>
      {loading ? (
        <p role="status">Loading accounts…</p>
      ) : error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : !users.length ? (
        <section className="panel empty">No matching users.</section>
      ) : (
        <div className="moderation-columns">
          {users.map((user) => (
            <UserEditor
              key={`${user.id}:${user.role}:${user.accountStatus}`}
              user={user}
              rolesOnly={rolesOnly}
              onSaved={() => setRevision((value) => value + 1)}
            />
          ))}
        </div>
      )}
      <Pagination page={page} setPage={setPage} count={users.length} loading={loading} />
    </>
  );
}

function ReportReview({ report, onSaved }: { report: ReportItem; onSaved: () => void }) {
  const { api, mutate, busy } = useCircle();
  const [status, setStatus] = useState<ReportStatus>('REVIEWED');
  const [note, setNote] = useState('');
  return (
    <form
      className="panel moderation-item"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await mutate(() => api.moderation.reviewReport(report.id, status, note));
          onSaved();
        } catch {}
      }}
    >
      <h3>
        {report.target.name} <span className="tag">{report.status}</span>
      </h3>
      <p className="muted">
        Reported by {report.reporter.name} · {new Date(report.createdAt).toLocaleString()}
      </p>
      <p>{report.reason}</p>
      {report.reviewNote && <p>Last review: {report.reviewNote}</p>}
      <label>
        Report decision
        <select value={status} onChange={(e) => setStatus(e.target.value as ReportStatus)}>
          {reportStatuses
            .filter((value) => value !== 'OPEN')
            .map((value) => (
              <option key={value}>{value}</option>
            ))}
        </select>
      </label>
      <label>
        Review reason
        <textarea
          required
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <button className="button primary" disabled={busy}>
        Save decision
      </button>
    </form>
  );
}
function ReportsQueue() {
  const { api } = useCircle();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [status, setStatus] = useState('OPEN');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const timer = setTimeout(
      () =>
        api.moderation
          .reports(
            new URLSearchParams({
              page: String(page),
              search,
              ...(status ? { status } : {}),
            }).toString(),
          )
          .then((value) => {
            if (active) setReports(value);
          })
          .catch((err) => {
            if (active) setError(err.message);
          })
          .finally(() => {
            if (active) setLoading(false);
          }),
      250,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [api, status, search, revision, page]);
  return (
    <>
      <div className="filter-panel filter-top">
        <label>
          Search reports
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="User name or complaint"
          />
        </label>
        <label>
          Report status
          <select
            aria-label="Report status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All reports</option>
            {reportStatuses.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted">100 reports per page.</p>
      {loading ? (
        <p role="status">Loading reports…</p>
      ) : error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : !reports.length ? (
        <section className="panel empty">No reports match these filters.</section>
      ) : (
        <div className="moderation-list">
          {reports.map((report) => (
            <ReportReview
              key={`${report.id}:${report.reviewedAt}`}
              report={report}
              onSaved={() => setRevision((value) => value + 1)}
            />
          ))}
        </div>
      )}
      <Pagination page={page} setPage={setPage} count={reports.length} loading={loading} />
    </>
  );
}
