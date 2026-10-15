# Invites

**Roles:** head, invitee · **Data:** API

Registration is invite-only. The head enters an email and a role; the API emails a one-time link valid for 7 days;
the invitee sets a name, username and password and is signed in.

## Screens

| Route | Who | What it shows / does |
|---|---|---|
| `/people/invite` | head | Email + role (student, mentor, head). A role without a configured id is disabled with an explanation. After sending: "we emailed a link to …, valid until …". |
| People page and head home, "Invites" rail | head | Pending (not accepted) invites: email, role, expiry or "expired". |
| `/accept-invite?token=…` | public | Name, username, password, confirm. On success: signed in and sent home. Invalid, used or expired token: "this link no longer works" with sign-in and contact actions. |

## Behavior

- Role → backend role id via `NUXT_PUBLIC_ROLE_IDS_*` (no roles endpoint). Student invites are off until the backend
  has a student role (O2); students are then added to a cohort on the cohort page.
- An invite carries no cohort or program: placement happens after the account exists.
- The token never reaches the frontend except in the emailed link, so there is no copy-link and no revoke (O5).
- Username: 2–32 of `a–z 0–9 _` (the API's `USERNAME_PATTERN`; uppercase, dots and dashes are refused). Password: the API's policy, checked in the form
  (`app/utils/password.ts`, shared with password reset); the API's own message for the field is shown if it still refuses.
- Errors: `user_exists` → "a user with this email already exists"; `invite_invalid` → invalid-link state; taken
  username → "this username or email is already taken".

## API

| UI call (Nitro) | API calls | Notes |
|---|---|---|
| `POST /api/invites {email, role}` | `POST /invites/ {email, role_id}` | 422 `role_unavailable` when the role id is 0 |
| part of `/api/people`, `/api/dashboard/head` | `GET /invites/?limit=100` | Filters out accepted ones |
| `POST /api/invites/accept {token, name, username, password}` | `POST /invites/accept`, then sign-in | |

## Acceptance criteria

- [x] Head invites a mentor; the email arrives with an `/accept-invite?token=` link.
- [x] Accepting creates the account and signs the mentor in, in the mentor view.
- [x] A used token is rejected with the invalid-link state.
- [x] A student invite is refused while no student role id is configured, and the option is disabled.
- [x] An accepted invite no longer shows as pending.
- [x] A username with uppercase letters, dots or dashes is refused in the form, before calling the API.

## Known gaps

[O1](../open-items.md) role ids · [O2](../open-items.md) student invites · [O5](../open-items.md) invite preview, copy, revoke
