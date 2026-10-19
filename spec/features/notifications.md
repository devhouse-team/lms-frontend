# Notifications

**Roles:** everyone (students get most types, mentors and reviewers get `submission_created`) · **Data:** API ·
**Status:** built (2026-10-19)

The API already writes an in-app notification for every event a user cares about and emails it unless they opted out.
This feature shows them: a bell with the unread count on every page, a panel with the latest ones, a full list at
`/notifications`, and the per-type email switches. Success: a student sees "Работа проверена" within a minute of the
review, one click lands on the assignment, and the badge goes down. Closes [O14](../open-items.md).

### As built

- `fixLink` lives in `shared/utils/notificationLink.ts` with `isLegacyLink`; its self-check is
  `scripts/notification-link.check.ts` (beside the other `*.check.ts`), run with `node --experimental-strip-types`.
- Times use `useCountdown().relative` (`Intl.RelativeTimeFormat`, numeric auto: "2 часа назад", "позавчера") under 7 days,
  then the `short` date; no `notifications.time.*` keys.
- The bell is a `UChip` over a ghost button inside the `USlideover` trigger; polling lives in `useNotifications().poll()`,
  called by the bell. `PUT /api/notifications/preferences` needed `ApiOptions.body` to accept arrays.
- The bell and the page show the **last good answer** (`useState('notifications-last')`, the page a local
  `shallowRef`): in Nuxt 4 a failed refresh resets `data`, which would hide the badge and later announce the whole count
  as new. Read marks replace the cached objects (never mutate). A 401 stops polling and goes to `/login`; a `focus`
  right after `visibilitychange` doesn't fetch twice (2 s guard). `fixLink` also drops `/\…` and control characters.

## Screens

| Route | Who | What it shows / does |
|---|---|---|
| Bell, every app page | any signed-in user | `NotificationBell.vue` in the navbar's right side, before the page's own `#right` slot: in `AppPage.vue` (covers every page using it, the course shell included) and in `pages/index.vue` (home has its own `UDashboardNavbar`). An `i-lucide-bell` ghost button; with unread > 0 a `UChip` shows the count, `99+` above 99. Click opens the panel. Not on auth-layout pages (login, recovery, accept-invite, confirm-email-change). |
| Panel (`USlideover`, right) | any signed-in user | Header: "Уведомления", "Отметить все прочитанными" (only with unread > 0). The latest 20, newest first. Footer: "Все уведомления" → `/notifications`, "Настройки писем" → `/notifications#email`. |
| `/notifications` | any signed-in user | Title "Уведомления"; `UTabs` "Все" / "Непрочитанные" (`?unread=1`); "Отметить все прочитанными"; the latest 100 (API maximum, no paging). Below, section **Письма** (`id="email"`): one switch per type relevant to the user. |

### A notification row (panel and page)

Icon by type, then: the type label (ru/en, ours) in bold when unread, the API's `title` under it (`text-muted`,
one line, truncated, full text in `title=`), and the relative time ("5 мин назад", absolute date in `<time datetime
title>`). Unread rows have a dot and a tinted background; the dot is also announced ("непрочитано"). The API's `body`
is not shown: it is generic ("Open the assignment to see the feedback") and English.

| `type` | Icon | Label ru | Label en | Who gets it | Opens |
|---|---|---|---|---|---|
| `submission_created` | `i-lucide-inbox` | Новая работа на проверку | New submission to review | student's mentor, else the cohort's reviewers | `/reviews/{submissionId}` (mentor view) |
| `review_completed` | `i-lucide-message-square-check` | Работа проверена | Your work was reviewed | the student | `/assignments/{c}/{a}` (student view) |
| `lesson_released` | `i-lucide-book-open` | Открылись новые уроки | New lessons are open | active students | `/courses/{c}/{course}` |
| `deadline_soon` | `i-lucide-alarm-clock` | Завтра срок сдачи | Due tomorrow | a student who hasn't handed in | the assignment that is due (student view) |
| `enrollment_created` | `i-lucide-user-plus` | Вас добавили в когорту | You were added to a cohort | the student | `/` |
| `exam_opens_soon` | `i-lucide-timer` | Скоро экзамен | An exam opens soon | active students | `/assignments/{c}/{a}` (student view) |
| `solution_released` | `i-lucide-lightbulb` | Опубликовано решение | A solution was published | active students | `/assignments/{c}/{a}` (student view) |

An unknown `type` (a newer API) gets `i-lucide-bell` and the label "Уведомление" / "Notification".

## Behavior

- **One source.** `useNotifications()` (new composable) owns `useFetch('/api/notifications', { key: 'notifications',
  query: { limit: 20 } })`: the bell's count and the panel's list. `/notifications` fetches its own list
  (`notifications-page`, limit 100); both read `unread` from their response, and every mutation refreshes both.
- **Refresh.** On mount (client only, `server: false`: the count is not worth delaying SSR), then every **60 s while
  the tab is visible**, and at once when the tab becomes visible again or the window regains focus. No polling while
  hidden. Opening the panel refreshes too. Plain `visibilitychange` / `focus` listeners in the composable; no new
  dependency. A failed refresh keeps the last data silently (the bell must never toast every minute).
- **Opening a notification marks it read.** Click (or Enter) on a row: if unread, `POST /api/notifications/{id}/read`
  without waiting, decrement the badge optimistically, close the panel, then go to `to`. A failed mark is not shown;
  the next refresh corrects the count. A row with no `to` only marks read.
- **Views.** A link may need another view (`view` in the Nitro response: `/reviews/*` → `mentor`, `/assignments/*` →
  `mentee`; others none). If the active view differs and the user has that view, switch first (`switchRole(view, to)`:
  `useAuth().switchRole` gains an optional landing path, default `/`). If they don't have it, go anyway: the page's own
  403 explains.
- **Mark all read** sets every row read locally and the badge to 0, then `POST /api/notifications/read-all`; on error
  refetch and toast.
- **The API sends real app paths since 2026-10-19** (backend: `submission_created` → `/reviews/{id}`, `lesson_released` →
  `/courses/{c}/{course}`, `deadline_soon`/`review_completed`/`exam_opens_soon`/`solution_released` →
  `/assignments/{c}/{a}`). Notifications and emails created **before** that keep the old paths below.
- **Old links are fixed in one place.** `shared/utils/notificationLink.ts` `fixLink(path)` rewrites the paths
  the API writes that this app doesn't serve, and is used twice: by `GET /api/notifications` (for `to`) and by a new
  server middleware `server/middleware/legacy-links.ts` that answers `302` for the same paths, because the **emails**
  carry the raw link (`FRONTEND_URL + link`):

  | API link | Sent by | Rewritten to | Why |
  |---|---|---|---|
  | `/mentor/submissions/{id}` | `submission_created` | `/reviews/{id}` | `/reviews/[id]` takes the submission id. `/mentor` alone stays the student's mock mentor page (the pattern needs `/submissions/`). |
  | `/app/cohorts/{c}/courses/{course}` | `lesson_released` | `/courses/{c}/{course}` | |
  | `/app/cohorts/{c}/lessons/{l}` | `deadline_soon`; `review_completed` from before assignments v2 | `/assignments/{c}-{l}` | The existing resolver page sends it to the lesson's first assignment (or "not found"). Only old rows. |
  | `/assignments/{c}/{a}`, `/` | the rest | unchanged | exist |

  Anything else that starts with `/` and not `//` passes unchanged (the catch-all 404 handles it); anything else is
  dropped (`to: null`), so a link can never leave the site. When the backend sends the right paths, the table shrinks;
  the middleware stays for emails already sent.
- **Empty, loading, error.**
  - Panel loading (first fetch only): three skeleton rows. Later refreshes don't show a spinner.
  - Empty: `UEmpty` `i-lucide-bell-off` "Пока нет уведомлений" / "Здесь появятся проверки работ, новые уроки и сроки."
    "Непрочитанные" tab empty: "Всё прочитано".
  - Error with no data: "Не удалось загрузить уведомления" and "Повторить". With stale data: keep it, no message.
- **Email switches** (`/notifications#email`). Types shown are those the user can receive: `submission_created` when
  `user.roles` has `mentor`; the six others when it has `mentee`; a head-only account sees "Для вашей роли писем нет"
  instead of switches. Each switch saves on change (`PUT` with that one type), disabled while its request runs; on error
  it flips back and toasts `common.saveError`. Hint: "В приложении уведомления приходят всегда; здесь — только письма."
  Not shown on the panel.
- Times are relative under 7 days ("только что", "{n} мин назад", "вчера"), else the `short` date of
  `useCohortFormat()`; the user's own clock, not a cohort's timezone (these are moments, not deadlines).

## API

| UI call (Nitro) | API calls | Notes |
|---|---|---|
| `GET /api/notifications?limit=&unread=` (new) | `GET /notifications/?limit=&unread_only=` | zod: `limit` 1–100 (default 20), `unread` `0\|1`. → `NotificationsResponse {unread: number, items: NotificationItem[]}`, `NotificationItem {id: string, type: string, title: string, read: boolean, createdAt: string, to: string \| null, view?: Role}`. `to` = `fixLink(link)`; `read` = `read_at !== null`; `body` dropped. |
| `POST /api/notifications/[id]/read` (new) | `POST /notifications/{id}/read` | API 204 → `{ok}`. Already read: 204 too. |
| `POST /api/notifications/read-all` (new) | `POST /notifications/read-all` | API 204 → `{ok}` |
| `GET /api/notifications/preferences` (new) | `GET /notifications/preferences` | → `{type, email}[]` as is (all 7 types; defaults `true`). The page filters by the user's views. |
| `PUT /api/notifications/preferences` (new) | `PUT /notifications/preferences` | zod: array of 1–10 `{type: enum, email: boolean}`. → the full list |

All routes use `requireUserSession` (any view). Types: `shared/types/index.ts` gains `NotificationItem`,
`NotificationsResponse`, `NotificationPreference`; the type enum comes from `components['schemas']['NotificationType']`.
Not used: nothing else; the API has no paging, delete or per-cohort filter.

### Errors

Read with `apiError(e).code`. Messages under `notifications.err.<code>`; unlisted codes fall back to `common.saveError`.

| Code | HTTP | Can happen on | Shown as / then |
|---|---|---|---|
| `notification_not_found` | 404 | mark read (deleted user data, or not mine) | Nothing; refetch |
| `validation_error` | 422 | preferences (an unknown type) | Toast `common.saveError`; refetch preferences |
| `unauthorized` | 401 | any (session revoked, e.g. log out everywhere on another device) | The existing session handling: Nitro clears the session; the next navigation goes to `/login`. The poller stops on 401. |
| `rate_limited` | 429 | any | Polling: silent, wait for the next tick. Actions: toast "Слишком много запросов, попробуйте через минуту" |
| `api_unreachable` | 502 (Nitro) | any | Polling: silent. Actions: toast `auth.err.network` |

### Cache keys

| Key | Fetched by | Holds |
|---|---|---|
| `notifications` (new) | bell / panel (`useNotifications`) | latest 20 + unread |
| `notifications-page` (new) | `/notifications` | latest 100 (or unread only) + unread |
| `notification-prefs` (new) | `/notifications` | the 7 preferences |

| Mutation | Refresh | Also |
|---|---|---|
| Mark read, mark all read | `notifications`, `notifications-page` | — |
| Save a preference | the response replaces `notification-prefs` | — |
| Sign-in, switch view, sign-out | `clearNuxtData()` (as today) | the poller restarts with the new session |

## i18n

New namespace `notifications.*`, both locales. Plurals use vue-i18n pipe forms with the Russian three forms.

| Key | ru | en |
|---|---|---|
| `notifications.title` | Уведомления | Notifications |
| `notifications.open` (bell `aria-label`) | Уведомления, непрочитанных: {n} \| Уведомления, непрочитанных: {n} \| Уведомления, непрочитанных: {n} | Notifications, {n} unread |
| `notifications.openNone` | Уведомления | Notifications |
| `notifications.unreadCount` | {n} непрочитанное \| {n} непрочитанных \| {n} непрочитанных | {n} unread |
| `notifications.readAll` | Отметить все прочитанными | Mark all as read |
| `notifications.all` / `.unread` | Все / Непрочитанные | All / Unread |
| `notifications.seeAll` | Все уведомления | All notifications |
| `notifications.emailSettings` | Настройки писем | Email settings |
| `notifications.unreadMark` | непрочитано | unread |
| `notifications.empty.title` / `.text` | Пока нет уведомлений / Здесь появятся проверки работ, новые уроки и сроки. | No notifications yet / Reviews, new lessons and deadlines will show up here. |
| `notifications.emptyUnread` | Всё прочитано | You're all caught up |
| `notifications.loadError` | Не удалось загрузить уведомления | Couldn't load notifications |
| `notifications.limitNote` | Показаны последние 100. | Showing the latest 100. |
| `notifications.type.<type>` | the labels in the table above; `unknown`: Уведомление | the labels above; `unknown`: Notification |
| `notifications.email.title` | Письма | Emails |
| `notifications.email.hint` | В приложении уведомления приходят всегда; здесь — только письма. | In-app notifications are always on; these switches only control emails. |
| `notifications.email.none` | Для вашей роли писем нет. | There are no emails for your role. |
| `notifications.time.now` | только что | just now |
| `notifications.time.min` | {n} минуту назад \| {n} минуты назад \| {n} минут назад | {n} minute ago \| {n} minutes ago |
| `notifications.time.hour` | {n} час назад \| {n} часа назад \| {n} часов назад | {n} hour ago \| {n} hours ago |
| `notifications.time.yesterday` | вчера | yesterday |
| `notifications.time.days` | {n} день назад \| {n} дня назад \| {n} дней назад | {n} day ago \| {n} days ago |
| `notifications.err.rate` | Слишком много запросов, попробуйте через минуту. | Too many requests, try again in a minute. |
| `nav.notifications` | Уведомления | Notifications |

The API's `title` stays English (backend D8, see gaps). Reuse `useCountdown().ago` if it already formats these
spans; add the keys only if it doesn't.

## Accessibility

- The bell is a `<button>` with `aria-label` from `notifications.open` (count included), `aria-haspopup="dialog"`; the
  badge is `aria-hidden` (the label carries the number).
- A visually hidden `aria-live="polite"` region announces only an **increase** of the unread count ("Новых уведомлений:
  {n}"), not every poll.
- The panel is a dialog (`USlideover`: focus trap, Esc closes, focus returns to the bell). The list is a `<ul>`; each
  row is one link/button (whole row clickable, one tab stop), its accessible name = label + title + time + "непрочитано".
- Unread is a dot **and** bold text **and** the spoken word, never colour alone (DESIGN.md Never-Colour-Alone).
- Switches have visible labels (the type label) and `aria-describedby` the section hint. Tabs are `UTabs` (arrow keys).
- Touch target ≥ 40 px for the bell and rows; the panel is full-width under `sm`.

## Acceptance criteria

Verified by `npm run typecheck` and, against a local backend, `scripts/e2e-smoke.py` extended for items marked (e2e);
the rest by the manual browser check the item describes.

- [x] The bell shows on every app page (home, lists, course pages) and nowhere on auth pages. ✓ browser
- [x] After a mentor reviews a student's homework, the student's badge shows 1 within 60 s without reloading, and the
      panel's top row reads "Работа проверена" with the API title. (e2e: `GET /api/notifications` → `unread: 1`, ✓ e2e (API) + browser (badge and panel)
      `items[0].type = review_completed`, `to = /assignments/{c}/{a}`)
- [ ] Clicking that row lands on the assignment page and the badge drops to 0; reloading keeps it at 0. (e2e: read → unread 0)
- [x] A hidden tab makes no `/api/notifications` requests; returning to it refreshes at once. ✓ browser (65 s hidden: 0 requests; visible: 1)
- [x] "Mark all as read" sets the badge to 0 and the "Unread" tab shows "You're all caught up". (e2e) ✓ e2e
- [x] `fixLink`: `/mentor/submissions/7` → `/reviews/7`, `/app/cohorts/3/courses/5` → `/courses/3/5`, ✓ `scripts/notification-link.check.ts`
      `/app/cohorts/3/lessons/9` → `/assignments/3-9`, `/assignments/3/4` unchanged, `https://x` and `//x` → `null`.
      (a `shared/utils/notificationLink.check.ts` beside the other `*.check.ts` scripts)
- [x] Opening `/mentor/submissions/7` and `/app/cohorts/3/courses/5` directly (as from an email) redirects (302); `/mentor`
      still shows the mentor page. (e2e: status and `Location`) ✓ e2e
- [ ] A user with mentor and student views, in the student view, clicking a `submission_created` row lands on
      `/reviews/{id}` in the mentor view.
- [x] A student's email section lists six switches (no "New submission to review"); turning "Due tomorrow" off survives
      a reload (e2e: PUT then GET shows `deadline_soon: false`); a failing save flips the switch back with a toast. ✓ e2e (PUT / GET) + browser (six switches); the flip-back on error not checked
- [ ] Russian counts read correctly for 1, 2, 5 and 21 unread (bell label and page header).
- [ ] Screen reader: the bell reads "Уведомления, непрочитанных: 3"; a new notification is announced once.

## Known gaps

- Titles and bodies come from the API in English and carry no parameters (assignment, cohort) to translate; the UI
  shows a localized type label above the English title (backend D8, email texts are English too).
- [O29](../open-items.md): no paging, the API returns at most 100, newest first; `/notifications` says "Showing the latest 100".
- Old `deadline_soon` rows (before 2026-10-19) open the lesson's first assignment, which may not be the one due.
- No push, sound or browser notifications; no realtime (polling every 60 s while visible).
- No per-cohort filter or delete.
