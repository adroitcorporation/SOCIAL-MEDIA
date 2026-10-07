# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: community.spec.ts >> request can be cancelled after refresh, persisted, and sent again
- Location: tests\e2e\community.spec.ts:7:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('.student-card').filter({ has: getByRole('button', { name: 'Ananya Sharma Email verified', exact: true }) })
Expected: 0
Received: 1
Timeout:  10000ms

Call log:
  - Expect "toHaveCount" locator('.student-card').filter({ has: getByRole('button', { name: 'Ananya Sharma Email verified', exact: true }) }) with timeout 10000ms
  - waiting for locator('.student-card').filter({ has: getByRole('button', { name: 'Ananya Sharma Email verified', exact: true }) })
    23 × locator resolved to 1 element
       - unexpected value "1"

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
          - strong [ref=e57]: Discover
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
        - generic [ref=e80]:
          - heading "Discover people" [level=1] [ref=e83]
          - generic [ref=e85]:
            - textbox "Search people" [ref=e90]:
              - /placeholder: Name, college, city
              - text: Ananya
            - button "Filters" [ref=e91] [cursor=pointer]
            - button "Search profiles" [ref=e93] [cursor=pointer]
          - generic [ref=e96]:
            - generic [ref=e97]:
              - strong [ref=e98]: "1"
              - text: profiles
            - button "Show skipped profiles" [ref=e99] [cursor=pointer]
          - article [ref=e101]:
            - generic [ref=e102]:
              - generic "Ananya Sharma" [ref=e103]: AS
              - button "View Ananya Sharma's profile" [ref=e105] [cursor=pointer]
              - generic [ref=e109]:
                - button "Ananya Sharma Email verified" [ref=e110] [cursor=pointer]:
                  - text: Ananya Sharma
                  - generic "Email verified; college verification pending" [ref=e111]: Email verified
                - paragraph [ref=e112]:
                  - text: B.Tech · Computer Science
                  - generic [ref=e113]: · 2028
            - generic [ref=e114]:
              - generic [ref=e115]:
                - generic [ref=e116]: 36% Match
                - generic [ref=e117]:
                  - generic [ref=e118]: Technology
                  - generic [ref=e119]: Complementary skills
                  - generic [ref=e120]: Hackathon Team
              - generic [ref=e121]:
                - generic [ref=e122]: Technology
                - generic [ref=e123]: Social impact
              - paragraph [ref=e124]: IIT Delhi
              - generic [ref=e128]:
                - generic [ref=e129]: Web Development
                - generic [ref=e130]: Python
                - generic [ref=e131]: AI / Machine Learning
              - generic [ref=e132]:
                - text: "Looking for:"
                - generic [ref=e134]: Hackathon Team
            - generic [ref=e135]:
              - button "Skip Ananya Sharma" [ref=e136] [cursor=pointer]: Skip
              - button "Pending" [disabled] [ref=e140]
  - generic "New activity"
```

# Test source

```ts
  1   | import { expect } from '@playwright/test';
  2   | import { test } from './verified-demo';
  3   | test.beforeEach(async ({ request }) => {
  4   |   const config = await (await request.get('/api/config')).json();
  5   |   expect(config.demo, 'Browser tests are restricted to the local sample database').toBe(true);
  6   | });
  7   | test('request can be cancelled after refresh, persisted, and sent again', async ({
  8   |   page,
  9   |   request,
  10  | }) => {
  11  |   const state = await (await request.get('/api/state')).json();
  12  |   const previous = state.connections.find(
  13  |     (c: { receiverId: string; status: string }) =>
  14  |       c.receiverId === 'demo-ananya' && c.status === 'PENDING',
  15  |   );
  16  |   if (previous)
  17  |     await request.patch(`/api/connections/${previous.id}`, { data: { action: 'cancel' } });
  18  |   await request.delete('/api/skips', { data: {} });
  19  |   await page.goto('/discover?search=Ananya');
  20  |   const card = page.locator('.student-card').filter({
  21  |     has: page.getByRole('button', { name: 'Ananya Sharma Email verified', exact: true }),
  22  |   });
  23  |   await card.getByRole('button', { name: 'Connect', exact: true }).click();
> 24  |   await expect(card).toHaveCount(0);
      |                      ^ Error: expect(locator).toHaveCount(expected) failed
  25  |   await page.goto('/connections');
  26  |   await page.getByRole('button', { name: /Sent Requests/ }).click();
  27  |   await page.reload();
  28  |   await page.getByRole('button', { name: /Sent Requests/ }).click();
  29  |   await page
  30  |     .locator('.connection-card')
  31  |     .filter({ hasText: 'Ananya Sharma' })
  32  |     .getByRole('button', { name: 'Cancel Request' })
  33  |     .click();
  34  |   await page.goto('/discover?search=Ananya');
  35  |   await expect(card.getByRole('button', { name: 'Connect', exact: true })).toBeVisible();
  36  |   const updated = await (await request.get('/api/state')).json();
  37  |   expect(
  38  |     updated.connections.some((c: { receiverId: string }) => c.receiverId === 'demo-ananya'),
  39  |   ).toBe(false);
  40  |   await card.getByRole('button', { name: 'Connect', exact: true }).click();
  41  |   await expect(card).toHaveCount(0);
  42  |   await page.goto('/connections');
  43  |   await page.getByRole('button', { name: /Sent Requests/ }).click();
  44  |   await page
  45  |     .locator('.connection-card')
  46  |     .filter({ hasText: 'Ananya Sharma' })
  47  |     .getByRole('button', { name: 'Cancel Request' })
  48  |     .click();
  49  |   await expect(page.getByText('No sent requests.')).toBeVisible();
  50  | });
  51  | test('create accepted-connection group, message, promote, remove, and delete', async ({
  52  |   page,
  53  |   request,
  54  | }) => {
  55  |   await page.goto('/messages');
  56  |   await page.getByRole('button', { name: 'Create group', exact: true }).click();
  57  |   const dialog = page.getByRole('dialog');
  58  |   await dialog.getByLabel('Group name').fill('Browser test collaboration');
  59  |   await expect(dialog.getByText('Kabir Sethi')).toBeVisible();
  60  |   const state = await (await request.get('/api/state?view=/connections')).json();
  61  |   const accepted = state.connections.filter((c: { status: string }) => c.status === 'ACCEPTED');
  62  |   await expect(dialog.getByRole('checkbox')).toHaveCount(accepted.length);
  63  |   await expect(dialog.getByText('Ananya Sharma')).toHaveCount(0);
  64  |   await dialog.getByRole('checkbox', { name: /Kabir Sethi/ }).check();
  65  |   await dialog.getByRole('checkbox', { name: /Isha Rao/ }).check();
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
```