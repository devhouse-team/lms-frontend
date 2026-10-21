# Architecture

Nuxt 4 + Vue 3 + Nuxt UI 4 + Tailwind 4, i18n (ru default, en). Deployed on Vercel at `https://lms.devhouse.kz`;
the API is `https://api.devhouse.kz/api/v1` (same site, so cookies and CORS aren't an issue).

## Request flow

```
browser ──────────────Bearer──────────────▶ LMS API (api.devhouse.kz)
   │  app/api/router.ts runs app/api/routes/* in the browser; they map API data to view models
   ├─ /api/mock/*, contests, career, sessions ──▶ Nitro (server/api, in-memory mock)
   └─ <img>/<a> /api/files/* ──▶ Nitro ──one call──▶ API ──302──▶ signed storage URL
```

- **The browser is the API's client** (SPA, `ssr: false`). `app/api/router.ts` replaces `globalThis.$fetch`: a
  `/api/…` URL that matches a file in `app/api/routes` runs that handler in the browser (same file naming as Nitro:
  `[id]`, `[...path]`, `.get/.post` suffix). Call sites (`useFetch('/api/cohorts')`) did not change. Anything else
  goes to Nitro, tagged with `x-mock-user/role/scope` headers.
- The API must allow this site's origin (CORS, with credentials). `https://lms.devhouse.kz` is allowed.
  There is no proxy, in dev either: for `http://localhost:3000` the backend must allow that origin and issue the refresh
  cookie with `SameSite=None; Secure`, or point `NUXT_PUBLIC_API_BASE` at a local backend.
- Pages and components consume **view models** from `shared/types/index.ts`, not API schemas. API types come from
  `shared/types/api.d.ts` (`npm run api:types`). Mapping lives in `app/api/utils/lms.ts`; handlers stay thin.
- `modules/api-routes.ts` generates `InternalApi` types for the browser routes, so `useFetch` stays typed.
- Handlers use h3-style helpers from `app/api/utils/h3.ts` (`readValidatedBody`, `getRouterParam`…), imported
  explicitly. The other `app/api/utils/*` exports are auto-imported through `app/utils/lmsApi.ts`.
- IDs are the API's integers sent as strings. `apiId()` turns a route param back into an integer and answers 404 for
  anything else. Student-side assignment ids are `${cohortId}-${lessonId}` (the API keys them that way).

## Sessions and tokens

| Piece | Where |
|---|---|
| Access token (15 min) | Module memory (`app/api/utils/session.ts`), never in storage |
| Refresh token (7 days) | The API's httpOnly cookie; `POST /auth/refresh` with credentials |
| User: id, name, email, username, avatar, `roles`, active `role` | `useUserSession()` (memory); chosen `role` in `localStorage` |
| Access token mirror | `lms_at` cookie, path `/api/files`, SameSite=Strict, for Nitro's file redirect only |

- `signIn()` posts to `/auth/token` (form; the API sets the refresh cookie), then loads `/users/me` and `/me/access`.
- On every page load the `api-router` plugin calls `restoreSession()` (only when `localStorage['lms.session']` is
  set): the cookie buys an access token, then the user is rebuilt. Needs a cookie the browser sends to the API: same
  site as the frontend (prod), or a cookie the backend allows cross-site.
- `apiFetch()` refreshes when the token is about to expire or a call returns 401, one refresh at a time, then
  retries. If the refresh fails the session is cleared and the router sends the user to `/login?expired=1`.
- A timer renews the token a minute before expiry so file links keep working on an idle page.

## Errors

API errors arrive as `{error: {code, message_key, message, details, support_id}}`. `toH3Error()` rethrows them as
`$fetch`-shaped errors: `statusMessage` = `code`, `data` = the error detail. These codes become **409** so pages can treat
them as "already exists / already done": `submission_pending`, `enrollment_exists`, `user_exists`, `slug_taken`,
`course_slug_taken`, `invalid_transition`, `not_reviewable`. Use `apiFind()` when 403/404 should mean "nothing here"
rather than an error.

## The remaining mock

`server/utils/db.ts` is an in-memory store for features with no API yet (see
[features/mock-features.md](features/mock-features.md)). It is keyed by the real user id (sent in `x-mock-*` headers, no session), resets on restart and is not
shared between server instances. Pages backed by it pass `mock` to `AppPage`, which shows the "Demo data" badge.

## Config

| Variable | Default | Purpose |
|---|---|---|
| `NUXT_PUBLIC_API_BASE` | `https://api.devhouse.kz/api/v1` | API URL the browser calls |
| `NUXT_API_BASE` | same | API URL Nitro uses for the file redirect |
| `NUXT_PUBLIC_ROLE_IDS_HEAD` | `1` | Backend `admin` role id, granted by head invites |
| `NUXT_PUBLIC_ROLE_IDS_MENTOR` | `2` | Backend `mentor` role id |
| `NUXT_PUBLIC_ROLE_IDS_MENTEE` | `0` | Student role id; `0` disables student invites (no such role yet) |

Role ids differ per database (a local one had 3 and 4): set them per environment (open item O1).

## Layout

| Path | Contents |
|---|---|
| `app/pages`, `app/components`, `app/layouts` | UI; `AppPage` is the page shell |
| `app/middleware/auth.global.ts` | Redirects to login; `definePageMeta({ roles, public })` |
| `app/api/routes/**` | One browser-side handler per UI call (talks to the API) |
| `app/api/router.ts` | Routes `$fetch('/api/…')` to those handlers, else to Nitro |
| `app/api/utils/api.ts`, `session.ts` | API client, token refresh, in-memory session |
| `app/api/utils/auth.ts`, `lms.ts` | `signIn`, `rolesOf`, `requireRole`; API → view model mapping |
| `server/api/**` | Nitro: mock features (`contests`, `career`, `sessions`, `mock`) and `files/*` redirects |
| `server/utils/db.ts` | Mock store |
| `shared/types/` | View models (`index.ts`), API types (`api.d.ts`, generated), session types |

## Verifying

- `npm run typecheck`
- End to end against a local backend (`../backend`, see its README): start it with Docker, run the frontend with
  `NUXT_API_BASE=http://localhost:8000/api/v1` and the local role ids on port 3123, then run
  `python3 -I scripts/e2e-smoke.py`. It seeds a program, course and lessons straight on the API and drives every role
  through Nitro. Registration is limited to 5 per hour per IP, so it can be run about 5 times an hour.
- `python3 -I scripts/e2e-recovery.py`: password reset and email verification, reading the emails from Mailpit
  (1 registration and 2 of the 5 hourly reset requests per run).
