# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: community.spec.ts >> stream refreshes connection state in a second open browser
- Location: tests\e2e\community.spec.ts:135:1

# Error details

```
Test timeout of 75000ms exceeded.
```

```
Error: locator.click: Test timeout of 75000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'More people', exact: true })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - alert [ref=e2]
  - generic [ref=e3]:
    - complementary [ref=e4]:
      - link "Founder Circle" [ref=e5] [cursor=pointer]:
        - /url: /
      - generic [ref=e10]: YOUR COMMUNITY
      - navigation [ref=e11]:
        - link "Home" [ref=e12] [cursor=pointer]:
          - /url: /
        - link "Idea Board" [ref=e17] [cursor=pointer]:
          - /url: /ideas
        - link "Discover" [ref=e21] [cursor=pointer]:
          - /url: /discover
        - link "Events" [ref=e26] [cursor=pointer]:
          - /url: /events
        - link "Connections" [ref=e30] [cursor=pointer]:
          - /url: /connections
        - link "Messages" [ref=e37] [cursor=pointer]:
          - /url: /messages
      - generic [ref=e41]:
        - button "Aarav Mehta Aarav Mehta IIT Bombay" [ref=e42] [cursor=pointer]:
          - generic "Aarav Mehta" [ref=e43]: AM
          - generic [ref=e45]:
            - strong [ref=e46]: Aarav Mehta
            - generic [ref=e47]: IIT Bombay
        - button "Log out" [ref=e48] [cursor=pointer]
    - generic [ref=e52]:
      - banner [ref=e53]:
        - generic [ref=e55]:
          - text: Your space
          - generic [ref=e56]: /
          - strong [ref=e57]: Connections
        - generic [ref=e58]:
          - textbox "Search students" [ref=e62]:
            - /placeholder: Search people
          - generic [ref=e63]: ↵
        - generic [ref=e64]:
          - link "Messages" [ref=e65] [cursor=pointer]:
            - /url: /messages
          - link "0 unread notifications" [ref=e68] [cursor=pointer]:
            - /url: /notifications
          - button [ref=e72] [cursor=pointer]:
            - generic "Aarav Mehta" [ref=e73]: AM
      - generic [ref=e77]: LOCAL DEMO · Sample students and events · Changes are saved to your local database
      - main [ref=e78]:
        - generic [ref=e79]:
          - generic [ref=e80]:
            - heading "Connections" [level=1] [ref=e82]
            - button "Create group" [ref=e83] [cursor=pointer]
          - generic [ref=e85]:
            - button "Connections 4" [ref=e86] [cursor=pointer]:
              - text: Connections
              - generic [ref=e87]: "4"
            - button "Incoming Requests 0" [ref=e88] [cursor=pointer]:
              - text: Incoming Requests
              - generic [ref=e89]: "0"
            - button "Sent Requests 1" [ref=e90] [cursor=pointer]:
              - text: Sent Requests
              - generic [ref=e91]: "1"
          - article [ref=e93]:
            - generic [ref=e94]:
              - generic "Ananya Sharma" [ref=e95]: AS
              - generic [ref=e97]:
                - button "Ananya Sharma Email verified" [ref=e98] [cursor=pointer]:
                  - text: Ananya Sharma
                  - generic "Email verified; college verification pending" [ref=e99]: Email verified
                - paragraph [ref=e100]: IIT Delhi
                - text: B.Tech · Computer Science
            - generic [ref=e101]:
              - generic [ref=e102]: React
              - generic [ref=e103]: Python
              - generic [ref=e104]: Machine Learning
            - generic [ref=e105]:
              - generic [ref=e106]: Request Sent
              - button "Cancel Request" [ref=e107] [cursor=pointer]
              - button "View profile" [ref=e108] [cursor=pointer]
  - generic "New activity"
```

# Test source

```ts
  66  |   await dialog.getByRole('button', { name: 'Create group', exact: true }).click();
  67  |   await expect(page.locator('.chat-header')).toContainText('Browser test collaboration');
  68  |   await page
  69  |     .getByRole('textbox', { name: 'Message', exact: true })
  70  |     .fill('Hello from the browser regression test.');
  71  |   await page.getByRole('button', { name: 'Send message' }).click();
  72  |   await expect(page.locator('.message-scroll')).toContainText(
  73  |     'Hello from the browser regression test.',
  74  |   );
  75  |   await page.reload();
  76  |   await expect(page.locator('.message-scroll')).toContainText(
  77  |     'Hello from the browser regression test.',
  78  |   );
  79  |   await page.getByRole('button', { name: 'Members' }).click();
  80  |   const kabir = dialog.locator('.member-row').filter({ hasText: 'Kabir Sethi' });
  81  |   await kabir.getByRole('button', { name: 'Make admin', exact: true }).click();
  82  |   await expect(kabir.getByText('admin', { exact: true })).toBeVisible();
  83  |   await dialog
  84  |     .locator('.member-row')
  85  |     .filter({ hasText: 'Isha Rao' })
  86  |     .getByRole('button', { name: 'Remove' })
  87  |     .click();
  88  |   await expect(dialog.locator('.member-row').filter({ hasText: 'Isha Rao' })).toHaveCount(0);
  89  |   await dialog.getByRole('combobox', { name: 'Select new member' }).selectOption('demo-isha');
  90  |   await dialog.getByRole('button', { name: 'Add member' }).click();
  91  |   await expect(dialog.locator('.member-row').filter({ hasText: 'Isha Rao' })).toBeVisible();
  92  |   await dialog.getByRole('button', { name: 'Delete group', exact: true }).click();
  93  |   await dialog.getByRole('button', { name: 'Delete permanently' }).click();
  94  |   await expect(
  95  |     page.locator('.conversation-row').filter({ hasText: 'Browser test collaboration' }),
  96  |   ).toHaveCount(0);
  97  | });
  98  | test('idea owner reuses the same group when adding another resonator', async ({
  99  |   page,
  100 |   request,
  101 | }) => {
  102 |   const state = await (await request.get('/api/state')).json();
  103 |   const existing = state.conversations.find((c: { ideaId: string }) => c.ideaId === 'seed-idea-3');
  104 |   if (existing)
  105 |     await request.patch(`/api/conversations/${existing.id}`, { data: { action: 'delete' } });
  106 |   await page.goto('/ideas');
  107 |   await page
  108 |     .getByRole('button', { name: 'A little map of everything happening on campus', exact: true })
  109 |     .click();
  110 |   await page.getByRole('checkbox', { name: 'Select Rohan Iyer' }).check();
  111 |   await page.getByRole('button', { name: 'Create group', exact: true }).click();
  112 |   await expect(page.locator('.chat-header')).toContainText('A little map');
  113 |   const firstUrl = page.url();
  114 |   await page
  115 |     .getByRole('textbox', { name: 'Message', exact: true })
  116 |     .fill('The first group keeps this history.');
  117 |   await page.getByRole('button', { name: 'Send message' }).click();
  118 |   await expect(page.locator('.message-scroll')).toContainText(
  119 |     'The first group keeps this history.',
  120 |   );
  121 |   await page.goto('/ideas');
  122 |   await page
  123 |     .getByRole('button', { name: 'A little map of everything happening on campus', exact: true })
  124 |     .click();
  125 |   await page.getByRole('checkbox', { name: 'Select Meera Patel' }).check();
  126 |   await page.getByRole('button', { name: 'Add selected (1)' }).click();
  127 |   await expect(page).toHaveURL(firstUrl);
  128 |   await expect(page.locator('.message-scroll')).toContainText(
  129 |     'The first group keeps this history.',
  130 |   );
  131 |   await page.getByRole('button', { name: 'Members' }).click();
  132 |   await expect(page.getByRole('dialog').getByText('Rohan Iyer')).toBeVisible();
  133 |   await expect(page.getByRole('dialog').getByText('Meera Patel')).toBeVisible();
  134 | });
  135 | test('stream refreshes connection state in a second open browser', async ({
  136 |   page,
  137 |   context,
  138 |   request,
  139 | }) => {
  140 |   // Snapshots refresh every 15 seconds on a 3-second SSE tick. Allow the next
  141 |   // tick as well as the request, rather than racing the throttle boundary.
  142 |   test.setTimeout(75000);
  143 |   const initial = await (await request.get('/api/state?view=/connections')).json();
  144 |   const old = initial.connections.find(
  145 |     (c: { receiverId: string; status: string }) =>
  146 |       c.receiverId === 'demo-zoya' && c.status === 'PENDING',
  147 |   );
  148 |   if (old) await request.patch(`/api/connections/${old.id}`, { data: { action: 'cancel' } });
  149 |   await request.delete('/api/skips', { data: {} });
  150 |   await page.goto('/connections');
  151 |   await page.getByRole('button', { name: /Sent Requests/ }).click();
  152 |   const other = await context.newPage();
  153 |   await other.goto('/discover?search=Zoya');
  154 |   const card = other.locator('.student-card').filter({ hasText: 'Zoya Khan' });
  155 |   await card.getByRole('button', { name: 'Connect', exact: true }).click();
  156 |   await expect(page.locator('.connection-card').filter({ hasText: 'Zoya Khan' })).toBeVisible({
  157 |     timeout: 22000,
  158 |   });
  159 |   await expect(other.locator('.results-bar strong')).toHaveText('0', { timeout: 22000 });
  160 |   await page
  161 |     .locator('.connection-card')
  162 |     .filter({ hasText: 'Zoya Khan' })
  163 |     .getByRole('button', { name: 'Cancel Request' })
  164 |     .click();
  165 |   await expect(other.locator('.results-bar strong')).toHaveText('1', { timeout: 22000 });
> 166 |   await other.getByRole('button', { name: 'More people', exact: true }).click();
      |                                                                         ^ Error: locator.click: Test timeout of 75000ms exceeded.
  167 |   await expect(card.getByRole('button', { name: 'Connect', exact: true })).toBeVisible({
  168 |     timeout: 15000,
  169 |   });
  170 |   await other.close();
  171 | });
  172 | test('all routes render on mobile without overflow or browser errors', async ({ page }) => {
  173 |   const errors: string[] = [];
  174 |   page.on('pageerror', (error) => errors.push(error.message));
  175 |   await page.setViewportSize({ width: 390, height: 844 });
  176 |   for (const route of [
  177 |     '/',
  178 |     '/discover',
  179 |     '/connections',
  180 |     '/ideas',
  181 |     '/events',
  182 |     '/messages',
  183 |     '/notifications',
  184 |     '/profile',
  185 |   ]) {
  186 |     await page.goto(route);
  187 |     await expect(page.locator('h1')).toBeVisible();
  188 |     const overflow = await page.evaluate(
  189 |       () => document.documentElement.scrollWidth > window.innerWidth,
  190 |     );
  191 |     expect(overflow, `Horizontal overflow on ${route}`).toBe(false);
  192 |     await expect(page.locator('.bottom-nav')).toBeVisible();
  193 |   }
  194 |   await page.goto('/');
  195 |   await expect(page.getByRole('heading', { name: 'Meet your next collaborator.' })).toBeVisible();
  196 |   await page.screenshot({ path: '.local/home-mobile.png', fullPage: true });
  197 |   expect(errors).toEqual([]);
  198 | });
  199 | 
```