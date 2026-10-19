# LMTLSS API — what is built, what is configured, what is not

**Status:** implemented and tested locally; **not deployed**, and not yet callable from the web app.
**Stack:** one dependency-free Cloudflare Worker (`src/worker.js`) on D1 (SQLite). No framework, no ORM, no npm runtime dependencies — the same constraint the web app follows.

## Run it

```bash
npm run test:server              # 60 tests, in-memory SQLite, no install step
node --test "server/tests/**/*.test.js"
```

There is nothing to install: the tests use Node's built-in SQLite (`node:sqlite`), which speaks the same dialect as D1, so the SQL, constraints and authorization rules under test are the ones that will run in production. The Worker entry point and the D1 adapter are covered too — `tests/worker.test.js` drives the real `fetch` handler and runs a full club + event flow through a D1-shaped binding.

## Deploy it (when you have the database)

```bash
npx wrangler d1 create lmtlss                       # copy the database_id into wrangler.toml
npx wrangler d1 execute lmtlss --remote --file=server/schema/0001_init.sql
npx wrangler secret put AUTH_JWT_SECRET             # 32+ random bytes, from your identity provider
npx wrangler deploy --config server/wrangler.toml
```

`ASSETS` is optional: bind it and the Worker serves the static web app from the same origin as the API. If you bind it, copy the static files (`index.html`, `css/`, `js/`, `logo/`) into a dedicated directory first — never point the assets directory at the repository root, which would publish `server/`, `docs/` and the test pages.

## Configuration

| Variable | Needed for | Unset behaviour |
|---|---|---|
| `AUTH_JWT_SECRET` | verifying bearer tokens (HS256) | protected routes answer `503 auth_not_configured`; public reads still work |
| `AUTH_ISSUER`, `AUTH_AUDIENCE` | rejecting tokens minted for another service | checked only when set |
| `ALLOWED_ORIGIN` | a web origin different from the API's | same-origin only; no CORS headers are ever sent to other origins |
| `DB` (D1 binding) | everything | the Worker cannot start |

**Auth is a seam, not a product.** Any provider that can sign an HS256 JWT plugs in by setting those variables; no provider is shipped and no sign-in screen exists, so today there is no way for a real athlete to obtain a token. That is deliberate: issuing fake sessions would be exactly the "working control that isn't" the project forbids. The test suite exercises the real verification path by signing tokens itself.

## Endpoints implemented

| Area | Endpoints |
|---|---|
| Health | `GET /api/health` |
| Identity | `GET/PATCH /api/me`, `POST /api/me/sports`, `DELETE /api/me/sports/:sport`, `GET /api/athletes/:id`, `GET /api/athletes/:id/workouts`, `GET /api/me/export`, `DELETE /api/me` |
| Notifications | `GET /api/notifications`, `POST /api/notifications/read` |
| Clubs | `GET/POST /api/communities`, `GET /api/communities/:id`, `POST /api/communities/:id/join`, `POST /api/communities/:id/leave`, `GET /api/communities/:id/members`, `POST /api/communities/:id/members/:userId/approve`, `.../role`, `.../ban`, `GET/POST /api/communities/:id/posts`, `DELETE /api/posts/:postId`, `GET /api/me/communities`, `GET /api/communities/:id/events` |
| Events | `GET/POST /api/events`, `GET /api/events/:id`, `POST /api/events/:id/register`, `POST /api/events/:id/cancel-registration`, `GET /api/events/:id/registrations`, `POST /api/events/:id/check-in`, `POST /api/events/:id/cancel` |
| Moderation | `POST /api/reports` |

## Rules the tests pin down

- **Capacity is never oversold.** The seat is claimed with one conditional `INSERT`, so two simultaneous registrations cannot both take the last seat; duplicates are a no-op, and a cancellation promotes the first athlete on the waitlist in the same request.
- **Membership is the only key.** Private communities are absent from discovery, their detail is `404` for outsiders, a pending member reads nothing, admins are the only ones who approve or announce, and only the owner changes roles.
- **Roles come from the database.** A token claiming `platform_role: admin` is ignored; the stored row is the only source of truth.
- **Paid features fail closed.** A priced event is refused with `payments_not_configured` rather than pretending to charge.
- **Ratios are bounded.** Every list endpoint clamps its page size; abuse-prone actions (community/event creation, posting, registering, reporting) are rate limited per athlete.
- **Deletion is explicit and complete.** `DELETE /api/me` requires `{"confirm":"delete"}`, refuses while the account still owns communities, and purges presence data, sports, notifications and profile identifiers.
- **Errors leak nothing.** Unknown routes, validation problems and unexpected failures all return `{ error: { code, message } }`; a server fault never returns a stack trace, SQL or provider text.

## Not implemented yet

Honest list — these are specified, have schema where noted, and have **no endpoints**:

| Module | State |
|---|---|
| Coach profiles + $29/mo subscription | schema only (`coaches`, `coach_*`, `subscriptions`, `webhook_events`) — no routes, no Stripe call, no webhook handler, no entitlement check on any endpoint |
| Store | schema only (`products`, `product_variants`, `carts`, `cart_items`, `orders`, `order_items`) |
| Map / presence | schema only (`facilities`, `location_prefs`, `location_shares`) — no share endpoint, no hotspot aggregation, no map provider |
| Activity sync | no endpoint that writes `activities` yet; the web app still owns the athlete's log locally |
| Web client | the web app makes **zero** network calls; nothing here is reachable from the UI yet |
| Notifications delivery | rows are written and readable; no email/push transport |
| Real D1 / workerd | the D1 adapter (`src/db.js`) is covered by a D1-shaped binding shim (`tests/worker.test.js`), which proves the adapter maps onto D1's documented surface — **not** that Cloudflare's runtime behaves like it. No test has run in workerd. `wrangler dev --local` is the next check before any deploy |

## Layout

```
server/
  schema/0001_init.sql   full DDL, applied once, recorded in schema_migrations
  src/db.js              D1 + node:sqlite behind one interface
  src/migrate.js         migration runner (all-or-nothing per migration)
  src/http.js            router, validation, one error shape
  src/auth.js            bearer verification, JIT provisioning, role from the DB
  src/rate.js            fixed-window counters in the database
  src/access.js          membership/admin authorization helpers
  src/routes/*.js        communities, events, identity
  src/api.js             pipeline + error mapping
  src/worker.js          Worker entry: /api/* then static assets
  tests/*.test.js        node:test suites against in-memory SQLite
```
