# Cohorts

**Roles:** head (manage), mentor and reviewer (read, review), student (studies in one) · **Data:** API

A cohort is a group of students taking a program between two dates. The head creates it, staffs it with mentors
and reviewers, enrolls students, gives each student a mentor, and finishes it. Mentors follow their students and
review their work. Success: the head can run a cohort from creation to archive without leaving this screen, and the
UI never offers an action the API will refuse.

Status v2 ("cohort logic v2", 2026-10-16). The API owns cohort status, week numbers and every rule below; the UI
shows them and hides what isn't allowed. Contract: `../backend/spec/domain.md` (cohort lifecycle) and
`../backend/openapi.json` (`npm run api:types`). Where a field name below differs from the generated types, the
types win and this spec gets corrected.

## Screens

| Route | Who | What it shows / does |
|---|---|---|
| `/cohorts` | head | Status filter (Active, Planned, Finished; Active + Planned by default), cohorts table, "Create cohort". |
| `/cohorts/[id]` | head | Header (name, program, status, dates, week), status-dependent actions, Staff, Roster, Add students, Invited ([invites](invites.md#cohortsid-invited-section-new)), [Assignments](assignments.md). Read-only banner when finished. |
| Cohort modal | head | Create and edit: name, program (create only), start date, end date. |
| Add students modal | head | One person, invite by email ([invites](invites.md)), or a CSV file with a result report. |
| `/cohort` | mentor, reviewer | Every cohort they staff: header, roster (read-only), assignments. Finished cohorts collapsed. |
| `/`, `/assignments`, `/assignments/[id]` | student | A finished cohort's work stays readable; submitting is closed. See [Student side](#student-side) and [dashboards](dashboards.md). |

### `/cohorts` (list)

- **Filter**: a toggle group with three buttons, Active, Planned, Finished. Any combination; at least one stays on
  (turning off the last one does nothing). Default Active + Planned. Kept in the URL as
  `?status=active&status=planned` so reload and back keep it; no `status` in the URL means the default.
- **Table** (`CohortsTable`), sortable as now, default sort by at-risk descending:

| Column | Content |
|---|---|
| Cohort | Name (link to `/cohorts/[id]`), program title below. |
| Status | Badge: Planned (neutral), Active (primary), Finished (muted). |
| Mentors | Avatar + name of each staff mentor, up to 2, then "+N". None: warning badge "No mentor". When active/paused students lack a mentor: small warning text "N without a mentor". |
| Students | `active_students` from the API (not computed). |
| Week | Planned: "starts 12 Jan". Active: "3/26" (API `week`/`total_weeks`). Finished: "finished 3 Mar" (`finished_at`), muted. |
| Lessons | Mean share of released lessons completed over non-dropped students, "—" when no students. |
| At risk | Count of active students at risk (rule O9), "—" when 0. |
| Review backlog | Submissions waiting for review, emphasised at 5+. |

- "Create cohort" opens the cohort modal; on save, go to the new cohort's page.
- The head dashboard shows the same table without the Status column (`compact`): there the Week cell already says
  "starts …" / "finished …", and eight columns don't fit beside the rail.
- Empty: "No cohorts" naming the current filter ("No finished cohorts").
- Loading: `HomeState` skeleton. Error: `HomeState` load error with Retry.

### `/cohorts/[id]` (detail)

**Pages** (2026-10-19): Students (25 per page; current students, plus inactive ones when shown), Assignments and
Solutions (10 per page) page on the client (`usePaged`, `ListPager`: "21–40 of 57" and page buttons, hidden while
everything fits). The API returns each list in one call, so there are no extra requests. "Select all" in the roster
still selects every current student, not only the page.

**Header**: name; program title; status badge; dates "12 Jan – 13 Jul 2027"; then by status:

| Status | Week line | Actions (right) |
|---|---|---|
| planned | "Starts 12 Jan" | Edit · Cancel cohort · Delete (only with no enrollments at all, dropped included) |
| active | "Week 3 of 26" (API) | Edit · Finish cohort |
| finished | "Finished 3 Mar 2027" (`finished_at`) | none |

- **Finish cohort** (active) opens a confirm dialog:
  > Finish "{name}" now? **{n}** active and paused students become completed and the cohort becomes read-only:
  > no edits, enrolling, status changes, staff or mentor changes. Students keep read access to released lessons but
  > can't complete lessons or submit work. Mentors can still review the **{m}** submissions waiting. This can't be
  > undone.

  Buttons: "Finish cohort" (error colour) and "Keep running". `n` = roster rows with status active or paused; `m` =
  sum of waiting submissions in the roster.
- **Cancel cohort** (planned) is the same call with its own text:
  > Cancel "{name}"? It is marked finished and can't be reopened. {n} enrolled students become completed.
  > To run it later, change its dates instead.
- **Delete** (planned, roster empty): "Delete "{name}"? This can't be undone." On success go to `/cohorts` with a
  toast "Cohort deleted". Hidden in every other case (the API refuses: `cohort_not_deletable`).
- **Finished banner** (`UAlert`, neutral, under the header): "This cohort finished on {date}. It is read-only.
  Mentors can still review submissions sent before the end." Every mutating control on the page is hidden (see
  [state rules](#state-rules-per-cohort-status)).
- **Planned note** (muted text under the header): "Lessons open from {start date}."

**Staff** section ("Staff", count):

- One row per staff member: initials, name, username, role badge (Mentor / Reviewer). (The staff list has no email;
  corrected from the types.) Mentors also show their load:
  "{k} students" (roster rows whose mentor is this user; active and paused only). Sorted mentors first, then by name.
- One line under the heading: "Mentors review their own students; reviewers review everyone."
- Row menu (not when finished): "Make reviewer" / "Make mentor", "Remove from staff".
  - Mentor → reviewer, or removing a mentor, with `k > 0` asks first: "{name} mentors {k} students. They'll have no
    mentor until you assign one." Toast after: "{name} removed. {k} students have no mentor now." (`k` in the toast
    is the API's `unassigned_mentees`, not the client count.)
  - Removing a reviewer, or a mentor with `k = 0`: no dialog.
- "Add staff" (not when finished) opens a small modal: person (searchable, from [`/api/people/options`](#api)),
  role (Mentor default, Reviewer). The picker leaves out current staff and anyone enrolled here as active, paused or
  completed (they'd get `student_cannot_be_staff`). Dropped students may be picked.
- Empty: "No staff yet. Add a mentor so students get feedback." with the "Add staff" button.

**Roster** section ("Students", count = active + paused; "+ N inactive" when completed/dropped exist):

- Data: `GET /api/cohorts/[id]/roster` (one API call, `GET /cohorts/{c}/roster`), fetched separately from the
  header so roster changes don't reload assignments.
- Toolbar (not when finished): "Add students", "Auto-assign mentors (N)" where N = active/paused students without a
  mentor; disabled with a tooltip when N = 0 ("Everyone has a mentor") or there are no mentors ("Add a mentor
  first"; the API would answer `422 not_a_mentor`).
- Columns:

| Column | Content |
|---|---|
| ☐ | Checkbox, head only, not when finished; only on active/paused rows. Header checkbox selects all selectable rows. |
| Student | Avatar, name, username. Muted for completed/dropped. |
| Mentor | Head, not finished, active/paused row: inline select of the cohort's mentors + "No mentor"; saves on change. Otherwise the mentor's name or "—". |
| Assignments | Accepted / total assignments of the cohort. |
| Lessons | Completed / released (`progress.completed` / `progress.released_lessons`). Header "Lessons", never "Courses". |
| In review | Waiting submissions; "overdue" badge when `overdue_submitted > 0` (waiting over 48 h). |
| Last activity | Relative time of `last_activity_at` ("3 days ago", absolute date in a tooltip); "—" when none. |
| Flags | Status badge when not active; else "at risk" when the rule (O9) holds. Row menu ⋯ (see below). |

- Order: active and paused first, then completed, then dropped; by name within each group. Completed and dropped
  rows are collapsed behind "Show N inactive students" (expanded state is local, not persisted).
- **Bulk bar** (appears when ≥1 row is selected): "{n} selected · Assign mentor ▾ (the cohort's mentors and "No
  mentor") · Clear". Assigning sends one bulk call; "No mentor" sends one unassign per selected row that has a
  mentor. Selection clears after success.
- **Row menu** (head, not finished) shows only the transitions the API allows for that row:

| Current status | Menu items |
|---|---|
| active | Pause · Mark completed · Drop · Move to another cohort… |
| paused | Resume (→ active) · Drop · Move to another cohort… |
| dropped | Re-activate (→ active) |
| completed | no menu button |

  - Drop and Mark completed confirm first: "Drop {name}? Their mentor assignment is removed. You can re-activate
    them later." / "Mark {name} as completed? Their mentor assignment is removed and this can't be undone here."
  - Pause / Resume / Re-activate apply directly. A re-activated student has no mentor (it was removed on drop); the
    "without a mentor" count and the Auto-assign button reflect that.
- **Move to another cohort…** opens a dialog: target cohort (select of planned and active cohorts except this one,
  each "name · program · status"; finished cohorts never listed), and the text:
  > {name} will be enrolled in {target} and dropped here. **Progress and submissions don't carry over**: they stay
  > with this cohort, and {name} starts {target} from zero. Their mentor here is removed; assign one in {target}.

  Confirm "Move". One API call (`POST /enrollments/{id}/move`); success toast "{name} moved to {target}" with a
  link to the target cohort.
- Empty roster: "No students yet." plus "Add students" (not when finished).
- Loading: table skeleton (5 rows) under a loaded header. Error: inline "Couldn't load the roster" + Retry; the
  header and staff stay usable.

### Cohort modal (create / edit)

| Field | Create | Edit when planned | Edit when active | Rules |
|---|---|---|---|---|
| Name | yes | yes | yes | 2–200 characters after trimming. Unique per program, case-insensitive (API: `cohort_name_taken`). |
| Program | required select of **active** programs (`/api/programs/options`, key `program-options`, fetched on open); preset and locked when opened from a program page | read-only text of `programTitle` ("A cohort can't change program") | same | Drafts and archived programs are never offered; a lead-only user sees only the active programs they lead. No options: disabled, "No active programs. Activate one on the Programs page." ([programs](programs.md#cohort-form-changes)) |
| Start date | required | yes | disabled, help "The cohort has started; its start date is fixed." | Before the end date. |
| End date | optional, pre-filled | required | required, `min` = today | After the start date; when active, today or later. Create: not in the past; left empty, the API sets start + the program's `duration_weeks` × 7 days (help "Empty: {weeks} weeks from the start."). |

- No mentor field (staff is managed in the Staff section) and no status field (status is server-controlled).
- Create: picking a start date or a program while the end date is untouched pre-fills end = start + the program's
  `durationWeeks` × 7 days. After create, the toast names the courses the API attached from the program: "Cohort
  created · {n} courses attached"; with 0, a warning toast "Cohort created. The program has no courses, so none were
  attached." Hints:
  start today or earlier → "Starts immediately: the cohort will be active."; editing a planned cohort's start to
  today or earlier → "Saving starts the cohort now. Its start date is then fixed."
- Edit sends only the fields that changed; an unchanged form saves nothing and just closes.
- Client validation mirrors the rules above; server errors map per the [error table](#errors): field errors stay in
  the form, the modal stays open.
- The modal never fetches `/api/people`.

### Add students modal

Three tabs: "One person", "Invite by email" ([invites](invites.md#add-students--invite-by-email-new)),
"CSV file".

**One person**: searchable select over `/api/people/options` (fetched when the modal first opens, not when the page
loads). Lists everyone except this cohort's staff and students enrolled here as active, paused or completed.
Dropped students of this cohort are listed with the suffix "(dropped, re-add)". "Add" → success toast "{name}
added" or, when the API reactivated a dropped enrollment, "{name} re-added". The modal closes; the roster refreshes.

**CSV file**: file input (`.csv`, `text/csv`), help: "UTF-8. One email per line, or a column named `email`. Up to
2000 rows. People with an account are added; the others get an invite by email." Client checks before upload: a file is chosen, size
≤ 1 MB. "Import" uploads; then the modal shows the report instead of the form:

| Group (API field) | Text |
|---|---|
| `enrolled` | "Added: {n}" |
| `reactivated` | "Re-added (were dropped): {n}" |
| `already_enrolled` | "Already in this cohort: {n}" |
| `invited` | "Invited: {n}". No account: a cohort invite was emailed ([invites](invites.md)). |
| `resent` | "Invite re-sent: {n}". Had an open invite to this cohort; new link and expiry. |
| `unknown` | "Not a valid email or account deactivated: {n}". "Copy emails" copies the list, one per line. |
| `skipped_staff` | "Skipped, on this cohort's staff: {n}" |

Each group with n > 0 expands to its email list; groups with 0 are hidden; all zero → "The file had no emails."
Buttons: "Import another file" (back to the form) and "Done". The roster (and, with cohort invites, the Invited
section) refreshes as soon as the report arrives.

### `/cohort` (mentor and reviewer)

- One section per cohort the user staffs (`/me/access`, relation mentor or reviewer), ordered active, planned, then
  by start date. Finished cohorts sit under a collapsed "Finished cohorts (n)" disclosure, each still showing its
  roster (their review backlog stays reachable from `/reviews`).
- Header: name, program, status badge, week line as on the head page, "{n} students" where n = active + paused.
- Roster: the same table read-only (no checkboxes, selects or menu); the Mentor column shows names.
- Filter "My students / Everyone": shown to mentors who mentor at least one student in that cohort, default "My
  students". Reviewers and mentors without mentees see everyone.
- Completed and dropped rows collapsed as on the head page; counts never include them.
- Assignments section as today; not editable in a finished cohort.
- Empty: "You don't have a cohort assigned yet." Loading and error: `HomeState`.

### Student side

- **Dashboard** (`/`): see [dashboards](dashboards.md#student).
- **`/assignments`**: current work from cohorts where the enrollment is active (as now), plus one "Archive · {cohort}"
  group per finished cohort the student completed, collapsed, items read-only with their last status. Paused or
  dropped enrollments show nothing.
- **`/assignments/[id]`** in a cohort that isn't active: the submit form is replaced by a notice. Finished → "This
  cohort finished on {date}. Submissions are closed; your mentor can still review work you already sent." Planned →
  "This cohort starts on {date}." Earlier submissions and feedback stay visible. If a submit still answers
  `cohort_not_active`, show the same notice and reload the page data.
- **Lessons**: there is no student lesson screen yet. When one is built: released lessons of a finished cohort open
  read-only; "Mark complete" is disabled with "This cohort has finished".

## Behavior

### State rules per cohort status

The page reads `status` from the API (never from dates) and applies:

| Control | planned | active | finished |
|---|---|---|---|
| Edit (modal) | yes | yes, start date locked | hidden |
| Finish / Cancel cohort | Cancel | Finish | hidden |
| Delete | only with an empty roster | hidden | hidden |
| Add students (one / invite by email / CSV) | yes | yes | hidden |
| Invited section: resend / revoke ([invites](invites.md)) | both | both | revoke only |
| Roster row menu (status, move) | yes | yes | hidden |
| Mentor select, bulk bar, Auto-assign | yes | yes | hidden (names shown) |
| Staff add / role / remove | yes | yes | hidden |
| Assignments: add / edit / delete | as [assignments](assignments.md) | same | hidden |
| Listed as a Move target | yes | yes | no |
| Read-only banner | no | no | yes |
| Students: open released lessons | nothing released | yes | yes, read-only |
| Students: submit / complete | no | yes (enrollment active) | no |
| Mentors: review waiting submissions | yes | yes | yes |

If the cohort changes status while the page is open (the nightly job, another head), a mutation answers
`cohort_finished` or `cohort_started`; the page shows the mapped message and refetches, which applies the new rules.

### Enrollment transitions

Allowed manual transitions (the row menu shows exactly these):

| From \ to | active | paused | completed | dropped |
|---|---|---|---|---|
| active | | yes | yes | yes |
| paused | yes | | | yes |
| dropped | yes | | | |
| completed | | | | |

- `completed` also happens automatically when the cohort finishes (active and paused → completed; dropped stays).
- Becoming `dropped` or `completed` removes the student's mentor assignment (API). The roster refetch shows it.
- **Re-enroll**: adding a person whose enrollment here is `dropped` reactivates it (API answers 200 instead of 201);
  the UI says "re-added". Adding someone active, paused or completed here is refused (`enrollment_exists`); the
  picker doesn't offer them.
- **Move** is one atomic call. Only active or paused students can be moved (the menu hides Move otherwise). The
  target can be any visible planned or active cohort, in any program. If the target has a dropped enrollment for
  the student, it is reactivated. Progress and submissions don't move (they belong to the enrollment): the dialog
  says so.

### Mentor assignment rules

- A cohort has any number of mentors and reviewers (staff). Each student has at most one mentor, who must be a
  staff mentor of the same cohort. Staff can't be students of the same cohort and vice versa.
- Only active and paused students can have a mentor; the select and checkboxes appear only on those rows.
- Per-row select, bulk assign and Auto-assign use the API's bulk and auto endpoints; the UI never loops over
  students.
- Auto-assign spreads students without a mentor across mentors by current load (API: round-robin by load, ties by
  mentor id). Toast: "Assigned {n} students" (n from the response).
- Removing a mentor from staff, or making them a reviewer, unassigns their students (API, same transaction); the UI
  warns first with the count and reports the API's count after.
- There is no "cohort mentor" any more: nothing assigns a mentor to new students automatically, and nothing picks
  "the first mentor" to show as the cohort's mentor. Places that showed one now show the list of mentors (cohorts
  table, head dashboard) or the student's own mentor (student side).

### Week and status

- `status`, `week`, `total_weeks` and `finished_at` come from the API on every cohort (list and detail). Nitro
  passes them through; there is no date maths for week or status in the frontend (`cohortWeeks`, `cohortStatus`,
  `cohortDates` are removed). `total_weeks` is always set now that `ends_on` is required, so `useWeekLabel`'s
  "week N" without a total goes away.
- Week label: planned (`week = 0`) → "starts {date}"; finished → "finished {date}"; else "week {week} of {total}".
- Dates are calendar dates (UTC, D5): format with the locale, never shift by timezone.

### Errors

Pages read the API code with `apiError(e).code` (the Nitro error's `statusMessage`) and switch on it, never on the
HTTP status: Nitro's `toH3Error` turns `enrollment_exists` and `invalid_transition` into 409 while the API sends
422. Messages live under `cohorts.err.<code>` in both locales. Unlisted codes fall back to `common.saveError`.

| Code | HTTP | Can happen on | Message (en) | Shown as / then |
|---|---|---|---|---|
| `cohort_name_taken` | 422 | create, edit | "This program already has a cohort with this name." | Field error on Name |
| `cohort_started` | 422 | edit start date | "The cohort has started; its start date can't change." | Field error on Start date; refetch header |
| `cohort_ends_in_past` | 422 | create | "The end date is in the past." | Field error on End date |
| `program_not_active` | 422 | create | "This program isn't active, so cohorts can't be created in it." | Field error on Program; refetch `program-options` |
| `validation_error` | 422 | create, edit; CSV not UTF-8 or over 1 MB | The field message from `apiError(e).field(name)` (`name`, `starts_on`, `ends_on` → the matching input); otherwise the API's message | Field error; CSV: under the file input |
| `cohort_finished` | 422 | any mutation on the cohort, its staff, mentors or enrollments | "This cohort has finished and is read-only." | Toast; refetch header and roster (page turns read-only) |
| `cohort_not_deletable` | 422 | delete | "Only a planned cohort with no students can be deleted." | Toast; refetch |
| `cohort_not_active` | 422 | student submit (later: complete lesson) | See [Student side](#student-side) | Inline notice; refetch |
| `enrollment_exists` | 422 (409 via Nitro) | add one, move | Add: "{name} is already in this cohort." Move: "{name} is already in {target}." | Toast; refetch roster |
| `invalid_transition` | 422 (409 via Nitro) | status change, move | "That change isn't possible any more; the list was refreshed." | Toast; refetch roster |
| `staff_cannot_enroll` | 422 | add one | "{name} is on this cohort's staff. Remove them from staff first." | Toast |
| `student_cannot_be_staff` | 422 | add staff, change role | "{name} is a student in this cohort. Drop them first." | Error in the staff modal / toast |
| `not_a_mentor` | 422 | assign mentor, bulk, auto | "{name} isn't a mentor of this cohort any more." | Toast; refetch header and roster |
| `not_enrolled` | 422 | assign mentor, bulk | "Only active or paused students can have a mentor." | Toast; refetch roster |
| `mentor_assignment_not_found` | 404 | unassign | none: it's already unassigned | Treat as success; refetch roster |
| `import_too_large` | 422 | CSV import | "The file has more than 2000 rows. Split it and import the parts." | Under the file input |
| `cohort_not_found` / 404 | 404 | detail load; any mutation | Load: "Cohort not found" + "Back to cohorts". Mutation: toast "This cohort no longer exists", go to `/cohorts` | |

Detail page load errors: 404 → "Cohort not found" empty state; anything else → `HomeState` load error with Retry
(never "not found" for a network error or a 500).

### Cache keys

| Key | Fetched by | Holds |
|---|---|---|
| `cohorts:<statuses>` (sorted, e.g. `cohorts:active,planned`) | `/cohorts` | Table rows for that filter |
| `cohort-options` | Move dialog (on first open) | Planned + active cohorts |
| `cohort:<id>` | `/cohorts/[id]` | Header, staff, assignments |
| `cohort-roster:<id>` | `/cohorts/[id]` | Roster rows |
| `cohort-invites:<id>` | `/cohorts/[id]` | Pending + expired cohort invites ([invites](invites.md#cache-keys)) |
| `cohorts-mine` | `/cohort` | Mentor's cohorts with rosters |
| `people-options` | Add students, Add staff (on first open) | Light user list for pickers |
| `program-options` | Cohort modal (on open) | Active programs for the picker ([programs](programs.md#cache-keys)); not cleared by cohort mutations |
| `people`, `programs`, `program:<id>`, `dashboard-head`, `dashboard-mentor` | other pages | Derived from cohort data |

After every cohort mutation one helper, `invalidateCohorts()` in `app/utils/`, clears every key starting with
`cohorts:` or `program:` plus `cohort-options`, `cohorts-mine`, `people`, `programs`, `dashboard-head` and `dashboard-mentor`
(`clearNuxtData` with a predicate). The page then refreshes its own keys:

| Mutation | Refresh on the page | Also |
|---|---|---|
| Create | none | Navigate to the new cohort |
| Edit, Finish / Cancel | `cohort:<id>`, `cohort-roster:<id>` | |
| Delete | none | Clear `cohort:<id>`, `cohort-roster:<id>`; navigate to `/cohorts` |
| Staff add / role / remove | `cohort:<id>`, `cohort-roster:<id>` | |
| Mentor assign / unassign / bulk / auto | `cohort-roster:<id>` | |
| Enroll, import, status change | `cohort-roster:<id>` | Import and invite by email also `cohort-invites:<id>` |
| Move | `cohort-roster:<id>` | Clear `cohort-roster:<target>` |

On any mutation error, refetch the affected keys so the UI resets to the server value.

## API

Manage routes use `requireRole(event, 'head')`, `/api/cohorts/mine` the mentor view; the API's own permission
checks still apply. Pages call only these routes.

| UI call (Nitro) | API calls | Request → response mapping |
|---|---|---|
| `GET /api/cohorts?status=active&status=planned` | `GET /cohorts/?status=…` (repeatable); per cohort `GET /cohorts/{c}/roster`; `mentors` come with the list item (programs v2), no `…/staff` call | `status`: list of `planned\|active\|finished`, none = all. → `CohortRow[]`: `status`, `startsOn`, `endsOn`, `finishedAt`, `week`, `totalWeeks`, `mentees` = `active_students`, `studentsTotal`, `mentors` = staff with role mentor, `unassigned` = active/paused roster rows without mentor, `progress`, `atRisk`, `backlog` = Σ `submissions.submitted`. Replaces the per-cohort `…/progress` + `…/submissions` calls. |
| `GET /api/cohorts/options` | `GET /cohorts/?status=planned&status=active` | → `CohortOption[]` with `status`. Move dialog only. |
| `POST /api/cohorts` `{name, programId, startsOn, endsOn?}` | `POST /programs/{p}/cohorts {name, starts_on, ends_on?}` | No `status`, no mentor calls; `ends_on` sent only when given (the API defaults it from the program's duration). 201 → `{id, name, coursesAttached}` (the API's count of courses copied from the program; field name per generated types). |
| `PATCH /api/cohorts/[id]` `{name?, startsOn?, endsOn?}` | `PATCH /cohorts/{c}` with only the given fields | zod: optional, non-nullable, strict. → `{ok}` |
| `POST /api/cohorts/[id]/finish` | `POST /cohorts/{c}/finish` | → `{ok}` (new) |
| `DELETE /api/cohorts/[id]` | `DELETE /cohorts/{c}` | API 204 → `{ok}` (new) |
| `GET /api/cohorts/[id]` | `GET /cohorts/{c}`; `GET /cohorts/?program_id=` (program title); `GET …/staff`; courses, outlines and per-lesson assignment as in [assignments](assignments.md) (O7); `/me/access` | → `CohortDetail`: `id, name, programId, programTitle, status, startsOn, endsOn, finishedAt, week, totalWeeks, staff: StaffMember[]` (`{id, name, username, role}`; the API has no avatar, the UI shows initials), `assignments, lessons, canEditAssignments`. No roster, no `mentor`. |
| `GET /api/cohorts/[id]/roster` | `GET /cohorts/{c}/roster` | → `CohortRosterRow[]`: `enrollmentId`, `enrollment` (status), `statusChangedAt`, `id, name, username, email` (user), `mentor: Person \| null`, `lessonsDone` / `lessonsReleased` (progress), `accepted` (approved), `changes` (changes_requested), `waiting` (submitted), `overdue` (overdue_submitted), `lastActivityAt`, `atRisk` (active + O9 rule). Replaces `cohortRoster()`'s ~10+N calls. (new) |
| `GET /api/cohorts/mine` | `/me/access`; per staffed cohort `GET /cohorts/{c}`, `…/roster`, `…/staff`, assignments as above | → `(CohortDetail & {roster: CohortRosterRow[]})[]`; the page derives "My students" from `roster[].mentor.id` = session user. |
| `PUT /api/cohorts/[id]/staff/[userId]` `{role}` | `PUT /cohorts/{c}/staff/{u} {role}` | Add or change role. → `{unassignedMentees}` (new) |
| `DELETE /api/cohorts/[id]/staff/[userId]` | `GET /cohorts/{c}/mentors`, then `DELETE /cohorts/{c}/staff/{u}` | → `{unassignedMentees}` (new). The API answers 204 with no count, so Nitro counts this mentor's assignments just before the delete; switch to the API's number if the endpoint starts returning it. |
| `PUT /api/cohorts/[id]/mentors` `{mentorId, menteeIds}` | `PUT /cohorts/{c}/mentors {mentor_id, mentee_ids}` | Row select and bulk both use it; ids are user ids. → `{assigned: n}` (new) |
| `DELETE /api/cohorts/[id]/mentors/[menteeId]` | `DELETE /cohorts/{c}/mentors/{mentee}` | `mentor_assignment_not_found` → `{ok}`. (new) |
| `POST /api/cohorts/[id]/mentors/auto` | `POST /cohorts/{c}/mentors/auto` | → `{assigned: n}` (count of returned assignments). (new) |
| `POST /api/cohorts/[id]/enrollments` `{userId}` | `POST /cohorts/{c}/enrollments {user_id}` | API 201 → 201 `{result: 'enrolled'}`; API 200 → 200 `{result: 'reactivated'}`. No mentor call any more. |
| `POST /api/cohorts/[id]/enrollments/import` (multipart `file`) | `POST /cohorts/{c}/enrollments/import` (FormData passed through) | → `ImportReport {enrolled, reactivated, alreadyEnrolled, unknown, skippedStaff}` (email lists); plus `invited`, `resent` (cohort invites). Over 1 MB → `validation_error` before calling. (new) |
| `POST /api/cohorts/[id]/invites`, `GET /api/cohorts/[id]/invites` | `POST` / `GET /cohorts/{c}/invites` | See [invites](invites.md#api) |
| `PATCH /api/enrollments/[id]` `{status}` | `PATCH /enrollments/{id} {status}` | Unchanged. |
| `POST /api/enrollments/[id]/move` `{cohortId}` | `POST /enrollments/{id}/move {cohort_id}` | → `{enrollmentId, cohortId}` of the target. Replaces enroll-then-drop. (new) |
| `GET /api/people/options` | `GET /users/` (all pages of 100) | → `{id, name, email, username, avatar}[]`, deleted accounts left out. No per-cohort calls; pickers filter against the cohort's own staff and roster. (new) |

Removed: `setCohortMentor`, `cohortWeeks`, `cohortRoster` (split into the detail and roster routes), the progress
and queue calls in `cohortStats`; in `cohortInput.ts` `cohortStatus`, `cohortDates`, `totalWeeks` and `mentorId`
(name max becomes 200). `CohortInput` becomes `{name, programId, startsOn, endsOn}`; `CohortRow.mentor` becomes
`mentors: Person[]`; `CohortRosterRow.coursesDone/coursesTotal` become `lessonsDone/lessonsReleased`.
`cohortMentor` goes with programs v2 ([programs](programs.md#api)). The program picker reads
`/api/programs/options`, never `/api/programs`.

## Acceptance criteria

Verified by `npm run typecheck` and, against a local backend with v2, `scripts/e2e-smoke.py` extended for the items
marked (e2e); the rest by the manual check the item describes.

### `/cohorts`

- [x] Default view lists active and planned cohorts only; the URL has no `status`; the Active and Planned toggles are on. ✓ browser check
- [x] Turning on Finished adds finished cohorts and puts `status=finished` in the URL; reload keeps the filter. ✓ browser check
- [x] Turning off the last toggled-on status does nothing. ✓ browser check
- [x] Each row shows the status badge; a planned row shows "starts {date}", a finished row "finished {date}", an active row `week/total` equal to the API's `week` and `total_weeks` (e2e). ✓ e2e-smoke + screenshot
- [x] A cohort with two mentors shows both; one with none shows "No mentor"; one with an unassigned active student shows "1 without a mentor". ✓ screenshot
- [x] Loading the list makes 1 + 2 × N API calls for N cohorts. ✓ by construction (`/api/cohorts`: list, then roster + staff per cohort)
- [x] With no cohorts in the filter, the empty state names the filter. ✓ code read

### Cohort modal

- [x] Create sends `{name, starts_on, ends_on}` and no `status`; a cohort starting tomorrow shows as Planned, one starting today as Active (e2e). ✓ e2e-smoke
- [x] Create with a name already used in the program, in any letter case, shows the name-taken message under Name (e2e). ✓ e2e-smoke + browser check
- [x] Create with an end date before today shows "The end date is in the past." under End date. ✓ e2e-smoke (API); the form refuses it first
- [x] An end date on or before the start date is refused in the form before any request. ✓ browser check
- [x] Editing an active cohort shows the start date disabled with its help text; changing only the end date sends only `ends_on`. ✓ browser check
- [x] Saving an unchanged form sends no request. ✓ browser check
- [x] The modal has no mentor or status field and doesn't request `/api/people`. ✓ browser check
- [x] The program picker lists only active programs, from `/api/programs/options` (e2e). ✓ e2e-smoke + browser check
- [x] Picking a start date fills the end date from the program's duration; creating with the end date empty succeeds
  and the toast names the attached courses (e2e). ✓ browser check (end date) + e2e-smoke (`coursesAttached`); the toast
  text not checked

### `/cohorts/[id]` header and actions

- [x] Planned with no enrollments shows Edit, Cancel cohort and Delete; with one dropped enrollment, Delete is hidden. ✓ code read
- [x] Active shows Edit and Finish cohort, no Delete. ✓ screenshot
- [x] The Finish dialog states the number of active + paused students, the waiting reviews and "can't be undone"; confirming finishes the cohort, every active/paused row becomes completed, the banner appears and every mutating control is gone (e2e). ✓ e2e-smoke (finish) + screenshot (dialog)
- [x] Delete removes the cohort and returns to `/cohorts` with a toast (e2e). ✓ e2e-smoke (API); UI navigation not run
- [x] A finished cohort shows the read-only banner and no Edit, Finish, Delete, Add students, Add staff, row menus, checkboxes, mentor selects, Auto-assign or assignment editing. ✓ screenshot
- [ ] An unknown id shows "Cohort not found"; a 500 from the API shows the load error with Retry instead.
- [x] A mutation answered with `cohort_finished` shows "This cohort has finished and is read-only." and the page turns read-only after the refetch. ✓ code read

### Staff

- [ ] Adding a mentor and a reviewer lists both with role badges; the mentor shows "0 students" (e2e).
- [x] The staff picker doesn't list current staff or active/paused/completed students of this cohort. ✓ code read
- [x] Removing a mentor with 3 students asks first naming 3; the toast reports the API's `unassigned_mentees`; those students show no mentor afterwards (e2e). ✓ e2e-smoke with 1 student: count from Nitro (see API table); the confirm dialog not run
- [x] Changing a mentor with students to reviewer asks the same; one without students doesn't ask. ✓ code read
- [x] Adding a person enrolled in the cohort shows the `student_cannot_be_staff` message. ✓ e2e-smoke (API code)

### Roster

- [x] The roster loads with one API call (`GET /cohorts/{c}/roster`), and refreshing it doesn't refetch assignments. ✓ by construction; header and roster have separate cache keys
- [x] Changing the Mentor select assigns that mentor in one call; "No mentor" unassigns (e2e). ✓ e2e-smoke
- [x] Selecting 3 rows and choosing a mentor in the bulk bar sends one call and all 3 show that mentor. ✓ e2e-smoke (one PUT for 3)
- [x] Auto-assign with 2 mentors and 4 unassigned students gives each mentor 2 and toasts "Assigned 4 students" (e2e). ✓ e2e-smoke
- [x] Auto-assign is disabled with the matching tooltip when everyone has a mentor, and when there is no mentor. ✓ code read
- [x] The row menu offers exactly: active (pause, complete, drop, move), paused (resume, drop, move), dropped (re-activate), completed (no menu). ✓ screenshot (active); code for the rest
- [x] Dropping a student asks first; afterwards the row is dropped, collapsed under "inactive", and has no mentor (e2e). ✓ e2e-smoke (API)
- [x] The Move dialog lists only planned and active cohorts other than this one and says progress doesn't carry over; confirming makes one move call, and the student shows dropped here and active in the target (e2e). ✓ e2e-smoke + screenshot
- [ ] Re-activating a dropped student makes them active, without a mentor.
- [x] Last activity shows a relative time, or "—" for a student with none. ✓ e2e-smoke (value present) + screenshot (—)
- [x] The Lessons column header reads "Lessons" and shows completed / released. ✓ screenshot
- [x] The section count counts active + paused only. ✓ screenshot

### Pages (students, assignments, solutions)

- [x] A cohort with 30 current students shows 25 rows and "1–25 of 30"; page 2 shows the other 5. ✓ browser (32 / 30)
- [x] 25 or fewer students: no pager. ✓ browser (25 rows, no pager)
- [x] Fewer students after a refetch (dropped, moved) keep the page in range (`usePaged` clamps on the new total). ✓ code read
- [x] "Show inactive" jumps to the page where the inactive ones start; "Hide inactive" goes back to page 1. ✓ browser
- [x] "Select all" still selects every current student, on every page. ✓ code read
- [x] Assignments and solutions page by 10 over the lists already loaded: no extra requests. ✓ code read
- [x] The pager's buttons are named in the active language ("Страница 2", "Следующая страница"). ✓ browser
- The page number isn't in the URL: a reload starts on page 1 (by choice; add `?page=` if people share links to it).

### Add students

- [x] The people list loads when the modal opens, not with the page. ✓ code read
- [x] Adding a new person shows "{name} added"; re-adding a dropped student shows "{name} re-added" and they're active again (e2e). ✓ e2e-smoke (enrolled / reactivated)
- [x] The picker doesn't offer staff, or active/paused/completed students of this cohort. ✓ code read
- [x] A CSV with one new account, one dropped, one already enrolled, one address without an account and one staff email shows each in its own report group: Added, Re-added, Already, Invited (not "unknown"), Skipped staff, 1 each (e2e). ✓ e2e-smoke
- [x] "Copy emails" copies the invalid emails (`unknown`: not a valid email, or a deactivated account) one per line. ✓ browser (invite tab, same report)
- [x] A file over 1 MB is refused before upload; a file over 2000 rows shows the `import_too_large` message. ✓ code read

### `/cohort` (mentor)

- [x] Shows every staffed cohort; finished ones under a collapsed "Finished cohorts". ✓ e2e-smoke + screenshot
- [x] A mentor with mentees sees "My students" by default and only their students; "Everyone" shows the whole roster. ✓ screenshot
- [x] Student counts exclude completed and dropped students; the roster has no editing controls. ✓ screenshot

### Student side

- [x] After the cohort finishes, the student's dashboard shows it as an archive entry, not as the current cohort (e2e). ✓ e2e-smoke + screenshot
- [x] `/assignments` shows the finished cohort's assignments in a collapsed archive group, read-only. ✓ e2e-smoke + screenshot
- [x] An assignment page in a finished cohort shows the closed notice instead of the submit form; earlier submissions and feedback stay visible. ✓ e2e-smoke + screenshot

### Errors and cache

- [x] Every code in the error table has an `en` and a `ru` message and is shown as the table says; no listed code shows `common.saveError`. ✓ key check script
- [ ] After any cohort mutation, `/cohorts`, the head dashboard, `/people` and `/programs` show fresh data on the next visit without a reload.

## Known gaps

- No capacity limit per cohort (deliberate; add if seats become a product rule).
- Release, due and finish dates are UTC calendar days (D5): a cohort ends at 05:00 Almaty time.
- CSV addresses without an account are invited into the cohort ([invites](invites.md); closed D4 and [O2](../open-items.md)).
- Finished is final: no reopen. A cohort cancelled by mistake is recreated.
- No course attach/detach or start-offset UI ([O10](../open-items.md)); when built it must warn on active cohorts
  (released lessons may re-lock) and be hidden on finished ones.
- No student lesson screen, so "complete lesson" in a finished cohort has no UI to disable yet.
- Assignments are still found per lesson ([O7](../open-items.md)); the roster part of O7 is solved by
  `GET /cohorts/{c}/roster`.
- At-risk rule is a placeholder ([O9](../open-items.md)).
- The people picker can't tell mentors from others (no roles in `GET /users/`, [O6](../open-items.md)) and no longer
  shows "from {other cohort}".
- The `enrollment_created` notification links to `/`; there is no notifications UI yet ([O14](../open-items.md)).
