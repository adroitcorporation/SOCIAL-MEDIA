# Application structure

Founder Circle remains one Next.js application with the same routes and behavior. The source is separated by responsibility; separate hosting is not required.

```text
src/
├── app/                         Next.js entry points only
│   ├── [[...page]]/page.tsx      Page routing adapter
│   ├── api/[[...path]]/route.ts  API routing adapter
│   ├── api/live/route.ts        Live-stream adapter
│   └── layout.tsx              Framework layout and metadata
├── backend/
│   ├── auth/session.ts         Server token verification and demo guard
│   ├── database/
│   │   ├── client.ts           Prisma client
│   │   ├── transaction.ts      Serializable transactions and retries
│   │   └── prisma/             Schema, migrations, and guarded demo seed
│   ├── http/                   Request parsing, security middleware,
│   │                           endpoint handlers, presenters, and errors
│   ├── services/               Connection, conversation, discovery, idea,
│   │                           message, profile, event, and notification rules
│   ├── types/                  Database and server-only helper types
│   └── utils/                  Server errors and assertions
├── frontend/
│   ├── api/                    Typed endpoint client, HTTP transport, live updates
│   ├── auth/                   Browser session and Supabase SDK adapter
│   ├── components/             App shell and reusable UI
│   ├── features/               Auth, discovery, connections, ideas, messages,
│   │                           events, notifications, and profile screens/forms
│   ├── hooks/                  Session/data controller and mutation lifecycle
│   ├── pages/                  Home, error, and not-found UI
│   ├── state/                  React context
│   ├── styles/                 Global styles
│   └── utils/                  Display utilities
└── shared/
    ├── contracts/              Request/response DTOs, enums, pure Zod schemas
    └── config/brand.ts         Product name and description
```

## Dependency direction

Both backend and frontend may import `shared`. They cannot import each other. Shared contracts contain no Prisma, React, database, session, or platform dependencies. Browser auth belongs to the frontend adapter; trusted identity verification and authorization belong to the backend.

The `app` folder exists because Next.js requires these entry points. API route files call backend handlers; page files render frontend UI. Business rules, database access, and interactive UI implementations live in their respective layers.

```text
UI → frontend hook/context → typed API client → HTTP
                                                ↓
                         backend handler → service → Prisma

                  frontend → shared ← backend
```

`npm run check:boundaries` checks imports, including type-only imports and re-exports, and runs in CI. Backend database/auth entry points also use Next.js `server-only` guards. Vitest replaces this guard with a test-only empty module so Node tests can exercise server code.

## HTTP contract

`shared/contracts/requests.ts` and `responses.ts` define the wire types. Dates are ISO-8601 strings; database `Date` values never appear in frontend types. Shared validation schemas describe inputs, and the backend always validates untrusted requests. Backend presenters check service results against explicit response DTOs at compile time and retain the existing JSON shape.

The existing `/api/*` paths, HTTP methods, status codes, and response payloads are unchanged. Successful endpoints return their resource, list, `{ ok: true }`, or `{ count }`; errors remain `{ error: string }`. The endpoint table is in [README.md](README.md#api).

UI code calls named methods such as `api.ideas.resonate(id, { enabled: true })`. `frontend/api/community-client.ts` owns endpoint paths and DTO mappings. `http-client.ts` owns bearer headers, JSON encoding, error handling, and the base URL. Live-stream connection/retry handling lives beside it in `live-updates.ts`.

## Connecting or replacing services

Production Vercel deployments forward `/api/:path*` to `https://founder-circle-backend.onrender.com/api/:path*` through a `beforeFiles` rewrite in `next.config.ts`. This includes `/api/live`. The browser continues using same-origin `/api` URLs, and its bearer token, request body, and origin pass through to Render. Render's `APP_URL` is `https://lnmiitsocialmedia.vercel.app`, so mutation origin checks remain enforced.

Set the build-time `BACKEND_URL` on the frontend deployment to override the destination. Leave it unset on Render to avoid proxying the backend back to itself. Local development and previews keep their local handlers unless this override is explicitly configured. No frontend database connection is needed for requests routed to Render.

The app's composition point is `frontend/hooks/use-circle-controller.ts`. It creates the API client, supplies the browser access token, and manages client state. A replacement backend can implement the same contracts without changing UI components:

```ts
const api = createCommunityClient(
  createHttpClient({
    baseUrl: '/api',
    getAccessToken: async () => (await browserAuth.session()).accessToken,
    onUnauthorized: handleExpiredSession,
  }),
);
```

Change the base URL for both the public configuration client and authenticated client at this composition point. The factory accepts a custom `fetch` implementation for tests or another transport host. For separate origins, configure backend CORS/preflight handling, the allowed mutation origin, and the frontend CSP before enabling that deployment. The current deployment intentionally retains its existing same-origin security rules.

To replace authentication, change `frontend/auth/browser-auth.ts` and `backend/auth/session.ts`; screens do not depend on the Supabase SDK. To replace persistence, change backend services/database modules and preserve their HTTP DTOs. The backend uses standard `Request` and `Response` handlers, so another server framework can adapt them without importing UI code.

## Adding a feature

1. Define the minimal shared input/output contract and validation schema.
2. Add backend service logic and expose it through a backend HTTP handler.
3. Add a typed method to the frontend API client.
4. Build the feature UI using that method and shared DTOs.
5. Run boundary checks, TypeScript, relevant tests, and the production build.

All Prisma commands in `package.json` point to `src/backend/database/prisma/schema.prisma`. The SQL migrations and database schema are unchanged by this refactor; no data migration or reset is needed.
