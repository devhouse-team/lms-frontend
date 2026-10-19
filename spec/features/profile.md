# My profile

**Roles:** everyone · **Data:** API

The signed-in user's own account page: who they are, which cohorts they belong to, and what they may change
themselves: name and username, password, and (built 2026-10-19) email, its verification, signing out of
every device and a link to email notification settings.

## Screens

| Route | Who | What it shows / does |
|---|---|---|
| `/me` | any signed-in user | Form: full name and username (Save is enabled once something changed). Form: current password, new password (same policy checks as reset), repeat. Rail: avatar, name, email with verified badge, the user's views (roles), cohorts with relation (student / mentor / reviewer) and enrollment status, programs they lead. Reached from the account menu in the sidebar ("My profile"). |
| `/me`, section **Email** (new) | any signed-in user | Current email and the verified badge. Unverified: a callout "Адрес не подтверждён" with **"Отправить письмо ещё раз"**. Then **"Сменить email"** (a disclosure button) opening a form: new email, current password, "Отправить ссылку". After sending, the form is replaced by "Мы отправили ссылку на {email}…" with "Отправить на другой адрес". |
| `/me`, section **Уведомления** (new) | any signed-in user | One line "Какие письма присылать — в настройках уведомлений" with a link to `/notifications#email` ([notifications](notifications.md)). |
| `/me`, section **Сеансы** (new) | any signed-in user | "Выйти на всех устройствах" (`color: error`, `variant: outline`) with the hint "Вы выйдете везде, включая это устройство." Opens a confirm modal. |
| `/confirm-email-change?token=…` (new) | anyone with the link (public, auth layout, client-only like `/verify-email`) | Target of the change-email email (crudauth's default path, the backend doesn't override it). States: pending (spinner "Подтверждаем адрес…"), done ("Email изменён" + the new address if signed in), invalid link, address taken, error with Retry. Button: signed in → "В профиль" (`/me`), else "Войти" (`/login`). |

Section order on `/me`: Profile, Email, Password, Notifications, Sessions (main column); the rail is unchanged.

## Behavior

- Name: 2 to 80 characters. Username: 2 to 32 of lowercase Latin letters, digits and underscore (same as invite acceptance).
  A taken username shows a field error (API 409).
- Saving updates the session copy (sidebar name) without a reload.
- Changing the password makes the API revoke this user's other sessions and tokens, this one's included. The route signs
  in again with the new password and keeps the view (role) that was open, so the user stays signed in. A wrong current
  password shows a field error.
- Avatar upload is not part of this page: the API has no upload purpose for it.

### Resend verification (new)

- Shown only while `emailVerified` is false. Sends `POST /auth/email/verify-request {email: <own email>}`. The API
  answers the same whether or not anything was sent (non-enumerable; skips verified addresses), so the UI always says
  "Письмо отправлено на {email}. Ссылка действует 24 часа." inline under the button (`role="status"`).
- After a send the button is disabled for 60 s ("Отправить ещё раз через {n} с"). The API limits it to 5 per hour per IP
  (`429` → `me.rateLimited`).
- The link opens the existing `/verify-email` ([account recovery](account-recovery.md)). Returning to `/me` refetches
  (`me` key) so the badge turns verified; no polling.

### Change email (new)

1. Form: new email (zod email, ≤ 254, must differ from the current one case-insensitively: "Это ваш текущий адрес"),
   current password (required).
2. `POST /api/me/email` → `POST /auth/email/change-request {new_email, password}` (no `redirect_to`). On 200 the form
   is replaced by: "Если адрес свободен, мы отправили на {email} ссылку для подтверждения. Она действует 24 часа. До
   подтверждения вход и письма — на {current}." The API never says whether the address is taken (by design).
3. The email links to `/confirm-email-change?token=…`. The page reads the token in `onMounted` (never during SSR: link
   scanners must not burn it), strips it from the URL (`router.replace({ query: {} })`), sets `<meta name="referrer"
   content="no-referrer">`, renders client-only (`routeRules: { '/confirm-email-change': { ssr: false } }`, as
   `/accept-invite`), and calls `POST /api/auth/email-change {token}`.
4. On success the API sets the new address **verified** and emails the old one ("Your email was changed"). It doesn't
   revoke tokens, so a signed-in session stays; the Nitro route, if there is a session, re-reads `/users/me` and
   updates the session copy's `email` (as `PATCH /api/me` does for the name), so the account menu shows the new
   address. Signing in afterwards uses the new email (or the username).
5. The link works once, for 24 hours, and dies if the password or email changes meanwhile (crudauth binds it to
   account state).

### Log out everywhere (new)

- Confirm modal: "Выйти на всех устройствах?" / "Все сеансы закончатся, на этом устройстве тоже. Войти снова можно
  паролем." Buttons "Выйти везде" (error) and "Отмена".
- `POST /api/auth/logout-all` → `POST /auth/logout-all` with the session's token: the API bumps the user's token
  version, so every access and refresh token dies. The Nitro route then clears the session (even if the API call
  failed with 401: the tokens are already dead). The page then runs what `useAuth().logout()` runs after its call
  (`clear()`, `clearNuxtData()`, `navigateTo('/login')`) and toasts "Вы вышли на всех устройствах".
- Other devices find out at their next API call (401 → their session is cleared → login), within the access token's
  lifetime at most; the notification poller makes that within a minute for an open tab.
- There is no list of devices: the API uses stateless bearer tokens; crudauth's `/sessions` exists only for its
  cookie-session transport, which the backend doesn't use.

## API

| UI call (Nitro) | API calls | Notes |
|---|---|---|
| `GET /api/me` | `GET /users/me`, `GET /me/access` | Roles come from the session |
| `PATCH /api/me` | `PATCH /users/{username}` | Only changed fields are sent |
| `POST /api/me/password` | `POST /auth/change-password`, then `POST /auth/token` + `GET /users/me`, `GET /me/access` | Re-signs in because the change evicts the old tokens |
| `POST /api/me/verify-email` (new) | `POST /auth/email/verify-request {email}` via `apiPublic` (forwards `X-Forwarded-For`; the email comes from `GET /users/me`, never from the client) | `requireUserSession`. → `{ok}` |
| `POST /api/me/email {newEmail, password}` (new) | `POST /auth/email/change-request {new_email, password}` via `apiFetch` (needs the bearer token) | zod: `newEmail` email ≤ 254, `password` 1–128. → `{ok}`; the API's `detail` is not passed through |
| `POST /api/auth/email-change {token}` (new, public) | `POST /auth/email/change-confirm {token}` via `apiPublic`; if a session exists, `GET /users/me` and `setUserSession` with the new `email` | zod: `token` 1–2000. → `{ok, email?: string}` (`email` only for a signed-in caller) |
| `POST /api/auth/logout-all` (new) | `POST /auth/logout-all`, then `clearUserSession` | `requireUserSession`. API `{detail}` → `{ok}` |

### Errors

Read with `apiError(e)`; crudauth's errors carry generic codes (`bad_request`, `validation_error`), so a few are told
apart by status and field, never by the English message except where noted.

| Call | Status / code | Meaning | Shown as |
|---|---|---|---|
| change-request | 400 `bad_request` | Wrong password (or "new email matches current", which the form prevents) | Field error on password: `me.wrongPassword` |
| change-request | 422 `validation_error`, field `new_email` | Malformed or too long | The API's message under the email field |
| change-request | 429 `rate_limited` | 3 per hour per IP | Alert `me.rateLimited` |
| change-confirm | 400 `bad_request` | Invalid, expired or used token | Invalid-link state (`LinkInvalid`): "Ссылка недействительна или устарела. Запросите смену email ещё раз в профиле." |
| change-confirm | 422 `validation_error` (message "Email already in use"; Nitro may turn it into 409) | The address got taken meanwhile | "Этот адрес уже занят другим аккаунтом. Ваш email не изменился." |
| verify-request | 429 `rate_limited` | 5 per hour per IP | Inline `me.rateLimited` |
| logout-all | 401 `unauthorized` | Already signed out | Treated as success (clear session, go to login) |
| any | 502 `api_unreachable` | | `auth.err.network` |
| any other | | | `common.saveError` |

### Cache keys

| Key | Fetched by | Holds |
|---|---|---|
| `me` | `/me` | `MeProfile` (unchanged; `emailVerified` drives the Email section) |

| Mutation | Refresh | Also |
|---|---|---|
| Resend verification, change-request | none (nothing changes until the link is opened) | — |
| Change confirmed (signed in) | `refreshSession()`; `me` is refetched on the next `/me` visit (`clearNuxtData('me')`) | — |
| Log out everywhere | — | `clearNuxtData()` (all) |

## i18n

Additions under `me.*` and `recovery.*`, both locales.

| Key | ru | en |
|---|---|---|
| `me.email` | Email | Email |
| `me.unverified` | Адрес не подтверждён. Подтвердите его, чтобы восстановить доступ, если забудете пароль. | Your address isn't confirmed. Confirm it so you can recover access if you forget your password. |
| `me.resend` | Отправить письмо ещё раз | Send the email again |
| `me.resendWait` | Отправить ещё раз через {n} с | Send again in {n} s |
| `me.resent` | Письмо отправлено на {email}. Ссылка действует 24 часа. | Email sent to {email}. The link works for 24 hours. |
| `me.changeEmail` | Сменить email | Change email |
| `me.newEmail` | Новый email | New email |
| `me.sameEmail` | Это ваш текущий адрес | That's your current address |
| `me.sendLink` | Отправить ссылку | Send the link |
| `me.changeSent` | Если адрес свободен, мы отправили на {email} ссылку для подтверждения. Она действует 24 часа. До подтверждения вход и письма — на {current}. | If the address is free, we've sent a confirmation link to {email}. It works for 24 hours. Until then, sign-in and emails stay on {current}. |
| `me.otherAddress` | Отправить на другой адрес | Use another address |
| `me.notifications` / `me.notificationsLink` | Уведомления / Какие письма присылать — в настройках уведомлений | Notifications / Choose which emails you get in notification settings |
| `me.sessions` | Сеансы | Sessions |
| `me.logoutAll` | Выйти на всех устройствах | Log out on all devices |
| `me.logoutAllHint` | Вы выйдете везде, включая это устройство. | You'll be signed out everywhere, this device included. |
| `me.logoutAllTitle` / `.logoutAllText` | Выйти на всех устройствах? / Все сеансы закончатся, на этом устройстве тоже. Войти снова можно паролем. | Log out on all devices? / Every session ends, this one too. You can sign in again with your password. |
| `me.logoutAllConfirm` | Выйти везде | Log out everywhere |
| `me.loggedOutAll` | Вы вышли на всех устройствах | You've been logged out on all devices |
| `recovery.emailChange.title` | Смена email | Email change |
| `recovery.emailChange.pending` | Подтверждаем адрес… | Confirming your address… |
| `recovery.emailChange.done` | Email изменён | Email changed |
| `recovery.emailChange.doneTo` | Теперь ваш адрес — {email}. | Your address is now {email}. |
| `recovery.emailChange.invalid` | Ссылка недействительна или устарела. Запросите смену email ещё раз в профиле. | The link is invalid or has expired. Request the email change again from your profile. |
| `recovery.emailChange.taken` | Этот адрес уже занят другим аккаунтом. Ваш email не изменился. | That address now belongs to another account. Your email hasn't changed. |
| `recovery.toProfile` | В профиль | To my profile |

`resendWait` counts down seconds; no plural forms needed with "с" / "s". Remember `{'@'}` if a placeholder holds an
address example.

## Accessibility

- Each new section is a `<section aria-labelledby>` with an `h2`, as the existing ones.
- "Сменить email" is a button with `aria-expanded` controlling the form; focus moves to the new-email input on open and
  to the confirmation text (`role="status"`, `tabindex="-1"`) after sending.
- Inline results (resent, change sent) use `role="status"`; errors use field errors (`UFormField` `error`) or
  `role="alert"`.
- The countdown on the resend button updates its label at most every second and is not announced each tick
  (`aria-live` off on the button; the status line says it was sent).
- The logout-all modal is a `UModal` (focus trap, Esc cancels, initial focus on "Отмена", the destructive button is
  never the default).
- `/confirm-email-change` states are announced (`role="status"` for pending / done, `LinkInvalid` for invalid), as
  `/verify-email`.

## Acceptance criteria

- [ ] Renaming updates the sidebar immediately; a taken username shows an error under the field.
- [ ] After a password change the user can keep navigating (no redirect to login) and signs in with the new password later.
- [ ] A user with several views keeps the active one after changing the password.
(Typechecked; not yet run against a backend.)

Account settings (new; e2e = `scripts/e2e-smoke.py` against a local backend with Mailpit, the rest in a browser):

- [ ] An unverified user sees the callout; "Send the email again" shows the sent line, disables the button for 60 s,
      and Mailpit has a link to `/verify-email?token=…` (e2e). A verified user sees no callout.
- [ ] The sixth resend within an hour shows the rate-limit message.
- [x] Change email with a wrong password shows the error under the password; with the current address, the form refuses ✓ e2e (400) + form rule in code
      before any request.
- [x] A valid change shows "If the address is free…"; Mailpit has a link to `/confirm-email-change?token=…` at the new
      address (e2e: path and recipient). ✓ e2e
- [x] Opening that link while signed in shows "Email changed" with the new address, the account menu shows it without
      a reload, the badge is verified, and the old address got "Your email was changed" (e2e: `GET /users/me` email and
      `email_verified`). ✓ e2e (API) + session copy updated
- [x] Opening it a second time, or a bogus token, shows the invalid state; the URL has no `token` after load. ✓ e2e (400) + browser (bogus token, URL stripped, not in HTML)
- [ ] Opening it after another account took the address shows the "taken" state and the email is unchanged.
- [x] Log out everywhere: after confirming, this browser is on `/login` with the toast; a second browser signed in ✓ e2e (both sessions 401)
      earlier lands on `/login` at its next navigation (e2e: an old access token gets 401 after `logout-all`).
- [ ] The notifications link opens `/notifications` at the email section.

## Known gaps

Backend limits on name and username are not in `openapi.json`; the bounds above are copied from invite acceptance.
Whether the password change keeps the current refresh token alive is unverified, which is why the route signs in again.
[O30](../open-items.md): an OAuth-only account has no password, so it can't change its email here (crudauth needs the password) and the API
has no field saying whether a password is set; the form shows the API's wrong-password error for them. No device list
(stateless tokens). Email texts are English (backend D8).
