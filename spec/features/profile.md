# My profile

**Roles:** everyone · **Data:** API

The signed-in user's own account page: who they are, which cohorts they belong to, and the two things they may change
themselves, their name and username and their password.

## Screens

| Route | Who | What it shows / does |
|---|---|---|
| `/me` | any signed-in user | Form: full name and username (Save is enabled once something changed). Form: current password, new password (same policy checks as reset), repeat. Rail: avatar, name, email with verified badge, the user's views (roles), cohorts with relation (student / mentor / reviewer) and enrollment status, programs they lead. Reached from the account menu in the sidebar ("My profile"). |

## Behavior

- Name: 2 to 80 characters. Username: 2 to 32 of lowercase Latin letters, digits and underscore (same as invite acceptance).
  A taken username shows a field error (API 409).
- Saving updates the session copy (sidebar name) without a reload.
- Changing the password makes the API revoke this user's other sessions and tokens, this one's included. The route signs
  in again with the new password and keeps the view (role) that was open, so the user stays signed in. A wrong current
  password shows a field error.
- Email change and avatar upload are not part of this page: the first needs the confirm-link flow, the second has no
  upload purpose in the API.

## API

| UI call (Nitro) | API calls | Notes |
|---|---|---|
| `GET /api/me` | `GET /users/me`, `GET /me/access` | Roles come from the session |
| `PATCH /api/me` | `PATCH /users/{username}` | Only changed fields are sent |
| `POST /api/me/password` | `POST /auth/change-password`, then `POST /auth/token` + `GET /users/me`, `GET /me/access` | Re-signs in because the change evicts the old tokens |

## Acceptance criteria

- [ ] Renaming updates the sidebar immediately; a taken username shows an error under the field.
- [ ] After a password change the user can keep navigating (no redirect to login) and signs in with the new password later.
- [ ] A user with several views keeps the active one after changing the password.
(Typechecked; not yet run against a backend.)

## Known gaps

Backend limits on name and username are not in `openapi.json`; the bounds above are copied from invite acceptance.
Whether the password change keeps the current refresh token alive is unverified, which is why the route signs in again.
