# Architecture

Nuxt 4 + Vue 3 + Nuxt UI 4 + Tailwind 4, i18n (ru default, en). Deployed on Vercel at `https://lms.devhouse.kz`;
the API is `https://api.devhouse.kz/api/v1` (same site, so cookies and CORS aren't an issue).

## Request flow

```
browser ──/api/*──▶ Nitro route (server/api) ──▶ server/utils/api.ts ──Bearer──▶ LMS API
   ▲                      │ maps API data to view models (server/utils/lms.ts, shared/types/index.ts)
   └── JSON view model ◀──┘
```

- **Nitro is the only API client (BFF)**, per backend decision D1. Pages never call the API directly and never see
  tokens. Server-side rendering works because Nitro holds the credentials.
- Pages and components consume **view models** from `shared/types/index.ts`, not API schemas. API types come from
  `shared/types/api.d.ts` (`npm run api:types` after the backend changes `openapi.json`). Mapping lives in
  `server/utils/lms.ts`; route handlers stay thin.
- IDs are the API's integers sent as strings. `apiId()` turns a route param back into an integer and answers 404 for
  anything else. Student-side assignment ids are `${cohortId}-${lessonId}` (the API keys them that way).

## Sessions and tokens

| Piece | Where |
|---|---|
| Access token (15 min) and refresh token (7 days) | Sealed `nuxt-session` cookie, `secure` part (server only) |
| User: id, name, email, username, avatar, `roles`, active `role` | Same cookie, public part (`useUserSession()`) |

- `signIn()` posts to `/auth/token` (form), takes the refresh token from `Set-Cookie`, then loads `/users/me` and
  `/me/access`.
- `apiFetch()` refreshes the access token when it is about to expire or a call returns 401, at most once per
  incoming request, then retries. If the refresh fails, the session is cleared and the route answers 401.
  The client plugin `session-expiry.client.ts` sends the user to `/login?expired=1`.
- Refresh tokens don't rotate (stateless), so a refresh written during SSR but not delivered to the browser is
  harmless.
- Nitro forwards the browser IP in `X-Forwarded-For`; the API only trusts it once configured (open item O3).

## Errors

API errors arrive as `{error: {code, message_key, message, details, support_id}}`. `toH3Error()` rethrows them as H3
errors: `statusMessage` = `code`, `data` = the error detail. These codes become **409** so pages can treat
them as "already exists / already done": `submission_pending`, `enrollment_exists`, `user_exists`, `slug_taken`,
`course_slug_taken`, `invalid_transition`, `not_reviewable`. Use `apiFind()` when 403/404 should mean "nothing here"
rather than an error.

## The remaining mock

`server/utils/db.ts` is an in-memory store for features with no API yet (see
[features/mock-features.md](features/mock-features.md)). It is keyed by the real user id, resets on restart and is not
shared between server instances. Pages backed by it pass `mock` to `AppPage`, which shows the "Demo data" badge.

## Config

| Variable | Default | Purpose |
|---|---|---|
| `NUXT_SESSION_PASSWORD` | (required) | Seals the session cookie, 32+ characters |
| `NUXT_API_BASE` | `https://api.devhouse.kz/api/v1` | API base URL; `http://localhost:8000/api/v1` for a local backend |
| `NUXT_PUBLIC_ROLE_IDS_HEAD` | `1` | Backend `admin` role id, granted by head invites |
| `NUXT_PUBLIC_ROLE_IDS_MENTOR` | `2` | Backend `mentor` role id |
| `NUXT_PUBLIC_ROLE_IDS_MENTEE` | `0` | Student role id; `0` disables student invites (no such role yet) |

Role ids differ per database (a local one had 3 and 4): set them per environment (open item O1).

## Layout

| Path | Contents |
|---|---|
| `app/pages`, `app/components`, `app/layouts` | UI; `AppPage` is the page shell |
| `app/middleware/auth.global.ts` | Redirects to login; `definePageMeta({ roles, public })` |
| `server/api/**` | One handler per UI call |
| `server/utils/api.ts` | API client, token refresh, error mapping |
| `server/utils/auth.ts` | `signIn`, `rolesOf`, `requireRole` |
| `server/utils/lms.ts` | API → view model mapping, shared queries |
| `server/utils/db.ts`, `server/data/` | Mock store, static program syllabus |
| `shared/types/` | View models (`index.ts`), API types (`api.d.ts`, generated), session types |

## Verifying

- `npm run typecheck`
- End to end against a local backend (`../backend`, see its README): start it with Docker, run the frontend with
  `NUXT_API_BASE=http://localhost:8000/api/v1` and the local role ids on port 3123, then run
  `python3 -I scripts/e2e-smoke.py`. It seeds a program, course and lessons straight on the API and drives every role
  through Nitro. Registration is limited to 5 per hour per IP, so it can be run about 5 times an hour.
- `python3 -I scripts/e2e-recovery.py`: password reset and email verification, reading the emails from Mailpit
  (1 registration and 2 of the 5 hourly reset requests per run).
