# Programs

**Roles:** head (manage), program lead (manage their own programs), mentor and student (read their cohort's program)
· **Data:** API

A program is a **template of courses** that cohorts are created from: a title, a description, a length in weeks, a
cover, a lead, and an ordered curriculum of existing courses, each starting some days after the cohort starts. When a
cohort is created, the API copies the curriculum into it; from then on the cohort's courses are its own. The head
prepares a program as a draft, activates it so cohorts can be created, and archives it when it stops running. A
program lead runs their programs and those programs' cohorts without being an admin. Success: the head can set up a
new program and start a cohort from it without leaving the LMS, nothing on the program pages contradicts what the API
will accept, and students and mentors see what program they are in.

Programs v2 (2026-10-16). Decisions: product owner, 2026-10-16. The API owns status, visibility, counts and every
rule below. Contract: `../backend/spec/domain.md` (programs) and `../backend/openapi.json` (`npm run api:types`).
Where a field, code or endpoint name below differs from the backend spec or the generated types, **the backend spec
and the generated types win** and this file gets corrected. The static syllabus (`server/data/programs.ts`) is gone:
every module and lesson count comes from real courses.

## User flows

1. **New program.** Head → `/programs` → "Create program" → modal (title, slug filled from the title, description,
   duration, cover, lead) → saved as **Draft** → lands on `/programs/[id]` → Curriculum: "Add course" for each
   course, sets order and start week → "Activate" → confirm. The program now appears in the cohort form's picker.
2. **New cohort from a program.** Head or the program's lead → `/programs/[id]` → Cohorts → "Create cohort" (program
   preset, end date filled from the program length) → saved → toast "Cohort created · 5 courses attached" → the
   cohort page, where the [cohort v2 flow](cohorts.md) continues (staff, students, mentors). Also possible from
   `/cohorts` → "Create cohort", picking the program there.
3. **Lead without admin rights.** A user who leads a program signs in and gets the head view, scoped: nav shows Home,
   Cohorts, Programs. `/programs` lists only their programs; they edit fields and curriculum and create and run the
   program's cohorts. Status, lead, order and delete aren't offered.
4. **Order and archive.** Head reorders programs on `/programs` with the up / down buttons (the order is the picker's
   order too). Head archives an old program: it leaves the picker, its running cohorts go on untouched, and
   "Restore" brings it back.
5. **Students and mentors** see their cohort's program (cover, title, description) on their dashboard and the cohort
   header, read-only.
6. **Mistaken draft.** Head opens the draft → "Delete" → confirm → back on `/programs` with a toast.

## Screens

| Route | Who | What it shows / does |
|---|---|---|
| `/programs` | head; lead (own programs) | Status tabs (Active, Draft, Archived), one card per program, up / down reorder (head), "Create program" (head). |
| `/programs/[id]` | head; lead of this program | Header with cover, status and status actions; Overview; Curriculum editor; Cohorts of this program with "Create cohort". |
| Program modal | head (create, edit); lead (edit) | Title, slug, description, duration, cover, lead (head only). |
| Add course modal | head; lead | Pick an existing course and its start week. |
| Cohort modal | head; lead | [Cohorts](cohorts.md#cohort-modal-create--edit): picker shows active programs only; end date from the program length, optional. |
| `/`, `/cohort` | student, mentor | Read-only program block: cover, title, description ([dashboards](dashboards.md)). |

### `/programs` (list)

- **Tabs** (`UTabs`): Active (default), Draft, Archived, each with its count. The tab lives in the URL as
  `?status=draft` / `?status=archived`; no `status` means Active. The page loads **all** visible programs in one
  call and filters per tab on the client (programs are a few dozen at most).
- **Card** per program, one column on mobile, two from `md`, in API order (`position`, then title; the client never
  re-sorts):

| Part | Content |
|---|---|
| Cover | `coverUrl` image, 16:9, `object-cover`, `loading="lazy"`, `alt=""` (decorative; the title is next to it). No cover, or the image fails to load (the URL expires after 5 minutes): a neutral tile with the program's initials. |
| Title | Link to `/programs/[id]`. Draft and archived cards also carry the status badge (Draft: neutral outline; Archived: muted). |
| Facts line | "{weeks} weeks · ~{months} months · {n} courses", plural forms per [Plurals](#plurals). `months = round(weeks / 4.345)`, shown only when ≥ 1. Always visible, also on mobile. |
| Cohorts | Non-zero counts only: "{a} active · {p} planned · {f} finished"; all zero → "No cohorts yet" (muted). |
| Students | "{n} students now" = `activeStudents` (active enrollments across the program's cohorts); hidden when 0. |
| Lead | Avatar + name; none → "No lead" (muted). |
| Reorder | Head only (`can.reorder`): "Move up" / "Move down" icon buttons (`i-lucide-arrow-up` / `-down`, `aria-label` set), disabled at the ends of the tab. No drag and drop (no new dependency; buttons work by keyboard and on touch). |

- **Reorder** changes the order inside the current tab. One call per click: the client builds the full id list (all
  programs by current position, with the tab's programs placed back into their own slots in the new order) and sends
  `PUT /api/programs/order`. The card moves at once; on error the list is refetched and a toast shows. Buttons are
  disabled while a reorder is in flight.
- **"Create program"** (head only, `can.create`): opens the program modal; on save go to the new program's page.
- **Lead-only user** (session `headScope = 'programs'`): Nitro returns only programs they lead, in every status. No
  "Create program", no reorder buttons.
- **Empty**, no programs at all: "No programs yet. A program is a set of courses that cohorts are created from." plus
  "Create program" (head). A lead with none: "You don't lead any program yet." Empty tab: "No draft programs" /
  "No archived programs" / "No active programs".
- **Loading**: `HomeState` skeleton. **Error**: `HomeState` load error with Retry.

### `/programs/[id]` (detail)

**Header**: cover (wide, 16:9 up to `max-h-56`, same fallback as the card), title, status badge (Draft neutral,
Active primary, Archived muted), facts line as on the card, lead. Actions on the right, by status, head only
(`can.manage`); the lead sees only Edit:

| Status | Primary | Menu (⋯) | Note under the header |
|---|---|---|---|
| draft | Activate | Edit · Archive · Delete | "Draft: only the head and the program lead see it. Cohorts can't be created until it is active." |
| active | Edit | Archive · Back to draft (only with 0 cohorts in total) | none |
| archived | Restore | Edit | "Archived: not offered for new cohorts. Its cohorts run as planned." |

"Delete" shows only for a draft with 0 cohorts in total (a draft always has 0 today; the check stays in case that
changes). "Back to draft" shows only for an active program whose planned + active + finished count is 0. The API
refuses the rest (`program_has_cohorts`, `program_not_deletable`); the UI never offers them.

Confirm dialogs (`UModal`, one component with a `kind` prop as on the cohort page). Every confirm button shows a
spinner and is disabled while the call runs; cancel closes without a call:

| Action | Text | Confirm button |
|---|---|---|
| Activate | "Activate "{title}"? It appears in the program list of the cohort form, and cohorts can be created from it." Plus, when the curriculum is empty, a warning line: "The curriculum is empty: new cohorts will start with no courses." | "Activate" (primary) |
| Archive | "Archive "{title}"? It won't be offered for new cohorts. Its {n} planned and active cohorts continue unchanged. You can restore it later." (`n` = planned + active; the sentence is left out when 0) | "Archive" (neutral) |
| Restore | "Restore "{title}"? It becomes active and is offered for new cohorts again." | "Restore" (primary) |
| Back to draft | "Move "{title}" back to draft? Only the head and the program lead will see it, and cohorts can't be created until it is activated again." | "Back to draft" (neutral) |
| Delete | "Delete "{title}"? The program and its curriculum are removed. Courses themselves are kept. This can't be undone." | "Delete" (error) |

After a status action: toast ("Program activated" / "archived" / "restored" / "moved to draft"), refetch
`program:<id>`, `invalidatePrograms()`. After delete: `invalidatePrograms()`, clear `program:<id>`, go to `/programs`,
toast "Program deleted".

**Overview** section:

- Description as plain text with line breaks kept (`whitespace-pre-line`); no markdown rendering yet (see Known
  gaps). Over 6 lines: clamped with "Show more" / "Show less". Empty: "No description" (muted), plus "Add a
  description" opening Edit when `can.edit`.
- Facts: slug (monospace), duration "{weeks} weeks (~{months} months)", lead, last updated (relative, absolute in a
  tooltip).
- "Edit" (head or lead, `can.edit`) opens the program modal.

**Curriculum** section ("Curriculum", count of courses):

- A note above the list, always shown when `can.edit`: "Changes apply to new cohorts only. Cohorts already created
  keep the courses they started with." When the program has cohorts, it adds: "{n} existing cohorts aren't
  affected."
- One row per course in curriculum order (`position`):

| Part | Content |
|---|---|
| # | Position, 1-based. |
| Course | Course title. |
| Starts | "Week {w}" where `w = floor(startOffsetDays / 7) + 1`; with a remainder `d`, "Week {w}, day {d + 1}". Offset 0 → "Week 1 (from the start)". |
| Content | "{m} modules · {l} lessons" (plurals). 0 modules → "No modules yet" in warning colour. |
| Actions | `can.edit`: up / down buttons (reorder), "Change start" (inline editor), remove (trash, confirm). |

- **Change start**: inline popover with two number inputs, "Week" (1–104) and "Day" (1–7), defaulting to the current
  values; `start_offset_days = (week − 1) × 7 + (day − 1)`. "Save" sends one call and updates the row; Escape
  cancels. Client check: week 1–104, day 1–7, integers.
- **Reorder**: up / down, one `PUT /api/programs/[id]/courses/order` per click with the full course id list; the row
  moves at once, refetch on error.
- **Remove**: confirm "Remove "{course}" from the curriculum? Existing cohorts keep it." → one call, toast
  "Course removed".
- **Length hint** under the list, from `weeksOfContent` (API: the last week any content of the curriculum opens) vs
  `durationWeeks`; nothing when the curriculum is empty:
  - longer: warning `UAlert` "The content runs {x} weeks, longer than the program's {d} weeks. Lessons after week {d}
    open after a cohort ends. Shorten the content or lengthen the program."
  - shorter by 2 weeks or more: muted text "The content fills {x} of {d} weeks."
  - otherwise nothing.
- **"Add course"** (`can.edit`) opens the add course modal.
- Empty: "No courses yet. Add the courses a cohort of this program studies; they are attached to each new cohort."
  plus "Add course".

**Add course modal**:

- Course: searchable `USelectMenu` over `/api/programs/course-options` (fetched when the modal first opens), leaving
  out courses already in the curriculum. Each item: title, plus a "Not published" badge for unpublished courses.
  Unpublished courses can be added (decision; the cohort copy attaches whatever the curriculum holds); the badge is
  the only warning. If the backend spec refuses unpublished courses, disable them with the tooltip "Publish the
  course first".
- Starts: Week (default: the week after the current content ends, `weeksOfContent + 1`, or 1 when empty) and Day
  (default 1), same rules as Change start.
- "Add" sends one call; the course is appended at the end. Toast "{course} added". The modal closes; `program:<id>`
  refetches (counts and `weeksOfContent` change).
- When the course list answers 403 (a lead without course access, see Known gaps): the modal body shows "Only the
  head can add courses for now." and no form.

**Cohorts** section ("Cohorts", count):

- All cohorts of the program the user can see, every status, ordered active, planned, finished, then by start date
  (newest first). Columns: Cohort (name, link to `/cohorts/[id]`), Status badge (as in [cohorts](cohorts.md)),
  Dates "12 Jan – 13 Jul 2027", Week (same cell as the cohorts table: "starts …" / "3/26" / "finished …"), Students
  (`activeStudents`), Mentors (every staff mentor: avatars + names up to 3, then "+N"; none → "No mentor" warning
  badge).
- On mobile the table becomes one stacked row per cohort; no column is dropped.
- "Create cohort" (`can.createCohort`, active programs only): opens the cohort modal with this program preset and
  locked. On save go to the new cohort's page. Hidden on draft and archived programs, where the section shows the
  status note instead ("Activate the program to create cohorts." / "Restore the program to create cohorts.").
- Empty: "No cohorts yet." plus "Create cohort" when allowed.

**Load states**: 404 → "Program not found" with "Back to programs" (also for a draft the user can't see: the API
answers 404, never 403). Anything else → `HomeState` load error with Retry; never "not found" for a network error or
a 500. The cohorts list loads with the page (same route).

### Program modal (create / edit)

| Field | Create | Edit | Rules (client mirrors the API) |
|---|---|---|---|
| Title | required | yes | Trimmed 2–200 characters. |
| Slug | required, follows the title | yes, never auto-changed | 2–100 characters, `^[a-z0-9]+(-[a-z0-9]+)*$`. Unique (API: `slug_taken`). |
| Description | optional | yes | `UTextarea`, autoresize, ≤ 5000 characters, counter shown from 4500. Help: "Plain text; line breaks are kept." |
| Duration | required, default 26 | yes | Integer weeks 1–104. Help shows "~{months} months". |
| Cover | optional | yes, replace or remove | PNG, JPEG, WebP or GIF, ≤ 5 MB. See [Cover upload](#cover-upload). |
| Lead | optional | head only | Searchable select over `/api/people/options` (fetched on first open) + "No lead". The lead sees the field read-only with the current lead's name. |

- No status field (status changes through the header actions) and no position field.
- **Slug from title**: on create, while the user hasn't typed in Slug, Slug = `slugify(title)`. Once Slug is edited
  by hand it stops following; clearing it resumes following. `slugify`: lowercase; Cyrillic transliterated (Russian
  and Kazakh letters, a fixed map in `app/utils/slugify.ts`: щ→shch, ж→zh, э→e, ә→a, ғ→g, қ→k, ң→n, ө→o, ұ→u, ү→u,
  һ→h, і→i, ь/ъ dropped, …); anything outside `[a-z0-9]` → `-`; runs of `-` collapsed; trimmed at both ends; cut to
  100. Help under Slug: "Used in links. Changing it later doesn't break anything inside the LMS."
- **Edit** sends only the changed fields; an unchanged form closes without a request. Clearing the lead or the cover
  sends `null` (allowed for these two nullable fields only; `null` for any other field is `validation_error`).
- **Lead edits**: the lead field is read-only text. Nitro also drops `leadId` from a lead's request before calling
  the API (the API would refuse it anyway).
- Save is disabled while a cover upload is running. Errors per the [error table](#errors): field errors stay in the
  form, the modal stays open.
- Create: toast "Program created as a draft", go to `/programs/[id]`. Edit: toast "Program saved", refetch
  `program:<id>`, `invalidatePrograms()`.

### Cohort form changes

Owned by [cohorts](cohorts.md#cohort-modal-create--edit); summary:

- Program picker: `/api/programs/options` (key `program-options`, fetched when the modal opens): **active programs
  only**, in program order; for a lead-only user, only the active programs they lead. Drafts and archived programs
  are never offered. With no options: the select is disabled with "No active programs. Activate one on the Programs
  page." (lead: "None of your programs is active.").
- Opened from a program page: program preset and locked. Edit mode shows the cohort's program title as read-only
  text (the program may be archived and so missing from the options).
- End date: picking a start date (or another program) while End is untouched fills End = start + duration × 7 days.
  End is **optional** on create: left empty, the API sets it from the program's duration. Help: "Empty: {weeks}
  weeks from the start." Still required on edit.
- After create, the toast names the attached courses: "Cohort created · {n} courses attached" (n from the API); with
  0: "Cohort created. The program has no courses, so none were attached." (warning colour).

### Lead experience

- `/me/access` gains `programs: [{program_id, title, relation: "lead"}]`. `rolesOf()` adds `head` when the user leads
  at least one program. The session user gains `headScope`: `'all'` for admins and superusers (today's head rule),
  `'programs'` for a lead without admin rights. Computed at sign-in, like the other roles.
- Nav for `headScope = 'programs'`: Home, Cohorts, Programs. People and Contests are hidden, and their pages are
  marked `definePageMeta({ roles: ['head'], headScope: 'all' })`; the auth middleware answers 403 for a lead-only
  user.
- Head dashboard for a lead: the same widgets over the cohorts the API returns (their programs' cohorts); the pending
  invites block is hidden.
- `/cohorts`, `/cohorts/[id]`: unchanged screens; the API scopes the data and the lead has manager rights on their
  programs' cohorts. People pickers (Add staff, Add students "One person") use `GET /users/`, which the API opens to
  program leads (D11, decided).
- On program pages the lead gets `can.edit` and `can.createCohort` (when active) but not `can.manage`: no status
  actions, no delete, no lead field, no reorder.

### Student and mentor (read-only)

- Programs of their cohorts are active or archived (a program with cohorts can't go back to draft), so they can
  always read them. Program status never changes what a student or mentor sees of their cohort.
- Student dashboard: a program block next to the cohort line: cover thumbnail (fallback tile), program title,
  description clamped to 3 lines with "Show more". See [dashboards](dashboards.md#student).
- Mentor `/cohort` and mentor dashboard: the program title in each cohort header; on `/cohort` an "About the program"
  disclosure (collapsed) with cover and description. See [dashboards](dashboards.md#mentor).
- No program pages for them: `/programs` stays head-only.

## Behavior

### Status rules

The pages read `status` from the API and apply:

| Control | draft | active | archived |
|---|---|---|---|
| Visible to | head, lead | everyone signed in | everyone signed in |
| Listed on `/programs` tab | Draft | Active | Archived |
| Offered in the cohort form picker | no | yes | no |
| "Create cohort" on the program page | hidden, note | yes | hidden, note |
| Edit fields and curriculum | yes | yes | yes |
| Activate | yes | | |
| Archive | yes | yes | |
| Restore (→ active) | | | yes |
| Back to draft | | only with 0 cohorts | |
| Delete | only with 0 cohorts | | |
| Effect on existing cohorts, students, mentors | none | none | none |

If the status changed while the page was open (another head), a mutation answers `program_not_active`,
`program_has_cohorts` or `program_not_deletable`; the page shows the mapped message and refetches, which applies
the rules above.

### Curriculum snapshot

- A cohort gets a **copy** of the curriculum when it is created (same courses, same start offsets). Editing the
  curriculum later never changes existing cohorts, and removing a course from the program never removes it from a
  cohort. The UI says so above the curriculum and in the remove dialog.
- The copy count comes back from the create call and is shown in the toast.
- Course content (modules, lessons) is live: the counts on the program page are the course's current ones.

### Cover upload

The browser uploads straight to storage; Nitro only signs and confirms (backend `spec/integration/frontend.md`, File
uploads). One composable, `useFileUpload()`, reusable later by lessons and submissions.

1. On file choose: client checks type (`image/png`, `image/jpeg`, `image/webp`, `image/gif`) and size ≤ 5 MB;
   failures show under the field ("Choose a PNG, JPEG, WebP or GIF image." / "The image is larger than 5 MB.") and
   nothing is sent.
2. `POST /api/files {filename, contentType, size}` → Nitro → `POST /files/` → `{fileId, uploadUrl, headers}`.
3. Browser `PUT uploadUrl` with the file as body and exactly `headers`; no credentials, no `Authorization`.
4. `POST /api/files/[id]/complete` → Nitro → `POST /files/{id}/complete`.
5. The form keeps `coverFileId` and shows a local preview (`URL.createObjectURL`, revoked on close). The program is
   only changed on Save (`cover_file_id`).

- While steps 2–4 run, the field shows a spinner and "Uploading…"; Save is disabled. A failure at any step shows
  "Upload failed. Try again." (or the mapped `upload_mismatch` message) and clears the chosen file.
- "Remove cover" clears the preview; on edit, Save sends `cover_file_id: null`.
- Cancelling the modal after an upload leaves an unused file in storage (accepted, see Known gaps).
- `coverUrl` from the API is a short-lived download URL (5 minutes). Never store it; an `<img>` error falls back to
  the initials tile. Revisiting the page refetches.

### Plurals

Counts use vue-i18n plural messages, `t(key, n)`, never "{n} модулей" for every n:

- `i18n/i18n.config.ts` (new, picked up by `@nuxtjs/i18n`) sets `pluralRules.ru` from `Intl.PluralRules('ru')`:
  `one` → form 0, `few` → form 1, `many` / `other` → form 2. English uses the default two forms.
- Messages: `ru` "{n} модуль | {n} модуля | {n} модулей", `en` "{n} module | {n} modules". Same for weeks (неделя),
  months (месяц), courses (курс), lessons (урок), cohorts (когорта), students (студент).
- Applies to every count on the program pages and to `home.cohortMembers`, which these pages reuse. Check: 1, 2, 5,
  11, 21, 22, 25 render "1 модуль, 2 модуля, 5 модулей, 11 модулей, 21 модуль, 22 модуля, 25 модулей".

### Errors

Pages read the API code with `apiError(e).code` and switch on it, never on the HTTP status (`toH3Error` turns
`slug_taken` into 409). Messages live under `programs.err.<code>` in both locales; unlisted codes fall back to
`common.saveError`.

| Code | HTTP | Can happen on | Message (en) | Shown as / then |
|---|---|---|---|---|
| `slug_taken` | 422 (409 via Nitro) | create, edit | "Another program already uses this slug." | Field error on Slug |
| `validation_error` | 422 | create, edit, curriculum, order | The field message from `apiError(e).field(name)`: `title`, `slug`, `description`, `duration_weeks`, `cover_file_id`, `lead_id` → the matching field; `start_offset_days` → the Week input; otherwise the API's message | Field error; toast when no field matches |
| `program_not_active` | 422 | cohort create | "This program isn't active, so cohorts can't be created in it." | Error on the Program field of the cohort modal; refetch `program-options` (and `program:<id>` when opened from the program page) |
| `program_has_cohorts` | 422 | back to draft | "This program has cohorts, so it can't go back to draft." | Toast; refetch |
| `program_not_deletable` | 422 | delete | "Only a draft program without cohorts can be deleted." | Toast; refetch |
| `invalid_transition` (or the code the backend spec names) | 422 (409 via Nitro) | status actions | "That change isn't possible any more; the page was refreshed." | Toast; refetch |
| `no_such_file` | 404 | create, edit (cover) | "The cover image is missing. Upload it again." | Field error on Cover; clear the file |
| `upload_mismatch` | 422 | upload complete; create, edit | "The upload didn't finish. Upload the image again." | Field error on Cover; clear the file |
| `user_not_found` | 404 | lead change | "This person can't be the lead (account inactive or removed)." | Field error on Lead; refetch `people-options` |
| `course_not_found` | 404 | add course, change start, remove | "This course no longer exists." | Toast; refetch `program:<id>` and course options |
| `forbidden`, `permission_denied` | 403 | any mutation | "You can't do this here." | Toast; refetch (the controls follow `can`). Programs v2 moves cohort-mutation checks into the service, so those routes answer `permission_denied` (and 404 before 403); treat both codes alike |
| `program_not_found` | 404 | detail load; any mutation | Load: "Program not found" + "Back to programs". Mutation: toast "This program no longer exists", go to `/programs` | |

Cover type and size are checked on the client first; if the API still rejects the file as a cover it answers
`422 cover_invalid` (not an image, over 5 MB, or not visible to the caller): show it on the cover field.

### Cache keys

The program page and the cohort form picker no longer share one key (the old shared `programs` key made the picker
load the heavy endpoint and get emptied by `invalidateCohorts()`).

| Key | Fetched by | Holds |
|---|---|---|
| `programs` | `/programs` | All visible programs as cards (`ProgramList`) |
| `program:<id>` | `/programs/[id]` | Detail, curriculum, cohorts |
| `program-options` | Cohort modal (on open) | Light list: active programs, `{id, title, durationWeeks}` |
| `program-course-options` | Add course modal (on first open) | Courses `{id, title, published}` |
| `people-options` | Program modal lead picker (on first open) | As in [cohorts](cohorts.md#cache-keys) |

`invalidatePrograms()` in `app/utils/` clears `programs`, every `program:*` and `program-options`, plus the
cohort-derived keys that show program titles (`cohorts:*`, `cohort:*`, `cohort-options`, `cohorts-mine`,
`dashboard-head`, `dashboard-mentor`). It runs after every program mutation that changes title, status, lead,
cover or order; curriculum changes refresh only `program:<id>`. `invalidateCohorts()` keeps clearing `programs` and
adds `program:*` (cohort counts and student totals change), but no longer touches `program-options`.

| Mutation | Refresh on the page | Also |
|---|---|---|
| Create | none | Navigate to the new program |
| Edit, status action | `program:<id>` | `invalidatePrograms()` |
| Delete | none | `invalidatePrograms()`; navigate to `/programs` |
| Reorder programs | `programs` on error only | Clear `program-options` |
| Curriculum add / remove / start / order | `program:<id>` | |
| Create cohort from the page | none | `invalidateCohorts()`; navigate to the cohort |

On any mutation error, refetch the affected keys so the UI resets to the server value.

## API

Program manage routes use `requireRole(event, 'head')` (a lead has the head view); the API's own permission and
scope checks still apply. Nitro reads `/me/access` where it computes `can`: `manage` = permissions include
`program.update`; `edit` = `manage` or the user leads this program; `createCohort` = status active and
(`cohort.create` or lead); list `create` = `program.create`, `reorder` = `program.update`. Pages call only these
routes. Status actions are explicit endpoints, like cohort `/finish` (names per backend `spec/domain.md`; generated
types win).

| UI call (Nitro) | API calls | Request → response mapping |
|---|---|---|
| `GET /api/programs` | `GET /programs/` (all statuses the caller sees), `/me/access` | One API call for the data, no cohort or staff calls. Lead-only: keep programs whose `lead.id` is the user. → `ProgramList {programs: ProgramRow[], can: {create, reorder}}`; `ProgramRow`: `id, slug, title, status, durationWeeks, position, coverUrl` (`cover_url`), `lead: Person \| null`, `courseCount` (`courses.length`, or the API's count field), `cohortCounts {planned, active, finished}` (`cohorts`), `activeStudents`, `updatedAt`. (changed) |
| `GET /api/programs/options` | `GET /programs/?status=active`, `/me/access` | → `ProgramOption[] {id, title, durationWeeks}` in API order; without `cohort.create`, only programs the user leads. Cohort modal only. (new) |
| `GET /api/programs/[id]` | in parallel: `GET /programs/{p}`, `GET /cohorts/?program_id={p}`, `/me/access` (mentors come with each cohort list item) | → `ProgramDetail`: `ProgramRow` fields + `description`, `weeksOfContent`, `courses: ProgramCourse[] {courseId, title, position, startOffsetDays, modules, lessons}`, `cohorts: ProgramCohort[] {id, name, status, startsOn, endsOn, finishedAt, week, totalWeeks, activeStudents, mentors: Person[]}` (mentors = the list item's `mentors`, all of them), `can {edit, manage, createCohort}`. (new) |
| `POST /api/programs` `{title, slug, description?, durationWeeks, coverFileId?, leadId?}` | `POST /programs/ {title, slug, description, duration_weeks, cover_file_id, lead_id}` | zod mirrors the field rules; no `status` (API creates a draft), no `position` (API appends). 201 → `{id, title}`. (new) |
| `PATCH /api/programs/[id]` `{title?, slug?, description?, durationWeeks?, coverFileId?, leadId?}` | `PATCH /programs/{p}` with only the given fields | zod: optional; `coverFileId` and `leadId` nullable, the rest non-nullable; strict. Lead-only: `leadId` dropped. → `{ok}` (new) |
| `POST /api/programs/[id]/activate` · `/archive` · `/draft` | `POST /programs/{p}/activate` · `/archive` · `/draft` | Restore = activate on an archived program. → `{status}` (new) |
| `DELETE /api/programs/[id]` | `DELETE /programs/{p}` | API 204 → `{ok}` (new) |
| `PUT /api/programs/order` `{ids}` | `PUT /programs/order {ids}` | Full id list, as built by the page. → `{ok}` (new) |
| `GET /api/programs/course-options` | `GET /courses/` | → `{id, title, published}[]` (`is_published`). 403 passed through; the modal handles it. (new) |
| `PUT /api/programs/[id]/courses/[courseId]` `{startOffsetDays, position?}` | `PUT /programs/{p}/courses/{course} {start_offset_days, position}` | Add (no `position`: appended) or change start. → `{ok}` (new) |
| `DELETE /api/programs/[id]/courses/[courseId]` | `DELETE /programs/{p}/courses/{course}` | → `{ok}` (new) |
| `PUT /api/programs/[id]/courses/order` `{courseIds}` | `PUT /programs/{p}/courses/order {course_ids}` | → `{ok}` (new) |
| `POST /api/files` `{filename, contentType, size}` | `POST /files/ {filename, content_type, size}` | Signed-in users. Nitro also enforces image types ≤ 5 MB here (only covers use this route for now). → `{fileId, uploadUrl, headers}` (new) |
| `POST /api/files/[id]/complete` | `POST /files/{id}/complete` | → `{fileId}` (new) |
| `POST /api/cohorts` `{name, programId, startsOn, endsOn?}` | `POST /programs/{p}/cohorts {name, starts_on, ends_on?}` | `ends_on` sent only when given. → `{id, name, coursesAttached}` (from the API's attached count). (changed, see [cohorts](cohorts.md#api)) |
| `GET /api/dashboard/mentee`, `GET /api/cohorts/mine` | + `GET /programs/{p}` once per distinct program | Adds `program: ProgramSummary {id, title, description, coverUrl}` to the cohort. (changed, see [dashboards](dashboards.md)) |

Removed: `server/data/programs.ts`; in `server/utils/db.ts` its import, the `programs` field and `programTitle()`
(the mock keeps its own `ProgramSlug` keys for mock courses and assignments); `cohortMentor()` in `server/utils/lms.ts`
(its last user was `/api/programs`); the `Program` (`months`, `modules`) and `ProgramView` types, replaced by
`ProgramRow`, `ProgramDetail`, `ProgramCourse`, `ProgramCohort`, `ProgramOption`, `ProgramSummary`; the per-cohort
staff calls of the list route; `programs.editSoon`, `programs.noModules`, the old `programs.modules` key.
`app/pages/programs.vue` becomes `app/pages/programs/index.vue` and `app/pages/programs/[id].vue`.

## Acceptance criteria

Verified by `npm run typecheck` and, against a local backend with programs v2, `scripts/e2e-smoke.py` extended for
the items marked (e2e) (the seed creates the program through `POST /api/programs` instead of straight on the API);
the rest by the manual check the item describes.

### `/programs`

- [ ] A program created as a draft appears under Draft only; after Activate it moves to Active (e2e).
- [ ] The Active tab is the default and has no `status` in the URL; switching to Archived puts `status=archived` in
  the URL and reload keeps it.
- [ ] Loading the list makes one `GET /programs/` call plus `/me/access`, and no `…/staff` or `GET /cohorts/` calls;
  the route answers with `cohortCounts` and `activeStudents` from the API (e2e).
- [ ] A card shows cover (or the initials tile), title, "26 недель · ~6 месяцев · 3 курса", the non-zero cohort
  counts, active students and lead; nothing of it is hidden on a 375 px wide screen.
- [ ] A program whose cover fails to load shows the initials tile, not a broken image.
- [ ] Moving a program up sends one `PUT /programs/order` with every id; after reload the order holds, and the cohort
  form picker uses the same order (e2e).
- [ ] With zero programs the page shows the empty state and "Create program"; an empty tab names the tab.
- [ ] A lead-only user sees only programs they lead, without "Create program" or reorder buttons.

### `/programs/[id]` header and status

- [ ] Draft shows Activate, and Archive and Delete in the menu; active shows Archive, and Back to draft only with no
  cohorts; archived shows Restore. A lead sees none of them.
- [ ] Activate, Archive and Restore each confirm first and change the badge after confirming (e2e: draft → active →
  archived → active).
- [ ] Activating a program with an empty curriculum shows the "curriculum is empty" warning in the dialog.
- [ ] Archiving a program with a running cohort leaves the cohort active and listed on `/cohorts`; the program is gone
  from the cohort form picker (e2e).
- [ ] Back to draft is not offered once the program has a cohort; forcing it (API) shows the `program_has_cohorts`
  message.
- [ ] Deleting an empty draft returns to `/programs` with "Program deleted"; the program is gone (e2e).
- [ ] An unknown id, or a draft the user can't see, shows "Program not found"; a 500 shows the load error with Retry.

### Program modal

- [ ] Typing the title "Бэкенд на Python" fills the slug "bekend-na-python"; editing the slug by hand stops it
  following the title.
- [ ] A slug already used by another program shows the slug-taken message under Slug (e2e).
- [ ] Title of 1 character, slug "Bad Slug", duration 0 or 105, and a 5001-character description are refused in the
  form before any request.
- [ ] Create sends no `status` and no `position`; the new program is a draft on its own page (e2e).
- [ ] A 6 MB image or a PDF as cover is refused before any upload request.
- [ ] Choosing a PNG cover uploads it (sign, PUT, complete), shows the preview, and after Save the card and header show
  it (e2e: file signed and completed through `/api/files`, `cover_file_id` saved, `coverUrl` returned).
- [ ] Removing the cover and saving sends `cover_file_id: null`; the initials tile shows.
- [ ] Editing only the duration sends only `duration_weeks`; an unchanged form sends nothing.
- [ ] The lead field is a picker for the head and read-only text for the lead; a lead's PATCH never contains
  `lead_id`.

### Curriculum

- [ ] Adding three courses lists them in order with "Week N", module and lesson counts (e2e).
- [ ] The second course's default start is the week after the current content ends.
- [ ] Changing a start to week 3, day 2 sends `start_offset_days = 15` and the row shows "Week 3, day 2".
- [ ] Moving a course down sends one order call with all course ids; reload keeps the order.
- [ ] Removing a course confirms, says existing cohorts keep it, and removes the row.
- [ ] Content longer than the duration shows the warning hint; shorter by 2+ weeks shows the muted hint.
- [ ] The "changes apply to new cohorts only" note is shown above the curriculum.
- [ ] A course with no modules shows "No modules yet".

### Cohorts on the program page and the cohort form

- [ ] The section lists every cohort of the program with status, dates, week, students and **all** its mentors (e2e:
  a two-mentor cohort lists both).
- [ ] "Create cohort" opens the cohort modal with the program locked and, after picking a start date, the end date
  = start + duration × 7 days.
- [ ] Creating a cohort in a program with 3 courses toasts "3 courses attached" and the cohort has those courses with
  the same offsets (e2e).
- [ ] Creating a cohort with the end date left empty succeeds and the cohort ends start + duration weeks (e2e).
- [ ] The cohort form picker lists active programs only, never drafts or archived ones (e2e: `/api/programs/options`
  returns only active).
- [ ] The picker loads `/api/programs/options` and never `/api/programs`; finishing a cohort doesn't empty it.
- [ ] Creating a cohort in a program archived meanwhile shows the `program_not_active` message on the Program field.
- [ ] Draft and archived program pages show the note instead of "Create cohort".

### Lead

- [ ] A user made lead of a program (not admin) signs in and gets the head view with Home, Cohorts and Programs in the
  nav; `/people` answers 403 (e2e: session roles include head).
- [ ] The lead edits the program's description and curriculum and creates a cohort in it (e2e).
- [ ] The lead sees no status actions, delete, reorder or lead picker.
- [ ] The lead's cohort form picker lists only their active programs.

### Students and mentors

- [ ] A student's dashboard shows their cohort's program title, cover and description (e2e: `program` in
  `/api/dashboard/mentee`).
- [ ] After the program is archived, the student's dashboard and assignments are unchanged.
- [ ] A mentor's `/cohort` shows the program title per cohort and the "About the program" disclosure.

### Plurals, errors and cache

- [ ] Russian counts read "1 курс, 2 курса, 5 курсов, 21 курс" (and the same for modules, lessons, weeks, months,
  cohorts, students); "1 модулей" appears nowhere.
- [ ] Every code in the error table has an `en` and a `ru` message; no listed code shows `common.saveError`.
- [ ] After renaming a program, `/cohorts`, the cohort page and the head dashboard show the new title on the next
  visit without a reload.
- [ ] `server/data/programs.ts` no longer exists and nothing imports it; `npm run typecheck` passes.

## Known gaps

- **Markdown**: the description is stored as markdown but shown as plain text with line breaks; no renderer is
  installed. Add one together with lesson text rendering.
- **Mentors in the cohort list**: resolved in the backend spec: `GET /cohorts/` items carry `mentors: [{id, name}]`.
  The program page and `/cohorts` read them there; no `…/staff` call per cohort.
- **Lead and course picker**: resolved in the backend spec: program leads and `program.update` holders may call
  `GET /courses/`.
- **New leads see the head view only after signing in again**: roles are computed at sign-in.
- **Orphan uploads**: a cover uploaded and then cancelled stays in storage unused; no cleanup yet.
- **One lead per program**; several leads, applications/selection (S3.4), tracks (S3.5), payments and a public
  catalog are out of scope.
- **No propagation**: curriculum changes never reach existing cohorts; attaching or detaching courses on a single
  cohort still has no UI ([O10](../open-items.md)).
- **Course authoring** (creating courses, modules, lessons) still has no UI ([O10](../open-items.md)); the
  curriculum can only use courses that already exist.
