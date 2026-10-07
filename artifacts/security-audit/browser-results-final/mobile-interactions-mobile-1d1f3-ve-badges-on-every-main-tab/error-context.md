# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mobile-interactions.spec.ts >> mobile layout and gestures >> one global subscription delivers deduplicated popups and authoritative badges on every main tab
- Location: tests\e2e\mobile-interactions.spec.ts:198:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 1
Received: 5
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - alert [ref=e2]: Founder Circle
  - generic [ref=e3]:
    - generic [ref=e4]:
      - banner [ref=e5]:
        - button "Open navigation" [ref=e7] [cursor=pointer]
        - textbox "Search students" [ref=e13]:
          - /placeholder: Search people
        - generic [ref=e14]:
          - link "Messages" [ref=e15] [cursor=pointer]:
            - /url: /messages
          - link "1 unread notifications" [ref=e18] [cursor=pointer]:
            - /url: /notifications
            - generic [ref=e22]: "1"
          - button [ref=e23] [cursor=pointer]:
            - generic "Student me" [ref=e24]: Sm
      - generic [ref=e26]: LOCAL DEMO · Sample students and events · Changes are saved to your local database
      - main [ref=e27]:
        - generic [ref=e28]:
          - generic [ref=e29]:
            - heading "Connections" [level=1] [ref=e31]
            - button "Create group" [ref=e32] [cursor=pointer]
          - generic [ref=e34]:
            - button "Connections 0" [ref=e35] [cursor=pointer]:
              - text: Connections
              - generic [ref=e36]: "0"
            - button "Incoming Requests 1" [ref=e37] [cursor=pointer]:
              - text: Incoming Requests
              - generic [ref=e38]: "1"
            - button "Sent Requests 0" [ref=e39] [cursor=pointer]:
              - text: Sent Requests
              - generic [ref=e40]: "0"
          - generic [ref=e41]:
            - heading "No connections yet." [level=3] [ref=e42]
            - link "Discover people" [ref=e43] [cursor=pointer]:
              - /url: /discover
    - navigation "Mobile navigation" [ref=e47]:
      - link "Home" [ref=e48] [cursor=pointer]:
        - /url: /
      - link "Discover" [ref=e53] [cursor=pointer]:
        - /url: /discover
      - link "Idea Board" [ref=e58] [cursor=pointer]:
        - /url: /ideas
      - button "More, 1 unread" [ref=e62] [cursor=pointer]:
        - generic [aria-hidden] [ref=e63]: "1"
        - generic [ref=e65]: More
  - generic "New activity"
```

# Test source

```ts
  157 |       });
  158 |       observer.observe(card, { attributes: true, attributeFilter: ['style'] });
  159 |       for (let x = 101; x <= 200; x++)
  160 |         card.dispatchEvent(
  161 |           new PointerEvent('pointermove', {
  162 |             bubbles: true,
  163 |             pointerId: 1,
  164 |             isPrimary: true,
  165 |             clientX: x,
  166 |             clientY: card.getBoundingClientRect().y + 40,
  167 |           }),
  168 |         );
  169 |       await new Promise(requestAnimationFrame);
  170 |       await Promise.resolve();
  171 |       observer.disconnect();
  172 |       card.dispatchEvent(
  173 |         new PointerEvent('pointercancel', { bubbles: true, pointerId: 1, isPrimary: true }),
  174 |       );
  175 |       return writes;
  176 |     });
  177 |     expect(styleWrites).toBeGreaterThan(0);
  178 |     expect(styleWrites).toBeLessThanOrEqual(2);
  179 |     await page.mouse.up();
  180 |     const initialRequests = calls.filter((entry) => entry === 'GET /api/state').length;
  181 |     const bounds = (await active().boundingBox())!;
  182 |     await touchDrag(page, bounds.x + 90, bounds.y + 55, 150);
  183 |     await expect(active().locator('.student-name')).toHaveText('Student B');
  184 |     expect(actions).toEqual(['connect:A']);
  185 |     expect(calls.filter((entry) => entry === 'GET /api/state')).toHaveLength(initialRequests);
  186 |     controls.fail = true;
  187 |     const second = (await active().boundingBox())!;
  188 |     await touchDrag(page, second.x + second.width - 65, second.y + 60, -160);
  189 |     await expect(page.getByText('Action failed', { exact: true })).toBeVisible();
  190 |     await expect(active().locator('.student-name')).toHaveText('Student B');
  191 |     await expect(active()).not.toHaveClass(/is-exiting/);
  192 |     controls.fail = false;
  193 |     await active().getByRole('button', { name: 'Skip Student B' }).click();
  194 |     await expect(active().locator('.student-name')).toHaveText('Student C');
  195 |     expect(actions).toEqual(['connect:A', 'skip:B', 'skip:B']);
  196 |   });
  197 | 
  198 |   test('one global subscription delivers deduplicated popups and authoritative badges on every main tab', async ({
  199 |     page,
  200 |   }) => {
  201 |     await page.setViewportSize({ width: 390, height: 844 });
  202 |     const { state } = await mockMobileApp(page);
  203 |     await page.goto('/');
  204 |     await expect(page.locator('.page-content')).toContainText('People to meet');
  205 |     await emitActivity(page, { items: [], unreadCount: 0 });
  206 |     for (const [index, path] of [
  207 |       '/',
  208 |       '/discover',
  209 |       '/profile',
  210 |       '/ideas',
  211 |       '/events',
  212 |       '/connections',
  213 |       '/messages',
  214 |       '/notifications',
  215 |     ].entries()) {
  216 |       if (new URL(page.url()).pathname !== path) await navigateMobile(page, path);
  217 |       const item = {
  218 |         id: `notification-${index}`,
  219 |         userId: 'me',
  220 |         title: `New request ${index}`,
  221 |         body: 'A student sent you a connection request',
  222 |         href: '/connections',
  223 |         readAt: null,
  224 |         createdAt: new Date().toISOString(),
  225 |       };
  226 |       state.notifications.unshift(item);
  227 |       state.notificationUnread = 1;
  228 |       const payload = { items: state.notifications, unreadCount: 1 };
  229 |       await emitActivity(page, payload);
  230 |       await emitActivity(page, payload);
  231 |       await expect(page.locator('.notification-toast')).toHaveCount(1);
  232 |       await expect(page.getByRole('link', { name: '1 unread notifications' })).toBeVisible();
  233 |       await page.locator('.notification-toast-open').click();
  234 |       await expect(page).toHaveURL(/\/connections$/);
  235 |       await expect(page.locator('.notification-toast')).toHaveCount(0);
  236 |       await expect(page.getByRole('link', { name: '0 unread notifications' })).toBeVisible();
  237 |     }
  238 |     await page.getByRole('button', { name: /^More/ }).click();
  239 |     const item = {
  240 |       id: 'menu-activity',
  241 |       userId: 'me',
  242 |       title: 'Activity while in More',
  243 |       body: 'Group invitation',
  244 |       href: '/messages?conversation=group',
  245 |       readAt: null,
  246 |       createdAt: new Date().toISOString(),
  247 |     };
  248 |     state.notifications.unshift(item);
  249 |     await emitActivity(page, { items: state.notifications, unreadCount: 1 });
  250 |     await expect(page.locator('.notification-toast')).toContainText(item.title);
  251 |     await page.keyboard.press('Escape');
  252 |     await page.getByRole('button', { name: `Dismiss ${item.title}` }).click();
  253 |     await expect(page.locator('.notification-toast')).toHaveCount(0);
  254 |     await expect(page.getByRole('link', { name: '1 unread notifications' })).toBeVisible();
  255 |     expect(
  256 |       await page.evaluate(() => (window as unknown as { __liveStarts: number }).__liveStarts),
> 257 |     ).toBe(1);
      |       ^ Error: expect(received).toBe(expected) // Object.is equality
  258 |   });
  259 | });
  260 | 
  261 | test('desktop layouts and horizontal trackpad navigation remain functional', async ({ page }) => {
  262 |   await page.setViewportSize({ width: 1440, height: 1000 });
  263 |   await mockMobileApp(page);
  264 |   await page.goto('/');
  265 |   await expect(page.locator('.sidebar')).toBeVisible();
  266 |   await expect(page.locator('.bottom-nav')).toBeHidden();
  267 |   const tray = page.getByRole('region', { name: 'People to meet' });
  268 |   await tray.scrollIntoViewIfNeeded();
  269 |   await tray.hover();
  270 |   await page.mouse.wheel(400, 0);
  271 |   await expect.poll(() => tray.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
  272 |   await page.locator('.sidebar a[href="/discover"]').click();
  273 |   await expect(
  274 |     page
  275 |       .locator('.discover-profile-card:not(.is-preview)')
  276 |       .getByRole('button', { name: 'Respond', exact: true }),
  277 |   ).toBeVisible();
  278 |   expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
  279 | });
  280 | 
  281 | test('real database activity reaches an unrelated tab through SSE and is marked read by toast navigation', async ({
  282 |   page,
  283 |   request,
  284 | }) => {
  285 |   expect((await (await request.get('/api/config')).json()).demo).toBe(true);
  286 |   const db = new PrismaClient({
  287 |     datasources: {
  288 |       db: {
  289 |         url: 'postgresql://postgres:postgres@127.0.0.1:54329/postgres?connection_limit=1&pgbouncer=true&statement_cache_size=0',
  290 |       },
  291 |     },
  292 |   });
  293 |   const id = `sse-browser-${Date.now()}`;
  294 |   try {
  295 |     await page.goto('/events');
  296 |     await expect(page.locator('.page-content h1')).toHaveText('Events');
  297 |     await page.waitForTimeout(300);
  298 |     await db.notification.create({
  299 |       data: {
  300 |         id,
  301 |         userId: 'demo-aarav',
  302 |         title: 'Real SSE connection request',
  303 |         body: 'New server-backed activity',
  304 |         href: '/connections',
  305 |       },
  306 |     });
  307 |     await expect(page.locator('.notification-toast')).toContainText('Real SSE connection request');
  308 |     await page
  309 |       .locator('.notification-toast-open')
  310 |       .filter({ hasText: 'Real SSE connection request' })
  311 |       .click();
  312 |     await expect(page).toHaveURL(/\/connections$/);
  313 |     expect((await db.notification.findUniqueOrThrow({ where: { id } })).readAt).not.toBeNull();
  314 |   } finally {
  315 |     await db.notification.deleteMany({ where: { id } });
  316 |     await db.$disconnect();
  317 |   }
  318 | });
  319 | 
```