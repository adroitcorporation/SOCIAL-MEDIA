# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: profile-completion.spec.ts >> saving missing details unlocks Connect on previously visited tabs without reloading
- Location: tests\e2e\profile-completion.spec.ts:57:1

# Error details

```
Test timeout of 45000ms exceeded.
```

```
Error: locator.click: Test timeout of 45000ms exceeded.
Call log:
  - waiting for locator('.mobile-more-sheet a[href="/discover"]')

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - alert [ref=e2]
  - generic [ref=e3]:
    - generic [ref=e4]:
      - banner [ref=e5]:
        - button "Open navigation" [ref=e7] [cursor=pointer]
        - textbox "Search students" [ref=e13]:
          - /placeholder: Search people
        - generic [ref=e14]:
          - link "Messages" [ref=e15] [cursor=pointer]:
            - /url: /messages
          - link "0 unread notifications" [ref=e18] [cursor=pointer]:
            - /url: /notifications
          - button [ref=e22] [cursor=pointer]:
            - generic "Student me" [ref=e23]: Sm
      - generic [ref=e25]: LOCAL DEMO · Sample students and events · Changes are saved to your local database
      - main [ref=e26]:
        - generic [ref=e27]:
          - heading "Hey Student," [level=1] [ref=e30]
          - generic [ref=e32]:
            - heading [level=2] [ref=e33]:
              - text: Meet your next
              - emphasis [ref=e34]: collaborator.
            - paragraph [ref=e35]: A student network for builders, creators and doers across India’s colleges.
            - generic [ref=e36]:
              - link "Discover people" [ref=e37] [cursor=pointer]:
                - /url: /discover
              - link "Explore ideas" [ref=e40] [cursor=pointer]:
                - /url: /ideas
          - generic [ref=e44]:
            - complementary [ref=e45]:
              - generic [ref=e46]:
                - heading "Events" [level=2] [ref=e47]
                - link "View all events" [ref=e48] [cursor=pointer]:
                  - /url: /events
              - link "↗ WORKSHOP 1 Jan A community workshop LongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocation Our community" [ref=e53] [cursor=pointer]:
                - /url: /events
                - generic [ref=e54]:
                  - generic [ref=e55]: ↗
                  - generic [ref=e56]: WORKSHOP
                  - generic [ref=e57]:
                    - generic [ref=e58]: "1"
                    - text: Jan
                - heading "A community workshop" [level=3] [ref=e59]
                - paragraph [ref=e60]: LongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocationLongLocation
                - generic [ref=e64]: Our community
            - generic [ref=e69]:
              - generic [ref=e70]:
                - heading "People to meet" [level=2] [ref=e71]
                - generic [ref=e72]:
                  - button "Previous profiles" [disabled] [ref=e73]
                  - button "Next profiles" [ref=e76] [cursor=pointer]
                  - link "View all" [ref=e79] [cursor=pointer]:
                    - /url: /discover
              - region "People to meet" [ref=e82]:
                - article [ref=e83]:
                  - generic [ref=e84]:
                    - generic "Student A" [ref=e85]: SA
                    - button "View Student A's profile" [ref=e87] [cursor=pointer]
                  - button [ref=e91] [cursor=pointer]:
                    - text: Student A
                    - img "College verified" [ref=e92]
                  - paragraph [ref=e95]:
                    - text: B.Tech
                    - generic [ref=e96]: · 2028
                  - paragraph [ref=e97]: A college with a deliberately long name to test small screens
                  - generic [ref=e101]:
                    - generic [ref=e102]: Web Development
                    - generic [ref=e103]: AI / Machine Learning
                    - generic [ref=e104]: LongSkillLongSkillLongSkillLongSkillLongSkillLongSkillLongSkillLongSkillLongSkillLongSkill
                  - generic [ref=e105]:
                    - text: "Looking for:"
                    - generic [ref=e107]: Project Teammates
                  - generic [ref=e108]: 1 shared interest
                  - generic [ref=e114]:
                    - button "Connect" [ref=e115] [cursor=pointer]
                    - button "Skip Student A" [ref=e117] [cursor=pointer]
                - article [ref=e121]:
                  - generic [ref=e122]:
                    - generic "Student B" [ref=e123]: SB
                    - button "View Student B's profile" [ref=e125] [cursor=pointer]
                  - button [ref=e129] [cursor=pointer]:
                    - text: Student B
                    - img "College verified" [ref=e130]
                  - paragraph [ref=e133]:
                    - text: B.Tech
                    - generic [ref=e134]: · 2028
                  - paragraph [ref=e135]: A college with a deliberately long name to test small screens
                  - generic [ref=e139]:
                    - generic [ref=e140]: Web Development
                    - generic [ref=e141]: AI / Machine Learning
                    - generic [ref=e142]: LongSkillLongSkillLongSkillLongSkillLongSkillLongSkillLongSkillLongSkillLongSkillLongSkill
                  - generic [ref=e143]:
                    - text: "Looking for:"
                    - generic [ref=e145]: Project Teammates
                  - generic [ref=e146]: 1 shared interest
                  - generic [ref=e152]:
                    - button "Connect" [ref=e153] [cursor=pointer]
                    - button "Skip Student B" [ref=e155] [cursor=pointer]
                - article [ref=e159]:
                  - generic [ref=e160]:
                    - generic "Student C" [ref=e161]: SC
                    - button "View Student C's profile" [ref=e163] [cursor=pointer]
                  - button [ref=e167] [cursor=pointer]:
                    - text: Student C
                    - img "College verified" [ref=e168]
                  - paragraph [ref=e171]:
                    - text: B.Tech
                    - generic [ref=e172]: · 2028
                  - paragraph [ref=e173]: A college with a deliberately long name to test small screens
                  - generic [ref=e177]:
                    - generic [ref=e178]: Web Development
                    - generic [ref=e179]: AI / Machine Learning
                    - generic [ref=e180]: LongSkillLongSkillLongSkillLongSkillLongSkillLongSkillLongSkillLongSkillLongSkillLongSkill
                  - generic [ref=e181]:
                    - text: "Looking for:"
                    - generic [ref=e183]: Project Teammates
                  - generic [ref=e184]: 1 shared interest
                  - generic [ref=e190]:
                    - button "Connect" [ref=e191] [cursor=pointer]
                    - button "Skip Student C" [ref=e193] [cursor=pointer]
                - article [ref=e197]:
                  - generic [ref=e198]:
                    - generic "Student D" [ref=e199]: SD
                    - button "View Student D's profile" [ref=e201] [cursor=pointer]
                  - button [ref=e205] [cursor=pointer]:
                    - text: Student D
                    - img "College verified" [ref=e206]
                  - paragraph [ref=e209]:
                    - text: B.Tech
                    - generic [ref=e210]: · 2028
                  - paragraph [ref=e211]: A college with a deliberately long name to test small screens
                  - generic [ref=e215]:
                    - generic [ref=e216]: Web Development
                    - generic [ref=e217]: AI / Machine Learning
                    - generic [ref=e218]: LongSkillLongSkillLongSkillLongSkillLongSkillLongSkillLongSkillLongSkillLongSkillLongSkill
                  - generic [ref=e219]:
                    - text: "Looking for:"
                    - generic [ref=e221]: Project Teammates
                  - generic [ref=e222]: 1 shared interest
                  - generic [ref=e228]:
                    - button "Connect" [ref=e229] [cursor=pointer]
                    - button "Skip Student D" [ref=e231] [cursor=pointer]
                - article [ref=e235]:
                  - generic [ref=e236]:
                    - generic "Student E" [ref=e237]: SE
                    - button "View Student E's profile" [ref=e239] [cursor=pointer]
                  - button [ref=e243] [cursor=pointer]:
                    - text: Student E
                    - img "College verified" [ref=e244]
                  - paragraph [ref=e247]:
                    - text: B.Tech
                    - generic [ref=e248]: · 2028
                  - paragraph [ref=e249]: A college with a deliberately long name to test small screens
                  - generic [ref=e253]:
                    - generic [ref=e254]: Web Development
                    - generic [ref=e255]: AI / Machine Learning
                    - generic [ref=e256]: LongSkillLongSkillLongSkillLongSkillLongSkillLongSkillLongSkillLongSkillLongSkillLongSkill
                  - generic [ref=e257]:
                    - text: "Looking for:"
                    - generic [ref=e259]: Project Teammates
                  - generic [ref=e260]: 1 shared interest
                  - generic [ref=e266]:
                    - button "Connect" [ref=e267] [cursor=pointer]
                    - button "Skip Student E" [ref=e269] [cursor=pointer]
                - article [ref=e273]:
                  - generic [ref=e274]:
                    - generic "Student F" [ref=e275]: SF
                    - button "View Student F's profile" [ref=e277] [cursor=pointer]
                  - button [ref=e281] [cursor=pointer]:
                    - text: Student F
                    - img "College verified" [ref=e282]
                  - paragraph [ref=e285]:
                    - text: B.Tech
                    - generic [ref=e286]: · 2028
                  - paragraph [ref=e287]: A college with a deliberately long name to test small screens
                  - generic [ref=e291]:
                    - generic [ref=e292]: Web Development
                    - generic [ref=e293]: AI / Machine Learning
                    - generic [ref=e294]: LongSkillLongSkillLongSkillLongSkillLongSkillLongSkillLongSkillLongSkillLongSkillLongSkill
                  - generic [ref=e295]:
                    - text: "Looking for:"
                    - generic [ref=e297]: Project Teammates
                  - generic [ref=e298]: 1 shared interest
                  - generic [ref=e304]:
                    - button "Connect" [ref=e305] [cursor=pointer]
                    - button "Skip Student F" [ref=e307] [cursor=pointer]
          - generic [ref=e311]:
            - generic [ref=e312]:
              - heading "Ideas" [level=2] [ref=e314]
              - link "Idea Board" [ref=e315] [cursor=pointer]:
                - /url: /ideas
            - article [ref=e319]:
              - generic [ref=e320]:
                - button "Student me Student me A college with a deliberately long name to test small screens · 6d ago" [ref=e321] [cursor=pointer]:
                  - generic "Student me" [ref=e322]: Sm
                  - generic [ref=e324]:
                    - strong [ref=e325]: Student me
                    - generic [ref=e326]:
                      - text: A college with a deliberately long name to test small screens
                      - generic [ref=e327]: · 6d ago
                - generic [ref=e328]: Technology
              - button "An idea for a better student community" [ref=e329] [cursor=pointer]
              - paragraph [ref=e330]: LongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescriptionLongDescription
              - generic [ref=e331]: React
              - generic [ref=e333]:
                - button "Resonances 0" [disabled] [ref=e334]:
                  - text: Resonances
                  - generic [ref=e337]: "0"
                - button "Manage idea" [ref=e338] [cursor=pointer]
    - navigation "Mobile navigation" [ref=e342]:
      - link "Home" [ref=e343] [cursor=pointer]:
        - /url: /
      - link "Discover" [ref=e348] [cursor=pointer]:
        - /url: /discover
      - link "Idea Board" [ref=e353] [cursor=pointer]:
        - /url: /ideas
      - button "More" [expanded] [ref=e357] [cursor=pointer]
  - dialog [ref=e360]:
    - generic [ref=e361]:
      - heading "More" [level=2] [ref=e362]
      - button "Close dialog" [active] [ref=e363] [cursor=pointer]
    - navigation "More destinations" [ref=e367]:
      - link "Events" [ref=e368] [cursor=pointer]:
        - /url: /events
      - link "Connections" [ref=e372] [cursor=pointer]:
        - /url: /connections
      - link "Messages" [ref=e379] [cursor=pointer]:
        - /url: /messages
      - link "Notifications" [ref=e383] [cursor=pointer]:
        - /url: /notifications
      - link "Profile" [ref=e388] [cursor=pointer]:
        - /url: /profile
      - link "Settings" [ref=e393] [cursor=pointer]:
        - /url: /profile#profile-settings
      - button "Log out" [ref=e398] [cursor=pointer]
  - generic "New activity"
```

# Test source

```ts
  144 |       const stream = new ReadableStream<Uint8Array>({
  145 |         start(controller) {
  146 |           const encoder = new TextEncoder();
  147 |           controller.enqueue(encoder.encode('event: ready\ndata: {}\n\n'));
  148 |           app.__emitActivity = (payload) =>
  149 |             controller.enqueue(
  150 |               encoder.encode(`event: notifications\ndata: ${JSON.stringify(payload)}\n\n`),
  151 |             );
  152 |           init?.signal?.addEventListener(
  153 |             'abort',
  154 |             () => {
  155 |               try {
  156 |                 controller.close();
  157 |               } catch {}
  158 |             },
  159 |             { once: true },
  160 |           );
  161 |         },
  162 |       });
  163 |       return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
  164 |     };
  165 |   });
  166 |   await page.route('**/api/**', async (route) => {
  167 |     const request = route.request(),
  168 |       path = new URL(request.url()).pathname;
  169 |     calls.push(`${request.method()} ${path}`);
  170 |     if (path === '/api/config') return route.fulfill({ json: { demo: true, configured: false } });
  171 |     if (path === '/api/state') return route.fulfill({ json: state });
  172 |     if (path.startsWith('/api/students/') && path.endsWith('/posts'))
  173 |       return route.fulfill({ json: { items: [], nextCursor: null } });
  174 |     if (path.startsWith('/api/students/')) return route.fulfill({ json: peer });
  175 |     if (path === '/api/recommendations/interactions') return route.fulfill({ json: { ok: true } });
  176 |     if (path === '/api/notifications' || path.startsWith('/api/notifications/')) {
  177 |       const id = path.split('/')[3];
  178 |       let count = 0;
  179 |       state.notifications = state.notifications.map((item) => {
  180 |         if (!item.readAt && (!id || id === item.id)) {
  181 |           count++;
  182 |           return { ...item, readAt: new Date().toISOString() };
  183 |         }
  184 |         return item;
  185 |       });
  186 |       state.notificationUnread = state.notifications.filter((item) => !item.readAt).length;
  187 |       return route.fulfill({
  188 |         json: { count, items: state.notifications, unreadCount: state.notificationUnread },
  189 |       });
  190 |     }
  191 |     if (path === '/api/connections' && request.method() === 'POST') {
  192 |       const { userId } = request.postDataJSON();
  193 |       actions.push(`connect:${userId}`);
  194 |       if (controls.fail) return route.fulfill({ status: 500, json: { error: 'Action failed' } });
  195 |       return route.fulfill({
  196 |         json: {
  197 |           id: `request-${userId}`,
  198 |           pairKey: `me:${userId}`,
  199 |           requesterId: 'me',
  200 |           receiverId: userId,
  201 |           status: 'PENDING',
  202 |           createdAt: date,
  203 |           updatedAt: date,
  204 |         },
  205 |       });
  206 |     }
  207 |     if (path.startsWith('/api/skips/') && request.method() === 'POST') {
  208 |       const id = path.split('/').pop()!;
  209 |       actions.push(`skip:${id}`);
  210 |       if (controls.fail) return route.fulfill({ status: 500, json: { error: 'Action failed' } });
  211 |       state.students = state.students.filter((item) => item.id !== id);
  212 |       state.totalStudents = state.students.length;
  213 |       return route.fulfill({ json: { userId: 'me', targetId: id } });
  214 |     }
  215 |     if (path.startsWith('/api/conversations/') && path.endsWith('/messages'))
  216 |       return route.fulfill({ json: [] });
  217 |     if (path === '/api/colleges') return route.fulfill({ json: [] });
  218 |     return route.fulfill({ json: { ok: true } });
  219 |   });
  220 |   return { state, calls, actions, controls };
  221 | }
  222 | export async function emitActivity(page: Page, snapshot: NotificationSnapshot) {
  223 |   await page.waitForFunction(
  224 |     () => typeof (window as unknown as { __emitActivity?: unknown }).__emitActivity === 'function',
  225 |   );
  226 |   await page.evaluate(
  227 |     (payload) =>
  228 |       (
  229 |         window as unknown as { __emitActivity: (payload: NotificationSnapshot) => void }
  230 |       ).__emitActivity(payload),
  231 |     snapshot,
  232 |   );
  233 | }
  234 | export async function navigateMobile(page: Page, path: string) {
  235 |   if (path === '/profile') {
  236 |     await page.locator('.topbar-profile').click();
  237 |   } else if (path === '/notifications') {
  238 |     await page.locator('.topbar a[href="/notifications"]').click();
  239 |   } else {
  240 |     const direct = page.locator(`.bottom-nav a[href="${path}"]`);
  241 |     if (await direct.count()) await direct.click();
  242 |     else {
  243 |       await page.getByRole('button', { name: /^More/ }).click();
> 244 |       await page.locator(`.mobile-more-sheet a[href="${path}"]`).click();
      |                                                                  ^ Error: locator.click: Test timeout of 45000ms exceeded.
  245 |     }
  246 |   }
  247 |   await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/$' : path.replace('/', '\/')}`));
  248 | }
  249 | export async function touchDrag(page: Page, x: number, y: number, dx: number, dy = 0) {
  250 |   const session = await page.context().newCDPSession(page);
  251 |   await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  252 |   for (let step = 1; step <= 12; step++) {
  253 |     await session.send('Input.dispatchTouchEvent', {
  254 |       type: 'touchMove',
  255 |       touchPoints: [{ x: x + (dx * step) / 12, y: y + (dy * step) / 12 }],
  256 |     });
  257 |     await page.waitForTimeout(16);
  258 |   }
  259 |   await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  260 |   await session.detach();
  261 | }
  262 | 
```