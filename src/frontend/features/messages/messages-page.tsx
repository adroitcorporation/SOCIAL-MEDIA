'use client';
import { relative } from '@/frontend/utils/date';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Plus,
  Search,
  Send,
  Users,
  Settings2,
  ArrowLeft,
  MessageCircle,
  CheckCheck,
} from 'lucide-react';
import type { ChatMessage, ConversationItem, Student } from '@/shared/contracts/responses';
import type { GroupAction } from '@/shared/contracts/enums';
import { useCircle } from '@/frontend/state/circle-context';
import { Avatar, Empty, Modal } from '@/frontend/components/ui';
import { PageHeading } from '@/frontend/components/page-heading';
export function MessagesPage() {
  const { state, api, mutate, toast } = useCircle();
  const [create, setCreate] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [manage, setManage] = useState(false);
  const [error, setError] = useState('');
  const [hasOlder, setHasOlder] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const retryMessage = useRef<{ body: string; clientId: string } | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if (p.get('create') === 'group') setCreate(true);
    if (p.get('conversation')) setSelected(p.get('conversation'));
  }, []);
  const loadMessages = useCallback(async () => {
    if (!selected) return;
    try {
      const result = await api.conversations.messages(selected);
      if (selectedRef.current !== selected) return;
      setMessages((previous) => {
        if (!result.length) return [];
        const older = previous.filter((m) => m.createdAt < result[0].createdAt);
        return [...older, ...result];
      });
      setHasOlder(result.length === 50);
      setError('');
    } catch (e) {
      if (selectedRef.current === selected) {
        setMessages([]);
        setError((e as Error).message);
      }
    }
  }, [selected, api]);
  useEffect(() => {
    setMessages([]);
    retryMessage.current = null;
    setError('');
    void loadMessages();
    window.addEventListener('circle-refresh', loadMessages);
    return () => window.removeEventListener('circle-refresh', loadMessages);
  }, [loadMessages]);
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages.length, selected]);
  const conversation = state.conversations.find((c) => c.id === selected);
  useEffect(() => {
    if (selected && !conversation) {
      setMessages([]);
      setManage(false);
    }
  }, [selected, conversation]);
  const name = (c: ConversationItem) =>
    c.type === 'GROUP'
      ? c.name || 'Collaboration group'
      : c.members.find((m) => m.userId !== state.me.id)?.user.name || 'Conversation';
  function select(id: string) {
    setSelected(id);
    history.replaceState(null, '', `/messages?conversation=${id}`);
  }
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim() || !selected || sending) return;
    setSending(true);
    const payload =
      retryMessage.current?.body === text.trim()
        ? retryMessage.current
        : { body: text.trim(), clientId: crypto.randomUUID() };
    retryMessage.current = payload;
    try {
      await mutate(() => api.conversations.send(selected, payload));
      setText('');
      retryMessage.current = null;
      await loadMessages();
    } catch {
    } finally {
      setSending(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="WHERE THE GOOD STUFF BEGINS"
        title="Keep the conversation going."
        description="A hello today. Something great tomorrow."
      >
        <button className="button primary" onClick={() => setCreate(true)}>
          <Plus size={17} />
          Create Group
        </button>
      </PageHeading>
      <div className={`chat-layout ${selected ? 'has-selection' : ''}`}>
        <aside className="conversation-sidebar">
          <div className="chat-search search-field">
            <Search size={17} />
            <input
              aria-label="Search conversations"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations"
            />
          </div>
          <div className="conversation-list">
            {state.conversations
              .filter((c) => name(c).toLowerCase().includes(search.toLowerCase()))
              .map((c) => {
                const other = c.members.find((m) => m.userId !== state.me.id)?.user;
                return (
                  <button
                    className={`conversation-row ${c.id === selected ? 'selected' : ''}`}
                    key={c.id}
                    onClick={() => select(c.id)}
                  >
                    {c.type === 'GROUP' ? (
                      <Avatar user={{ name: c.name || 'Group', photo: c.image || '' }} />
                    ) : other ? (
                      <Avatar user={other} />
                    ) : (
                      <MessageCircle size={22} />
                    )}
                    <span className="conversation-summary">
                      <strong>{name(c)}</strong>
                      <small>
                        {c.messages[0]?.body ||
                          (c.type === 'GROUP'
                            ? `${c.members.length} members · Say hello`
                            : 'Start the conversation')}
                      </small>
                    </span>
                    <span className="conversation-time">
                      <small>{relative(c.updatedAt)}</small>
                      {c.unread > 0 && <b>{c.unread}</b>}
                    </span>
                  </button>
                );
              })}
            {!state.conversations.length && (
              <Empty
                title="Say your first hello."
                body="Message a connection or bring a few people together in a group."
              />
            )}
          </div>
        </aside>
        <section className="chat-main">
          {conversation ? (
            <>
              <header className="chat-header">
                <button
                  className="icon-button chat-back"
                  aria-label="Back to conversations"
                  onClick={() => setSelected(null)}
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h2>{name(conversation)}</h2>
                  <p>
                    {conversation.type === 'GROUP'
                      ? `${conversation.members.length} members · ${conversation.ideaId ? 'Idea collaboration' : 'Group conversation'}`
                      : 'Your connection · Private conversation'}
                  </p>
                </div>
                {conversation.type === 'GROUP' && (
                  <button className="button secondary small" onClick={() => setManage(true)}>
                    <Settings2 size={16} />
                    Members
                  </button>
                )}
              </header>
              <div className="message-scroll" ref={scroll}>
                {hasOlder && messages.length > 0 && (
                  <button
                    className="text-link load-older"
                    onClick={async () => {
                      try {
                        const older = await api.conversations.messages(
                          conversation.id,
                          messages[0].id,
                        );
                        setMessages([...older, ...messages]);
                        setHasOlder(older.length === 50);
                      } catch (e) {
                        toast((e as Error).message, true);
                      }
                    }}
                  >
                    Load older messages
                  </button>
                )}
                {error && <p className="error">{error}</p>}
                {!messages.length && !error && (
                  <Empty
                    title="This could be the start of something."
                    body="Introduce yourself, share an idea, or just say hello."
                  />
                )}
                {messages.map((m, i) => (
                  <div key={m.id} className={`message ${m.senderId === state.me.id ? 'mine' : ''}`}>
                    {m.senderId !== state.me.id && <Avatar user={m.sender} size="small" />}
                    <div>
                      {conversation.type === 'GROUP' && m.senderId !== state.me.id && (
                        <strong className="message-sender">{m.sender.name}</strong>
                      )}
                      <p>{m.body}</p>
                      <small>
                        {new Date(m.createdAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {m.senderId === state.me.id && <CheckCheck size={12} aria-label="Sent" />}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
              <form className="message-compose" onSubmit={send}>
                <input
                  aria-label="Message"
                  placeholder="A little hello goes a long way…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={4000}
                  disabled={Boolean(error)}
                />
                <button
                  className="button primary"
                  aria-label="Send message"
                  disabled={!text.trim() || sending || Boolean(error)}
                >
                  <Send size={18} />
                </button>
              </form>
            </>
          ) : (
            <Empty
              title={
                selected
                  ? 'This conversation is unavailable.'
                  : 'Good conversations make great things.'
              }
              body={
                selected
                  ? 'You may have been removed from the group, or it may have been deleted.'
                  : 'Choose a conversation, or get your people together in a new group.'
              }
            >
              <button className="button primary" onClick={() => setCreate(true)}>
                <Users size={16} />
                Create a group
              </button>
            </Empty>
          )}
        </section>
      </div>
      {create && (
        <CreateGroup
          onClose={() => setCreate(false)}
          onCreated={(id) => {
            setCreate(false);
            select(id);
          }}
        />
      )}
      {manage && conversation && (
        <ManageGroup
          conversation={conversation}
          onClose={() => setManage(false)}
          onExit={() => {
            setManage(false);
            setSelected(null);
          }}
        />
      )}
    </>
  );
}
function CreateGroup({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { api, state, mutate, busy } = useCircle();
  const [ids, setIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const connections = state.connections
    .filter((c) => c.status === 'ACCEPTED')
    .map((c) => (c.requesterId === state.me.id ? c.receiver : c.requester));
  return (
    <Modal title="Bring your people together." onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          try {
            const group = await mutate(() =>
              api.conversations.create({
                type: 'GROUP',
                name: String(new FormData(e.currentTarget).get('name')),
                memberIds: ids,
              }),
            );
            onCreated(group.id);
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <label>
          Group name
          <input
            name="name"
            placeholder="Give your next great thing a name"
            required
            maxLength={80}
          />
        </label>
        <label>
          Add your connections <span className="muted">({ids.length} selected)</span>
          <input
            placeholder="Search your connections…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <p className="muted">Choose at least one accepted connection. You’ll be the group owner.</p>
        <div className="person-picker">
          {connections
            .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
            .map((user) => (
              <label className="select-person" key={user.id}>
                <input
                  type="checkbox"
                  checked={ids.includes(user.id)}
                  onChange={(e) =>
                    setIds(
                      e.target.checked ? [...ids, user.id] : ids.filter((id) => id !== user.id),
                    )
                  }
                />
                <Avatar user={user} size="small" />
                <span className="person-label">
                  <strong>{user.name}</strong>
                  <small>{user.college}</small>
                </span>
              </label>
            ))}
        </div>
        {!connections.length && (
          <p className="notice">
            Once a connection request is accepted, that student will appear here.
          </p>
        )}
        {error && <p className="error">{error}</p>}
        <button className="button primary full" disabled={busy || !ids.length}>
          <Plus size={16} />
          Create group
        </button>
      </form>
    </Modal>
  );
}
function ManageGroup({
  conversation,
  onClose,
  onExit,
}: {
  conversation: ConversationItem;
  onClose: () => void;
  onExit: () => void;
}) {
  const { state, mutate, api, busy, toast } = useCircle();
  const [candidates, setCandidates] = useState<Student[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [target, setTarget] = useState('');
  const owner = conversation.myRole === 'OWNER';
  const canManage = owner || conversation.myRole === 'ADMIN';
  useEffect(() => {
    if (!canManage) return;
    if (conversation.ideaId && owner)
      api.ideas
        .resonances(conversation.ideaId)
        .then((rows) => setCandidates(rows.map((r) => r.user)))
        .catch((e) => toast(e.message, true));
    else if (!conversation.ideaId)
      setCandidates(
        state.connections
          .filter((c) => c.status === 'ACCEPTED')
          .map((c) => (c.requesterId === state.me.id ? c.receiver : c.requester)),
      );
  }, [api, canManage, owner, conversation.ideaId, state.connections, state.me.id, toast]);
  async function action(action: GroupAction, userId?: string, value?: string) {
    try {
      await mutate(() => api.conversations.update(conversation.id, { action, userId, value }));
      if (action === 'leave' || action === 'delete') onExit();
      else toast('Group updated.');
    } catch {}
  }
  return (
    <Modal title={conversation.name || 'Your group'} onClose={onClose}>
      <p className="muted">
        {conversation.members.length} people, plenty of possibilities. Your role:{' '}
        {conversation.myRole.toLowerCase()}.
      </p>
      {owner && (
        <form
          className="group-settings"
          onSubmit={(e) => {
            e.preventDefault();
            void action('rename', undefined, String(new FormData(e.currentTarget).get('name')));
          }}
        >
          <label>
            Group name
            <input name="name" defaultValue={conversation.name || ''} maxLength={80} required />
          </label>
          <button className="button secondary small" disabled={busy}>
            Rename
          </button>
        </form>
      )}
      {owner && (
        <form
          className="group-settings"
          onSubmit={(e) => {
            e.preventDefault();
            void action('image', undefined, String(new FormData(e.currentTarget).get('image')));
          }}
        >
          <label>
            Group image URL
            <input
              name="image"
              type="url"
              placeholder="https://"
              defaultValue={conversation.image || ''}
            />
          </label>
          <button className="button secondary small" disabled={busy}>
            Save image
          </button>
        </form>
      )}
      <h4>Members</h4>
      <div className="member-list">
        {conversation.members.map((member) => (
          <div className="member-row" key={member.userId}>
            <Avatar user={member.user} size="small" />
            <div className="person-label">
              <strong>
                {member.user.name}
                {member.userId === state.me.id ? ' (you)' : ''}
              </strong>
              <small>{member.role.toLowerCase()}</small>
            </div>
            {canManage && member.role !== 'OWNER' && member.userId !== state.me.id && (
              <div className="member-actions">
                {owner && (
                  <button
                    className="text-link"
                    disabled={busy}
                    onClick={() =>
                      action(member.role === 'ADMIN' ? 'demote' : 'promote', member.userId)
                    }
                  >
                    {member.role === 'ADMIN' ? 'Demote' : 'Make admin'}
                  </button>
                )}
                {(owner || member.role === 'MEMBER') && (
                  <button
                    className="text-link danger"
                    disabled={busy}
                    onClick={() => action('remove', member.userId)}
                  >
                    Remove
                  </button>
                )}
                {owner && !conversation.ideaId && (
                  <button
                    className="text-link"
                    disabled={busy}
                    onClick={() => action('transfer', member.userId)}
                  >
                    Make owner
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {canManage && (
        <div className="group-add">
          <h4>Add collaborators</h4>
          {conversation.ideaId && !owner ? (
            <p className="muted">Ask the idea owner to invite students from the resonance list.</p>
          ) : (
            <>
              <select
                aria-label="Select new member"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">
                  Choose {conversation.ideaId ? 'someone who resonated' : 'an accepted connection'}
                </option>
                {candidates
                  .filter((u) => !conversation.members.some((m) => m.userId === u.id))
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </select>
              <button
                className="button primary small"
                disabled={busy || !target}
                onClick={() => {
                  void action('add', target);
                  setTarget('');
                }}
              >
                <Plus size={15} />
                Add member
              </button>
            </>
          )}
        </div>
      )}
      <div className="group-danger">
        {owner ? (
          confirmDelete ? (
            <div className="notice">
              <p>Delete this group and its message history? This cannot be undone.</p>
              <button
                className="button danger-button"
                disabled={busy}
                onClick={() => action('delete')}
              >
                Delete permanently
              </button>
              <button className="button secondary" onClick={() => setConfirmDelete(false)}>
                Keep group
              </button>
            </div>
          ) : (
            <>
              <p className="muted">
                {conversation.ideaId
                  ? 'Idea ownership stays with you. Delete this group if you no longer need it.'
                  : 'To leave, first make another member the owner.'}
              </p>
              <button className="text-link danger" onClick={() => setConfirmDelete(true)}>
                Delete group
              </button>
            </>
          )
        ) : (
          <button className="text-link danger" disabled={busy} onClick={() => action('leave')}>
            Leave group
          </button>
        )}
      </div>
    </Modal>
  );
}
