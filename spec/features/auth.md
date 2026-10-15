# Auth and roles

**Roles:** everyone · **Data:** API

Sign in, stay signed in for a working week, and land in the right view. One account can hold several views.

## Screens

| Route | Who | What it shows / does |
|---|---|---|
| `/login` | public | Email-or-username + password. Errors: wrong credentials, rate limited, network, session expired (`?expired=1`). Link to the academy's Telegram for people without an account. |
| User menu (sidebar footer) | signed in | Email, language, view switcher when the account has more than one view, sign out. |

## Behavior

- **Views** come from `GET /me/access` at sign-in, most privileged first:
  - `head`: `is_superuser`, or `roles` contains `admin`
  - `mentor`: `roles` contains `mentor`, or any cohort relation `mentor` / `reviewer`
  - `mentee`: any cohort relation `student`
  - nothing matched → `mentee`
- The first view is active. Switching (`POST /api/auth/role`) clears cached data and goes home.
- Views are re-read only at sign-in: a new relation (e.g. made mentor of a cohort) shows after signing in again.
- Pages declare `definePageMeta({ roles })`; the middleware answers 403 for other views and sends signed-out users to
  `/login?next=…`. Nitro routes check the view again (`requireRole`); the API is the final authority.
- Signing out clears the session cookie. The API's tokens are stateless and simply expire.
- Telegram login and demo accounts were removed: they could only create sessions without API tokens.

## API

| UI call (Nitro) | API calls | Notes |
|---|---|---|
| `POST /api/auth/login {login, password}` | `POST /auth/token` (form), `GET /users/me`, `GET /me/access` | Refresh token taken from `Set-Cookie` |
| `POST /api/auth/role {role}` | none | Must be one of the session's `roles` |
| `POST /api/auth/logout` | none | Clears the session |
| any authenticated call | `POST /auth/refresh` when needed | See [architecture](../architecture.md#sessions-and-tokens) |

## Acceptance criteria

- [x] Head signs in with a username, student with an email; each lands in their view.
- [x] Wrong credentials show "wrong username or password"; the API's lockout (429) shows "too many attempts".
- [x] The browser's session data has the user but no tokens.
- [x] After sign-out, API-backed routes answer 401.
- [ ] An expired access token is refreshed transparently (refresh request shape verified against the API; the
      in-app expiry path not yet exercised end to end).
- [ ] When the refresh fails, the user lands on `/login` with the "session expired" message.
- [ ] An account with two views sees the switcher and can change view.

## Known gaps

[O3](../open-items.md) login lockout per IP. Password reset and email verification: [account-recovery](account-recovery.md).
