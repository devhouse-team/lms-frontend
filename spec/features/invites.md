# Invites

**Roles:** head, program lead (cohort invites only), invitee · **Data:** API

Registration is invite-only: an invite is the only way in for someone without an account. There are two kinds.

- **Role invite** (as today): the head enters an email and a role (mentor, head); the API emails a one-time link valid
  for 7 days; accepting creates the account with that role.
- **Cohort invite** (built 2026-10-18): whoever manages a cohort's enrollments (head, the program's lead) invites
  one or many emails straight into a cohort, from the [Add students modal](cohorts.md#add-students-modal) or a CSV.
  Accepting creates the account **and** an active enrollment; the student lands on their courses. People who already
  have an account are enrolled at once, without an email.

Success: a head pastes 30 emails into a cohort and, a week later, sees who joined, who didn't, and can resend or
withdraw the rest; an invitee knows what they are joining before they type a password.

Status: **built** (role invites; cohort invites 2026-10-18, items marked (new)). Contract: `../backend/spec/domain.md`,
section "Invites", and `../backend/openapi.json` (`npm run api:types`). Endpoint, field and error names below are per
backend spec/domain.md; where they differ from the generated types, the types win and this spec gets corrected.

### As built

Differences from the text below (the code follows these):

- **Resend / Revoke** live in one component, `InviteActions` (cohort page: Resend as a button, Revoke in the row menu;
  People rail: both in the row menu), with the revoke confirm. After any attempt, success or error, the page refetches
  its list (the server's state wins) and clears the other views holding invites (`people`, `dashboard-head`,
  `cohort-invites:<c>`). An error toast reads `invites.err.<code>`, then `cohorts.err.<code>`, then `common.saveError`.
- **Rails**: People and head home share `InviteList` (head home without actions, plus "All invites" → `/people`).
- **Invited section** columns: Email, Status, Expiry (from `sm`), Invited (relative, from `md`), actions; the full date
  is in each `title`. "Relative time" moved into `useCountdown().relative` (the roster uses the same).
- **Accept page**: the preview's `cohort.status = finished` shows the "has ended" state before the form. A load error
  and the rate limit each get a titled state with Retry. Field errors from the API's `validation_error` land on
  name, username or password.
- **`/accept-invite` renders client-only** (`routeRules: { ssr: false }`): rendered on the server, Nuxt copies the
  page URL, token included, into the HTML payload.
- **After accept** the page lands through `useAuth().afterLogin('/courses')` (it refreshes the session first; a plain
  navigation landed on `/login`).
- **Preview** responses carry `Cache-Control: no-store`; the cohort carries its `status` (`InvitePreview.cohort.status`).
- `parseEmails` has a self-check: `node --experimental-strip-types scripts/emails.check.ts`.

## Screens

| Route | Who | What it shows / does |
|---|---|---|
| `/people/invite` | head (not leads) | Role invite: email + role (mentor, head). Student is no longer a role option: the form says "Students are invited into a cohort: open the cohort → Add students → Invite by email" with a link to `/cohorts`. After sending: "we emailed a link to …, valid until …". |
| Add students modal → "Invite by email" tab (new) | head, program lead | Paste one or many emails, see the count, send; then a per-outcome report. See [below](#add-students--invite-by-email-new). |
| Add students modal → CSV report (changed) | head, program lead | Gains "Invited" and "Invite re-sent" groups; `unknown` now means "not a valid email or a deactivated account". See [cohorts](cohorts.md#add-students-modal). |
| `/cohorts/[id]`, "Invited" section (new) | head, program lead | Pending and expired cohort invites of this cohort: email, status, expiry, Resend, Revoke. |
| `/people`, "Invites" rail (changed) | head (not leads) | Pending and expired invites of both kinds: email, role or cohort, status / expiry, row menu Resend, Revoke. |
| Head home, "Invites" rail (changed) | head | Same items as `/people`, read-only, link "All invites" → `/people`. |
| `/accept-invite?token=…` (changed) | public | First the preview ("You're joining Backend · Autumn 2026, starts 12 Jan" or "You're invited as a mentor"), the invited email, then the form (name, username, password, confirm). Problem states for invalid, finished cohort, rate limit, load error. |

### Add students → Invite by email (new)

Third tab of the [Add students modal](cohorts.md#add-students-modal): "One person", "Invite by email", "CSV file".
Hidden like the rest of the modal when the cohort is finished.

**Form**

- `UTextarea` "Emails", 6 rows, autoresize, placeholder "ana@example.com, timur@example.com", help: "Separate with
  commas, spaces or new lines. Up to 200 at a time; for more, use a CSV file. People who already have an account are
  added straight away; the others get an email with a link valid for 7 days."
- Parsing, live as the user types (`app/utils/emails.ts`, `parseEmails(text)`): split on commas, semicolons and any
  whitespace; trim; strip surrounding `<` `>` (so `<a@b.kz>` from a pasted "Name <a@b.kz>" becomes `a@b.kz`; the
  name words themselves end up `invalid`); lowercase; drop empties; de-duplicate keeping first order. The client does **not** reject malformed addresses: they go to the API, which reports them as `invalid`.
  (Keeps one source of truth for what an email is.)
- Count line under the field: "{n} addresses" (`n` = unique entries); "{n} addresses, {d} duplicates removed" when
  duplicates were dropped. 0 → no line.
- Send button: "Send invites ({n})". Disabled when `n = 0`. When `n > 200`: disabled and the count line turns error
  colour: "{n} addresses: up to 200 at a time. Split the list or use a CSV file."
- Sending: one call `POST /api/cohorts/[id]/invites {emails}` with the parsed list; button loading, textarea
  read-only.

**Report** (replaces the form, same layout as the CSV report)

| Group (API field) | Text (en) | Notes |
|---|---|---|
| `invited` | "Invited: {n}" | Got an email with a link |
| `resent` | "Invite re-sent: {n}" | Had an open invite to this cohort; it got a new link and expiry, the old link stopped working |
| `enrolled` | "Added (already had an account): {n}" | Enrolled now, no email invite |
| `reactivated` | "Re-added (were dropped): {n}" | |
| `already_enrolled` | "Already in this cohort: {n}" | |
| `skipped_staff` | "Skipped, on this cohort's staff: {n}" | Includes the program's lead |
| `invalid` | "Not a valid email or account deactivated: {n}" | "Copy emails" copies the list, one per line, to fix and resend |

Each group with n > 0 shows its count and expands (`UCollapsible`, first two groups open) to the email list; groups
with 0 are hidden. All zero cannot happen (n ≥ 1 is sent). Buttons: "Invite more" (back to an empty form) and "Done".
The roster and the Invited section refresh as soon as the report arrives (`enrolled` / `reactivated` change the roster,
`invited` / `resent` the Invited list).

### `/cohorts/[id]` "Invited" section (new)

Placed under the Roster section. Shown to the cohort's managers (the page is head-only; leads see the page as head
of their program) whenever the list is non-empty, also on a finished cohort (so open invites can be revoked).

- Heading "Invited", count. One line under it: "People who haven't accepted yet. Accepted invites join the roster."
- Data: `GET /api/cohorts/[id]/invites` (API `GET /cohorts/{c}/invites`, pending and expired only, newest first),
  fetched with the roster, separate cache key.
- Columns: Email · Status · Expiry · Invited (relative time of `created_at`; "invited by" is not shown in v1) · row
  actions.

| Status | Badge | Expiry column |
|---|---|---|
| `pending` | neutral "Pending" | "expires in 3 days" (relative), full date in the `title` |
| `expired` | warning "Expired" | "expired 12 Jan" |

- Row actions (not when finished, except Revoke):
  - **Resend** (button, ghost): no confirm. Success toast "Invite re-sent to {email}. The old link no longer works."
    Row updates to pending with the new expiry (refetch the list).
  - **Revoke** (row menu, error colour): confirm "Revoke the invite for {email}? The link stops working. You can
    invite them again later." Buttons "Revoke" / "Keep". Success toast "Invite revoked"; the row disappears.
  - On a finished cohort only Revoke is offered (resend answers `cohort_finished`).
- Empty list: the section is hidden (no empty state; the Add students modal is the way in).
- Load error: inline "Couldn't load invites" + Retry inside the section; the rest of the page stays usable.

### `/people` and head home "Invites" rail (changed)

- Items: pending and expired invites of both kinds, newest first, at most 100 per kind (as today's single call).
- Each item: email; second line the role ("Mentor", "Head") for role invites, or "Student · {cohort name}" linking to
  `/cohorts/{id}` for cohort invites; third line "Expires in 3 days" or, in error colour, "Expired".
- `/people` only: a row menu (`UDropdownMenu`, `i-lucide-ellipsis`) with Resend and Revoke, same texts and confirm as
  the cohort section. Head home stays read-only with "All invites" → `/people`.
- The People search does not search invites (unchanged).
- Program leads without admin rights don't see the rail (they can't list all invites; unchanged `headScope: 'all'`).
  They manage their cohorts' invites on the cohort page.

### `/accept-invite?token=…` (changed)

Layout `auth`, public. On load the page calls `GET /api/invites/preview?token=` (no token in the URL → invalid state
without a request).

| State | When | Shows |
|---|---|---|
| Loading | preview pending | Skeleton of the header and form (no flash of the invalid state) |
| Cohort invite | preview `kind = cohort` | Title "You're joining {cohort}"; line "{program} · starts {date}" (or "started {date}" when `starts_on` is today or past); email line "Invitation for {email}"; expiry line "The link works until {date, time}". Then the form. |
| Role invite | preview `kind = role` | Title "Welcome to dev.house"; line "You're invited as {role}" (Mentor / Head; an unknown role name → no role line); email and expiry lines as above. Then the form. |
| Invalid | no token; preview `404 invite_not_found`; accept `422 invite_invalid` without a reason | "This link no longer works": "The invite was already used, has expired or was withdrawn. If you already have an account, sign in. Otherwise ask the person who invited you for a new link." Actions: Sign in, Contact (Telegram). The API can't tell these apart (by design), so neither does the UI. |
| Cohort finished | preview `cohort.status = finished` (shown before the form), or accept `422 invite_invalid` with `details.reason = cohort_finished` if it finished in between | "{cohort} has ended": "This cohort finished before you joined, so the invite can't be used. Contact the academy to join another cohort." Actions: Contact, Sign in. |
| Too many attempts | preview `429 rate_limited` | "Too many attempts. Try again in a minute." + Retry |
| Load error | preview network error / 5xx | `HomeState`-style error with Retry; never the invalid state |

**Form**: unchanged fields and rules (name 2–80; username 2–32 of `a–z 0–9 _`; password per `app/utils/password.ts`;
confirm). The invited email is shown read-only above the fields (from the preview), so the invitee knows which address
signs in. Submit label: "Join the cohort" for cohort invites, "Create account" for role invites.

**After accept**: Nitro signs the new account in (as today); the page refreshes the session (`useAuth().afterLogin(to)`)
before navigating, or the auth middleware still sees a guest and sends it to `/login`. Then:

- cohort invite → `/courses` (their cohort's courses; a planned cohort shows "starts {date}" there), toast
  "Welcome to {cohort}";
- role invite → home `/` (as today, honouring a safe `?next=`).

## Behavior

- **Kinds.** The UI reads `kind` (`role` | `cohort`) from the API; never infers it from `role_id`.
- **Role ids.** Role → backend role id via `NUXT_PUBLIC_ROLE_IDS_*` (no roles endpoint, O1). `NUXT_PUBLIC_ROLE_IDS_MENTEE`
  is no longer used by the invite form (students are invited into a cohort); the `mentee` option is removed from
  `/people/invite` and from the Nitro zod enum.
- **Who sees what.** Cohort invite controls follow the cohort page's rules (head view; the API's enrollment-management
  check is final: a lead of another program gets `404`/`403`). The People rail and `/people/invite` stay `headScope:
  'all'`.
- **Existing accounts are never invited**: the API enrolls them directly (`enrolled` / `reactivated`). The report says
  so; no extra UI.
- **One address, one outcome.** The API trims, lowercases and de-duplicates too; the client's parse only drives the
  count and the 200 cap. A list the client counts as 200 is always accepted.
- **Resend** gives a new token and a new 7-day expiry and emails again; the old link stops working. Allowed on pending
  and expired, never on revoked or accepted (`invite_not_pending`).
- **Revoke** sets `revoked_at`; the invite leaves every list (lists hide revoked by default). Revoking an already
  revoked invite is a silent success (API 204). Inviting the same address again later creates a fresh invite.
- **Status** comes from the API (`pending | accepted | expired | revoked`), never from comparing dates in the client,
  except the "expires in" wording, which formats `expires_at`.
- **Finished cohort**: Add students (all tabs) and Resend are hidden; the Invited list stays with Revoke only.
- **Same email, several invites**: the first accepted wins; the others answer `user_exists` on accept. The accept page
  then says the email already has an account (see errors) and points to sign-in; staff enroll the account from Add
  students.
- **Accept → views.** Views are read at sign-in (`/me/access`); the new enrollment exists before Nitro signs in, so the
  new student lands in the student view without another sign-in.
- **The token** stays in the emailed link only. The preview call sends it to Nitro, which passes it to the API; it is
  never logged, cached in payload state or put in another URL. `/accept-invite` renders client-only (`routeRules:
  { ssr: false }`): a `server: false` fetch is not enough, because a server-rendered page still copies its own URL,
  token included, into the HTML payload. There is still no copy-link (not wanted: the address is the identity).
- **Rate limit.** Preview is limited per IP (30/min). Nitro forwards `X-Forwarded-For` (`apiPublic`), so the limit is
  per invitee, not per Vercel (needs backend `TRUSTED_PROXY_HOPS`, O3).

### Errors

Read with `apiError(e).code` (never the HTTP status: Nitro's `toH3Error` turns some 422s into 409). `apiError` gains
`reason` = `data.data.details.reason`. Messages live under `invites.err.<code>` (new keys) and
`cohorts.err.<code>` (shared cohort codes) in both locales; unlisted codes fall back to `common.saveError`.

| Code | HTTP | Can happen on | Message (en) | Shown as / then |
|---|---|---|---|---|
| `invite_not_found` | 404 | preview | — | Invalid state |
| `invite_not_found` | 404 | resend, revoke | "This invite no longer exists; the list was refreshed." | Toast; refetch the list |
| `invite_invalid` | 422 | accept | — | Invalid state |
| `invite_invalid` + `reason = cohort_finished` | 422 | accept | — | Cohort finished state |
| `invite_not_pending` | 422 | resend, revoke | "This invite was already accepted or revoked; the list was refreshed." | Toast; refetch the list and the roster |
| `user_exists` | 422 (409 via Nitro) | accept | "This username is taken, or {email} already has an account. Try another username; if you already have an account, sign in." | Alert above the submit button, with a "Sign in" link |
| `user_exists` | 422 | resend | "{email} has an account now. Add them from \"One person\"." | Toast; refetch the list |
| `user_exists` | 422 | role invite create | "A user with this email already exists" (unchanged) | Toast |
| `validation_error` | 422 | accept | The API's field message (`password`, `username`, `name` → that input); otherwise the API's message | Field error / alert |
| `validation_error` | 422 | bulk invite (empty or > 200; the client prevents both, and Nitro's zod answers `400` before the API) | "Enter between 1 and 200 emails." | Under the textarea |
| `cohort_finished` | 422 | bulk invite, CSV, resend | "This cohort has finished and is read-only." (cohorts) | Toast; refetch header, roster and invites (page turns read-only) |
| `cohort_not_found` | 404 | bulk invite, cohort invite list | As [cohorts](cohorts.md#errors): toast "This cohort no longer exists", go to `/cohorts` | |
| `permission_denied` | 403 | bulk invite, resend, revoke | "You can't manage invites for this cohort." | Toast |
| `rate_limited` | 429 | preview (accept is not rate-limited) | "Too many attempts. Try again in a minute." | Too-many state with Retry |
| `role_unavailable` | 422 (Nitro) | role invite create | "This role can't be given by invite yet" (unchanged) | Toast |

### Cache keys

| Key | Fetched by | Holds |
|---|---|---|
| `cohort-invites:<id>` (new) | `/cohorts/[id]` | Pending + expired invites of the cohort |
| `people` | `/people` | People + invites rail (both kinds) |
| `dashboard-head` | head home | Includes the invites rail |
| `invite-preview` (new) | `/accept-invite` (client-only page) | The preview; cleared on leaving the page |

| Mutation | Refresh on the page | Also clear |
|---|---|---|
| Bulk invite, CSV import | `cohort-roster:<id>`, `cohort-invites:<id>` | `invalidateCohorts()` (already clears `people`, `dashboard-head`) |
| Resend, revoke (cohort page) | `cohort-invites:<id>` | `people`, `dashboard-head` |
| Resend, revoke (`/people`) | `people` | `dashboard-head`; `cohort-invites:<cohortId>` for cohort invites |
| Role invite create | none | `people`, `dashboard-head` (as today) |
| Accept | — | `clearNuxtData()` (as today, via `afterLogin`) |

On any mutation error, refetch the affected keys.

### i18n

Russian is the primary language, English second; both get every key. New namespaces: `invites.*` (bulk tab, invited
section, rail, statuses, errors) and additions under `invite.*` (accept page) and `addStudents.report.*`. Plurals use
vue-i18n pipe forms with the Russian three forms (`адрес | адреса | адресов`). Dates through `useCohortFormat()`
(`short`, `long`) in the active locale. Key texts (ru):

| Key | ru | en |
|---|---|---|
| `addStudents.invite` | Пригласить по email | Invite by email |
| `invites.emails` | Адреса | Emails |
| `invites.emailsHelp` | Через запятую, пробел или с новой строки. До 200 за раз, больше — через CSV. Те, у кого уже есть аккаунт, добавятся сразу; остальным придёт письмо со ссылкой на 7 дней. | Separate with commas, spaces or new lines. Up to 200 at a time; for more, use a CSV file. People who already have an account are added straight away; the others get an email with a link valid for 7 days. |
| `invites.count` | {n} адрес \| {n} адреса \| {n} адресов | {n} address \| {n} addresses |
| `invites.dupes` | , убрано повторов: {d} | , {d} duplicates removed |
| `invites.tooMany` | {n} адресов: не больше 200 за раз. Разделите список или загрузите CSV. | {n} addresses: up to 200 at a time. Split the list or use a CSV file. |
| `invites.send` | Отправить приглашения ({n}) | Send invites ({n}) |
| `invites.more` | Пригласить ещё | Invite more |
| `addStudents.report.invited` | Приглашено: {n} | Invited: {n} |
| `addStudents.report.resent` | Приглашение отправлено повторно: {n} | Invite re-sent: {n} |
| `addStudents.report.enrolledExisting` | Добавлено (аккаунт уже был): {n} | Added (already had an account): {n} |
| `addStudents.report.invalid` | Неверный email или аккаунт отключён: {n} | Not a valid email or account deactivated: {n} |
| `invites.section` | Приглашённые | Invited |
| `invites.sectionHint` | Ещё не приняли приглашение. Принявшие появятся в списке студентов. | People who haven't accepted yet. Accepted invites join the roster. |
| `invites.status.pending` / `.expired` | Ожидает / Истекло | Pending / Expired |
| `invites.resend` / `invites.revoke` | Отправить снова / Отозвать | Resend / Revoke |
| `invites.resent` | Приглашение для {email} отправлено снова. Старая ссылка больше не работает. | Invite re-sent to {email}. The old link no longer works. |
| `invites.revokeConfirm` | Отозвать приглашение для {email}? Ссылка перестанет работать. Пригласить снова можно позже. | Revoke the invite for {email}? The link stops working. You can invite them again later. |
| `invites.revoked` | Приглашение отозвано | Invite revoked |
| `invites.studentIn` | Студент · {cohort} | Student · {cohort} |
| `inviteForm.studentsMoved` | Студентов приглашают в когорту: откройте когорту → «Добавить студентов» → «Пригласить по email». | Students are invited into a cohort: open the cohort → Add students → Invite by email. |
| `invite.joining` | Вы присоединяетесь к {cohort} | You're joining {cohort} |
| `invite.startsOn` / `invite.startedOn` | {program} · старт {date} / {program} · идёт с {date} | {program} · starts {date} / {program} · started {date} |
| `invite.asRole` | Вас приглашают как {role} | You're invited as {role} |
| `invite.forEmail` | Приглашение для {email} | Invitation for {email} |
| `invite.validUntil` | Ссылка действует до {date} | The link works until {date} |
| `invite.submitCohort` | Присоединиться к когорте | Join the cohort |
| `invite.welcomeCohort` | Добро пожаловать в {cohort} | Welcome to {cohort} |
| `invite.problem.invalid.text` (changed) | Приглашение уже использовано, истекло или отозвано. Если аккаунт уже есть, просто войдите. Иначе попросите новую ссылку у того, кто вас пригласил. | The invite was already used, has expired or was withdrawn. If you already have an account, sign in. Otherwise ask the person who invited you for a new link. |
| `invite.problem.finished.title` / `.text` | Когорта {cohort} завершилась / Когорта закончилась раньше, чем вы присоединились, поэтому приглашение больше не действует. Напишите в академию, чтобы попасть в другую когорту. | {cohort} has ended / This cohort finished before you joined, so the invite can't be used. Contact the academy to join another cohort. |
| `invite.problem.rate.text` | Слишком много попыток. Попробуйте через минуту. | Too many attempts. Try again in a minute. |

Remove `inviteForm.menteeHint` and `inviteForm.unavailable` (student option gone). The full list of keys is checked
by the existing key check script (both locales, no missing keys).

- **`@` in a message must be written `{'@'}`**: vue-i18n reads `@` as a linked key, and one bad message stops the whole
  locale from compiling (every text on every page shows its raw key). The placeholder is
  `ana{'@'}example.com, timur{'@'}example.com`.
- Keys the table above leaves out, added in the build: `invites.placeholder`, `.loadError`, `.expiredOn`,
  `.revokeTitle`, `.keep`, `.actionsFor`, `.all`, `.col.{status,expiry,invited,actions}`, `.err.<code>`;
  `inviteForm.toCohorts`; `addStudents.report.fixHint` (replaces `unknownHint`); `invite.problem.rate.title`,
  `invite.problem.load.{title,text}`, `invite.err.userExists`.

## API

Pages call only these routes. Cohort-scoped routes use `requireRole(event, 'head')` (leads included); `/api/people`,
`/api/dashboard/head` and role invites keep `requireRole(event, 'head', 'all')`. The API's own checks are final.

| UI call (Nitro) | API calls | Notes |
|---|---|---|
| `POST /api/invites {email, role}` | `POST /invites/ {email, role_id}` | `role`: `mentor` \| `head` (`mentee` removed). 422 `role_unavailable` when the role id is 0. → `InvitePublic` |
| part of `/api/people`, `/api/dashboard/head` (changed) | `GET /invites/?kind=role&status=pending&status=expired&limit=100` and `GET /invites/?kind=cohort&status=pending&status=expired&limit=100`, in parallel | `pendingInvites()` in `server/utils/invites.ts`: merge, newest first. Without `kind` the API lists role invites only, so both calls are needed. → `InvitePublic[]` |
| `POST /api/cohorts/[id]/invites {emails}` (new) | `POST /cohorts/{c}/invites {emails}` | zod: `emails` array of 1–200 strings, each trimmed and non-empty (no length or email check: the API reports `invalid`). → `InviteReport {invited, resent, enrolled, reactivated, alreadyEnrolled, skippedStaff, invalid}` (email lists) |
| `GET /api/cohorts/[id]/invites` (new) | `GET /cohorts/{c}/invites` | → `CohortInvite[] {id, email, status: 'pending' \| 'expired', expiresAt, createdAt}` |
| `POST /api/cohorts/[id]/enrollments/import` (changed) | `POST /cohorts/{c}/enrollments/import` | `ImportReport` gains `invited`, `resent` (from the API fields of the same name); `unknown` now means invalid email or deactivated account |
| `POST /api/invites/[id]/resend` (new) | `POST /invites/{id}/resend` | → `InvitePublic` (new expiry) |
| `DELETE /api/invites/[id]` (new) | `DELETE /invites/{id}` | API 204 → `{ok}` |
| `GET /api/invites/preview?token=` (new, public) | `GET /invites/preview?token=` via `apiPublic` (forwards `X-Forwarded-For`) | zod: `token` 1–200 chars. → `InvitePreview {email, kind, role?: Role, roleName: string \| null, cohort: {id, name, programTitle, startsOn, status} \| null, expiresAt}`; `role` maps the API's role name (`admin` → `head`, `mentor` → `mentor`), absent otherwise. Errors passed through (`invite_not_found`, `rate_limited`) |
| `POST /api/invites/accept {token, name, username, password}` (changed) | `POST /invites/accept`, then sign-in | → `AuthResponse & {cohortId: string \| null}` from the API's `cohort_id`; the page picks the landing route from it |

Type changes in `shared/types/index.ts`: `InvitePublic` gains `kind: 'role' | 'cohort'`, `status: 'pending' |
'expired'`, `cohort?: {id: string, name: string}` and drops `expired: boolean` (use `status`); new `InviteReport`,
`CohortInvite`, `InvitePreview`; `ImportReport` gains `invited: string[]`, `resent: string[]`.

## Acceptance criteria

Verified by `npm run typecheck` and, against a local backend with cohort invites, `scripts/e2e-smoke.py` extended for
the items marked (e2e); the rest by the manual check the item describes.

### Role invites (built)

- [x] Head invites a mentor; the email arrives with an `/accept-invite?token=` link.
- [x] Accepting creates the account and signs the mentor in, in the mentor view.
- [x] A used token is rejected with the invalid-link state.
- [x] An accepted invite no longer shows as pending.
- [x] A username with uppercase letters, dots or dashes is refused in the form, before calling the API.
- [x] ~~A student invite is refused while no student role id is configured, and the option is disabled.~~ Replaced:
  see the next item.
- [x] `/people/invite` offers only Mentor and Head and points students to the cohort's Add students. ✓ browser + e2e (`mentee` → 400)

### Invite by email

- [x] Pasting "a@x.kz, B@x.kz\nb@x.kz;  c@x.kz" shows "3 addresses, 1 duplicate removed" and sends 3 lowercased emails. ✓ browser + `scripts/emails.check.ts`
- [x] 201 addresses disable Send with the 200-limit message; no request is made. ✓ browser (Nitro also refuses > 200: e2e)
- [x] A list with one new email, one existing account, one dropped student, one active student, one staff member, one
  open invite and "not-an-email" shows Invited 1, Added 1, Re-added 1, Already 1, Skipped staff 1, Re-sent 1,
  Invalid 1 (e2e). ✓ e2e
- [x] After the report, the roster shows the added and re-added students and the Invited section shows the invited and
  re-sent emails, without a reload. ✓ browser (Invited list; the roster refreshes in the same call)
- [x] "Copy emails" in the Invalid group copies the invalid entries one per line. ✓ browser
- [ ] On a cohort that finished meanwhile, Send shows the `cohort_finished` message and the page turns read-only.

### CSV import

- [x] A CSV with one unknown address shows it under "Invited" (not "No account"), and it appears in the Invited section (e2e). ✓ e2e
- [x] Re-importing the same CSV shows that address under "Invite re-sent". ✓ e2e

### Invited section

- [x] Lists pending and expired cohort invites with status badge and expiry; accepted and revoked ones are absent (e2e). ✓ e2e + browser
- [x] Resend on an expired invite makes it pending with a new expiry and the toast says the old link no longer works (e2e). ✓ browser (expired → pending) + e2e (old link 404)
- [x] Revoke asks first, removes the row, and the revoked link then shows the invalid state on `/accept-invite` (e2e). ✓ e2e + browser
- [x] On a finished cohort only Revoke is offered. ✓ browser
- [ ] A program lead (no admin rights) sees and uses the section on their program's cohort.

### People rail

- [x] Shows role and cohort invites; a cohort invite reads "Student · {cohort}" and links to the cohort (e2e). ✓ e2e + browser
- [ ] Resend and Revoke from the rail work and refresh the cohort's Invited section on the next visit.
- [x] Head home shows the same items without actions. ✓ browser

### Accept page

- [x] A cohort invite link shows "You're joining {cohort}", "{program} · starts {date}", the invited email and the expiry before the form; the submit reads "Join the cohort" (e2e: preview fields). ✓ e2e + browser
- [x] A role invite link shows the role line and "Create account". ✓ browser
- [x] No flash of the invalid state while the preview loads; a network error shows Retry, not the invalid state. ✓ browser
- [x] Unknown, used, expired and revoked tokens all show the same invalid state (e2e: preview 404). ✓ e2e + browser
- [x] Accepting a cohort invite signs the student in, in the student view, and lands on `/courses` showing that cohort with the welcome toast (e2e). ✓ e2e + browser
- [x] Accepting after the cohort finished shows the "has ended" state; nothing is created (e2e). ✓ e2e + browser
- [x] Accepting when the email got an account meanwhile shows the `user_exists` alert with a Sign in link. ✓ browser
- [x] The token does not appear in the SSR payload or any other URL. ✓ browser (`/accept-invite` renders client-only: `routeRules`)

### Errors, i18n and cache

- [x] Every code in the error table has `en` and `ru` messages and is shown as the table says; no listed code shows `common.saveError` (key check script). ✓ key check (static keys in both locales)
- [x] Russian plurals for the address count read correctly for 1, 2, 5 and 21. ✓ browser

## Known gaps

- [O1](../open-items.md) role ids for role invites.
- No "invited by" or invite history in the UI; accepted invites aren't listed (the roster shows the student).
- Invites to several cohorts for one email: only the first accept works; the rest are resolved by staff enrolling the
  account (backend edge case).
- Failed emails are only logged by the backend (backend H1); the UI can't show "not delivered". Use Resend.
