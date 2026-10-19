# Password reset and email verification

**Roles:** everyone (public pages) · **Data:** API

Someone who forgot their password gets a link by email and sets a new one without contacting the academy. Links the
API emails (`/reset-password?token=…`, `/verify-email?token=…`) open a working page instead of the 404 catch-all.

## Screens

| Route | Who | What it shows / does |
|---|---|---|
| `/login` | public | Adds a "Forgot password?" link under the password field → `/forgot-password`, prefilled with the login field when it holds an email. |
| `/forgot-password` | public | Email field, "Send link". After sending, always: "If an account exists for {email}, we sent a link. It works for 1 hour." with "Back to sign in". |
| `/reset-password?token=…` | public | New password + repeat. On success: "Password changed" and a "Sign in" button to `/login`. Invalid, used or expired token: "this link no longer works" with "Request a new link" (`/forgot-password`). |
| `/verify-email?token=…` | public | Confirms on page load; no form. Success: "Email confirmed" + "Continue" (home when signed in, else `/login`). Failure: "this link no longer works". |

All four use `layout: 'auth'` and `public: true`, like `/login` and `/accept-invite`.

## Behavior

- **No enumeration.** `/forgot-password` shows the same message whether or not the email has an account; never say
  "no such user". The API always answers 200 here.
- **Missing token** in the query → show the invalid-link state straight away, without calling the API.
- **Token lifetimes:** reset links last 1 hour, verification links 24 hours. Each link works once.
- **Password rules** (the API's policy; mirror them in the form so users see them before submitting):
  8–128 characters, with at least one uppercase letter, one lowercase letter, one digit and one special character.
  The API may still refuse (e.g. a password that contains the username): show its message for `new_password`
  (`details.fields[].msg`, falling back to `error.message`) under the field. Rules live in `app/utils/password.ts`;
  letters and digits are Unicode-aware like the API's Python checks, and "special" is anything else, spaces included.
- **A policy rejection doesn't use up the link**: the user can fix the password and submit again on the same page.
- **After a reset** the API revokes every token the user had, on every device. If the user resets while signed in
  on this browser, clear the session (`POST /api/auth/logout`) and send them to `/login`.
- **Verification isn't required to sign in.** Invited accounts are created verified, so today the verify page is only
  reached from links the API sends for self-registration or an explicit re-send; build it so those links don't 404.
  There is no "resend verification" UI yet.
- **Rate limits:** 5 reset requests per hour per IP → 429; show "Too many requests. Try again later."
  Separately, the API sends at most 3 emails per address per 5 minutes; past that it still answers 200 and silently
  sends nothing, so the confirmation text must not promise that a new email is on its way each time.
- **Strip the token from the address bar** after reading it (`router.replace({ query: {} })`), so it doesn't stay in
  history or get shared in a screenshot. Keep it in component state for the submit.
- Add `<meta name="referrer" content="no-referrer">` on `/reset-password` and `/verify-email` (`useHead`) so the
  token never leaks to a third-party asset via `Referer`.

## API

Pages call Nitro; Nitro calls the API with `apiPublic` (no tokens, forwards the client IP). Bodies are JSON.

| UI call (Nitro) | API calls | Notes |
|---|---|---|
| `POST /api/auth/forgot {email}` | `POST /auth/password/reset-request {email}` | Always 200 `{detail}`. Don't pass `redirect_to`. |
| `POST /api/auth/reset {token, password}` | `POST /auth/password/reset-confirm {token, new_password}` | 200 `{detail}` |
| `POST /api/auth/verify {token}` | `POST /auth/email/verify-confirm {token}` | 200 `{detail}` |

API responses to map (`toH3Error` keeps `error.code` in `statusMessage`):

| Status | `error.code` | UI |
|---|---|---|
| 400 | `bad_request` (message "Invalid or expired token" / "Token already used") | Invalid-link state (verify also treats 422 this way) |
| 422 | `validation_error`, field `new_password` | Show `error.message` under the password field; stay on the form |
| 429 | `rate_limited` | Rate-limit message |
| 502 | `api_unreachable` (Nitro) | `auth.err.network` |

Nitro validation (zod) for the routes: `email` is an email ≤ 254 chars; `token` 1–2000 chars; `password` 8–128 chars.

Sample exchange:

```http
POST https://api.devhouse.kz/api/v1/auth/password/reset-confirm
{"token": "bogus", "new_password": "Str0ng!pass"}

400 {"error": {"code": "bad_request", "message_key": "errors.bad_request",
               "message": "Invalid or expired token", "details": {}, "support_id": "5b17f4c7"}}
```

## Implementation

Built as instructed below: routes `server/api/auth/{forgot,reset,verify}.post.ts`; pages `forgot-password.vue`,
`reset-password.vue`, `verify-email.vue`; shared `app/components/LinkInvalid.vue`, `app/utils/password.ts` (also used
by `/accept-invite`) and `app/utils/apiError.ts`. Verified with `python3 -I scripts/e2e-recovery.py` (API side, 13
checks) and a browser run for the UI-only criteria (prefill, form rules, token stripping, invalid states, rate limit).

## Instructions for the frontend

1. Add the three Nitro routes in `server/api/auth/` (`forgot.post.ts`, `reset.post.ts`, `verify.post.ts`), following
   `server/api/invites/accept.post.ts`: `readValidatedBody` with zod, then `apiPublic(event, path, { method: 'POST', body })`.
   Return `{ ok: true }`; don't pass the API's `detail` text through.
2. Add the pages `app/pages/forgot-password.vue`, `reset-password.vue`, `verify-email.vue`, modelled on
   `accept-invite.vue` (same layout, invalid-link block, `UForm` + zod schema, error mapping in `onSubmit`).
   `verify-email.vue` calls the API in `onMounted` (client only), not during SSR, so link scanners that prefetch
   the URL don't use up the token.
3. Put the password schema in one place (e.g. `app/utils/password.ts`) and use it on `/reset-password` and
   `/accept-invite`; today `/accept-invite` checks only the length and says "At least 8 characters".
4. Add the "Forgot password?" link to `app/pages/login.vue`.
5. Add i18n keys under `recovery.*` in `i18n/locales/en.json` and `ru.json`; reuse `invite.problem.invalid.*` for the
   invalid-link texts if the wording fits.
6. Run `npm run typecheck`, then check the criteria below against a local backend (Mailpit at
   `http://localhost:8025` shows the emails), and against production once SMTP is configured.

## Acceptance criteria

- [x] "Forgot password?" on `/login` opens `/forgot-password`, prefilled when the login field holds an email.
- [x] Requesting a reset for a registered email delivers an email whose link opens `/reset-password?token=…`.
- [x] Requesting a reset for an unknown email shows the same confirmation as for a known one.
- [x] A new password that misses a rule is refused in the form, before any request.
- [x] A password the API refuses shows the API's message, and the same link still works afterwards.
- [x] A successful reset lets the user sign in with the new password, and the old password fails.
- [x] Opening a used, expired or missing-token reset link shows the invalid-link state with "Request a new link".
- [x] `/verify-email?token=…` with a valid token shows "Email confirmed"; with a bad one, the invalid-link state.
- [x] After the token is read, the address bar shows no `token` parameter.
- [x] The sixth reset request within an hour from one browser shows the rate-limit message.

## Known gaps

[O3](../open-items.md) per-IP limits see Vercel's IP · "resend verification" and "change email" are specified on [My profile](profile.md) (not built) · email texts are English only (backend D8)
