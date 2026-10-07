import { expect, type Page } from '@playwright/test';
import type {
  AppState,
  Student,
  NotificationSnapshot,
} from '../../../src/shared/contracts/responses';

export function fixtureStudent(id: string, long = false): Student {
  return {
    id,
    name: long ? `Student ${'LongName'.repeat(10)}` : `Student ${id}`,
    role: 'STUDENT',
    accountStatus: 'ACTIVE',
    college: 'A college with a deliberately long name to test small screens',
    degree: 'B.Tech',
    graduationYear: 2028,
    city: 'Jaipur',
    bio: `A long biography ${'https://example.com/verylongpath'.repeat(12)}`,
    photo: '',
    skills: ['React', 'Machine learning', 'LongSkill'.repeat(10)],
    interests: ['Technology', 'LongInterest'.repeat(10)],
    domains: ['Education', 'LongDomain'.repeat(10)],
    lookingFor: ['Project partners', 'LongPurpose'.repeat(10)],
    linkedin: '',
    github: '',
    instagram: '',
    portfolio: '',
    emailVerified: true,
    collegeVerified: true,
    collegeVerificationSource: 'COLLEGE_ID',
    onboarded: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}
export async function mockMobileApp(page: Page, long = false) {
  const me = fixtureStudent('me', long),
    peer = fixtureStudent('A', long);
  const date = me.createdAt;
  const state: AppState = {
    me,
    students: ['A', 'B', 'C', 'D', 'E', 'F'].map((id) => fixtureStudent(id, long)),
    totalStudents: 6,
    connections: [
      {
        id: 'connection',
        pairKey: 'me:A',
        requesterId: 'A',
        receiverId: 'me',
        requester: peer,
        receiver: me,
        status: 'PENDING',
        createdAt: date,
        updatedAt: date,
      },
    ],
    ideas: [
      {
        id: 'idea',
        authorId: 'me',
        author: me,
        title: 'An idea for a better student community',
        description: 'LongDescription'.repeat(40),
        category: 'Technology',
        skills: ['React'],
        tags: [],
        resonances: [],
        _count: { resonances: 0 },
        conversation: null,
        createdAt: date,
        updatedAt: date,
      },
    ],
    events: [
      {
        id: 'event',
        ownerId: null,
        title: 'A community workshop',
        description: 'LongEventDescription'.repeat(30),
        category: 'Workshop',
        organizer: 'Our community',
        location: 'LongLocation'.repeat(20),
        startsAt: '2027-01-01T10:00:00.000Z',
        url: 'https://example.com',
        createdAt: date,
        attachments: [],
        savedBy: [],
      },
    ],
    notifications: [],
    notificationUnread: 0,
    conversations: [
      {
        id: 'group',
        type: 'GROUP',
        name: 'LongGroupName'.repeat(20),
        image: '',
        ownerId: 'me',
        ideaId: null,
        directKey: null,
        myRole: 'OWNER',
        unread: 0,
        createdAt: date,
        updatedAt: date,
        members: [
          {
            conversationId: 'group',
            userId: 'me',
            role: 'OWNER',
            joinedAt: date,
            lastReadAt: date,
            user: me,
          },
          {
            conversationId: 'group',
            userId: 'A',
            role: 'MEMBER',
            joinedAt: date,
            lastReadAt: date,
            user: peer,
          },
        ],
        messages: [],
      },
    ],
    blockedIds: [],
  };
  const calls: string[] = [];
  const actions: string[] = [];
  const controls = { fail: false };
  await page.addInitScript(() => {
    const app = window as typeof window & {
      __liveStarts: number;
      __emitActivity?: (payload: unknown) => void;
    };
    app.__liveStarts = 0;
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url =
        typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
      if (!new URL(url, location.origin).pathname.endsWith('/api/live'))
        return original(input, init);
      app.__liveStarts++;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode('event: ready\ndata: {}\n\n'));
          app.__emitActivity = (payload) =>
            controller.enqueue(
              encoder.encode(`event: notifications\ndata: ${JSON.stringify(payload)}\n\n`),
            );
          init?.signal?.addEventListener(
            'abort',
            () => {
              try {
                controller.close();
              } catch {}
            },
            { once: true },
          );
        },
      });
      return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
    };
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    calls.push(`${request.method()} ${path}`);
    if (path === '/api/config') return route.fulfill({ json: { demo: true, configured: false } });
    if (path === '/api/state') return route.fulfill({ json: state });
    if (path.startsWith('/api/students/') && path.endsWith('/posts'))
      return route.fulfill({ json: { items: [], nextCursor: null } });
    if (path.startsWith('/api/students/')) return route.fulfill({ json: peer });
    if (path === '/api/recommendations/interactions') return route.fulfill({ json: { ok: true } });
    if (path === '/api/notifications' || path.startsWith('/api/notifications/')) {
      const id = path.split('/')[3];
      let count = 0;
      state.notifications = state.notifications.map((item) => {
        if (!item.readAt && (!id || id === item.id)) {
          count++;
          return { ...item, readAt: new Date().toISOString() };
        }
        return item;
      });
      state.notificationUnread = state.notifications.filter((item) => !item.readAt).length;
      return route.fulfill({
        json: { count, items: state.notifications, unreadCount: state.notificationUnread },
      });
    }
    if (path === '/api/connections' && request.method() === 'POST') {
      const { userId } = request.postDataJSON();
      actions.push(`connect:${userId}`);
      if (controls.fail) return route.fulfill({ status: 500, json: { error: 'Action failed' } });
      return route.fulfill({
        json: {
          id: `request-${userId}`,
          pairKey: `me:${userId}`,
          requesterId: 'me',
          receiverId: userId,
          status: 'PENDING',
          createdAt: date,
          updatedAt: date,
        },
      });
    }
    if (path.startsWith('/api/skips/') && request.method() === 'POST') {
      const id = path.split('/').pop()!;
      actions.push(`skip:${id}`);
      if (controls.fail) return route.fulfill({ status: 500, json: { error: 'Action failed' } });
      state.students = state.students.filter((item) => item.id !== id);
      state.totalStudents = state.students.length;
      return route.fulfill({ json: { userId: 'me', targetId: id } });
    }
    if (path.startsWith('/api/conversations/') && path.endsWith('/messages'))
      return route.fulfill({ json: [] });
    if (path === '/api/colleges') return route.fulfill({ json: [] });
    return route.fulfill({ json: { ok: true } });
  });
  return { state, calls, actions, controls };
}
export async function emitActivity(page: Page, snapshot: NotificationSnapshot) {
  await page.waitForFunction(
    () => typeof (window as unknown as { __emitActivity?: unknown }).__emitActivity === 'function',
  );
  await page.evaluate(
    (payload) =>
      (
        window as unknown as { __emitActivity: (payload: NotificationSnapshot) => void }
      ).__emitActivity(payload),
    snapshot,
  );
}
export async function navigateMobile(page: Page, path: string) {
  if (path === '/profile') {
    await page.locator('.topbar-profile').click();
  } else if (path === '/notifications') {
    await page.locator('.topbar a[href="/notifications"]').click();
  } else {
    const direct = page.locator(`.bottom-nav a[href="${path}"]`);
    if (await direct.count()) await direct.click();
    else {
      await page.getByRole('button', { name: /^More/ }).click();
      await page.locator(`.sidebar.open a[href="${path}"]`).click();
    }
  }
  await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/$' : path.replace('/', '\/')}`));
}
export async function touchDrag(page: Page, x: number, y: number, dx: number, dy = 0) {
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let step = 1; step <= 12; step++) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + (dx * step) / 12, y: y + (dy * step) / 12 }],
    });
    await page.waitForTimeout(16);
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
}
