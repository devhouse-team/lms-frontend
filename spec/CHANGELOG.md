# Changelog

Newest first. One entry per merged change: what changed, for whom, and anything to do.

## 2026-10-28: create hub checklist

- Head, `/create`: the recommendation now follows the whole chain (program, courses, activation, cohort, students) and
  an "All at once" checklist shows each step's state. "Create" is in the head's navigation.

## 2026-10-28: course wizard

- `/create/course`: basics, structure, materials, assignments, review and publish. The course is created as a draft
  after step 1; steps 2-4 are the editor's outline one part at a time (`EditorOutline focus=`), so they use the same
  calls and permissions. New assignments can start from a template (weekly homework, exam, practice). The last step
  has a checklist (`app/utils/courseReview.ts`), a sample lesson as a student sees it, editors and draft/publish.
  With `?return=/create/program/:id` the finished course is added to that program. "Create course" on `/courses` and
  the program wizard now lead here; `CourseCreateModal` is gone. Plan import is still waiting for
  [O32](open-items.md).

## 2026-10-28: cohort wizard

- Head, `/create/cohort`: program, dates, plan, team and students steps. The cohort is created after the dates step
  (the API copies the program's curriculum); the plan step shows it on the calendar with exam-window overrides; the
  team step needs a mentor; the students step adds people, emails or a CSV and can assign mentors automatically.
  "Create cohort" on `/cohorts` and on a program page now opens the wizard (`?program=` preselects); the modal stays
  for editing. `AddStudentsModal` now wraps the new `AddStudentsPanel`. Spec: [setup-flow](features/setup-flow.md).

## 2026-10-27: create wizards, program first

- Head, `/create` and `/create/program`: a hub ("what to create") and a four-step program wizard (basics, courses,
  schedule, activation). The program is saved as a draft after step 1; later steps use the same calls as the program
  page. "Create program" on `/programs` now opens the wizard; the modal stays for editing. Spec:
  [setup-flow](features/setup-flow.md). Cohort and course wizards follow; plan import waits for the backend
  ([O32](open-items.md)).
- `api:types` reads `../lms-backend/openapi.json`.

## 2026-10-24: contests page on the API

- Head (admins), `/contests`: saved contests from API `/contest` (latest first) with delete; results of the selected one
  (every active user with a LeetCode ID, ranked by solved, "—" when they didn't take part; fetched on the client as the
  API asks LeetCode once per user); add from LeetCode's upcoming or past list (past by 10, "Show more"). 422 and 503
  from LeetCode get their own messages. BFF: `/api/contests/saved`, `/api/contests/saved/[slug]`,
  `/api/contests/saved/[slug]/results`, `/api/contests/leetcode/{upcoming,past}`. The mock entry and results routes are
  gone; the student `/contest` page and home rails stay on the mock.

## 2026-10-19: pages on the cohort page

- Head and program leads, `/cohorts/[id]`: Students page by 25, Assignments and Solutions by 10, with "21–40 of 57" and
  page buttons (names translated), hidden while one page is enough. Client-side over the lists already loaded (no new
  requests); "Show inactive" jumps to where they start. Criteria in [cohorts.md](features/cohorts.md#pages-students-assignments-solutions);
  server paging for very large cohorts is [O31](open-items.md).

## 2026-10-19: student area built

- Built per [notifications](features/notifications.md), [grades](features/grades.md) and
  [profile](features/profile.md) on backend `3b61765` (types regenerated): the bell and panel on every app page,
  `/notifications` with email switches, the legacy-link redirect middleware, `/grades` (nav "Grades", course sidebar
  link), `/me` Email / Notifications / Sessions, and `/confirm-email-change` (client-only, like `/accept-invite`).
  O14 closed. Differences are in each spec's "As built".
- e2e smoke covers notifications (review, read, read all, email switch, old-link redirects), grades (8 of 10, practice
  not counted, staff 403) and account settings (resend, change email end to end, log out everywhere).

## 2026-10-19: student area spec (not built)

- New [features/notifications.md](features/notifications.md): a bell with the unread count in every page's navbar
  (`AppPage`, home), a panel with the latest 20, `/notifications` (latest 100, All / Unread, mark all read) and the
  per-type email switches (`#email`). Polls every 60 s while the tab is visible and on focus; opening a notification
  marks it read and switches view when the link needs one. Russian / English type labels and icons; the API's English
  title is shown under the label. Wrong API links are rewritten in one function (`fixLink`) used by the list and by a
  server middleware that redirects the same paths for email links. O14 specified; new O29 (backend links, texts,
  paging).
- New [features/grades.md](features/grades.md): `/grades` (student nav and course sidebar link): per course, assignment,
  lesson, mode, status, submitted (attempt, late), score / max, feedback excerpt; totals over graded homework and exams
  (practice excluded). Needs the backend's `max_score` and `my_result` on `GET /cohorts/{c}/assignments`
  (2026-10-19); regenerate types. `GET /cohorts/{c}/progress/me` and `GET /enrollments/me` are not needed.
- [features/profile.md](features/profile.md): `/me` gains Email (resend verification, change email), Notifications
  (link to email settings) and Sessions (log out on all devices); new public page `/confirm-email-change?token=`
  (crudauth's default path). New O30 (OAuth-only accounts can't change email).

## 2026-10-18: student (cohort) invites built

- Built per [features/invites.md](features/invites.md) on backend `d69f872` (migration `a7d1be8a51ca`; types
  regenerated): Add students → "Invite by email" (paste up to 200, count, per-outcome report), CSV `invited` / `resent`,
  the cohort's "Invited" section with Resend / Revoke, cohort invites in the People rail (with actions) and on head
  home, `/people/invite` for mentor and head only, and `/accept-invite` with the preview, the finished / rate-limit /
  load-error states and landing on `/courses`. O2 and O5 closed. Differences: [As built](features/invites.md#as-built).
- To do before release: run the backend migration. Locally: `docker compose build migrate && docker compose run --rm
  migrate` in `../backend` (a stale `migrate` image skips it).
- e2e smoke covers outcomes, CSV invites, the Invited list, resend, revoke, preview, accept and a finished cohort.

## 2026-10-18: student (cohort) invites spec (not built)

- [features/invites.md](features/invites.md): students join through a cohort invite. Add students gains an "Invite by
  email" tab (paste up to 200 emails, count, per-outcome report: invited, re-sent, added, re-added, already in, staff,
  invalid); the CSV report gains invited and re-sent; the cohort page gets an "Invited" section (pending / expired,
  resend, revoke); the People rail shows cohort invites with resend / revoke; `/accept-invite` shows the public preview
  ("You're joining {cohort} · {program}, starts {date}" or the role) and lands a new student on `/courses`.
- `/people/invite` drops the student role option. Edits in [cohorts.md](features/cohorts.md) and
  [people.md](features/people.md). O2 and O5 specified (close when built).
- Needs the backend's cohort invites (`POST/GET /cohorts/{c}/invites`, `GET /invites/preview`, `DELETE /invites/{id}`,
  `POST /invites/{id}/resend`, import `invited` / `resent`, accept `cohort_id`); regenerate types before building.

## 2026-10-18: course content v2, phase 3 (navigation)

- Students and staff: "Materials by type" (`/courses/[c]/[course]/materials`, one tag at a time in `?tag=`, grouped
  by module, locked ones muted), the cohort calendar (`/calendar`, week rows: Opens, Due, Exams in the cohort's
  timezone, current week marked), previous / next on lesson and course pages (a sticky bar with "Contents" on
  phones), and course search in ⌘K. The course sidebar gains "Materials by type" and "Calendar" links and remembers
  opened modules for the session. Nav "Calendar" for students and mentors.
- Needs backend P3 (`GET /cohorts/{c}/courses/{course}/materials`, `GET /cohorts/{c}/calendar`,
  `GET /cohorts/{c}/courses/{course}/search`, lesson `prev` / `next`); types regenerated. Differences from the spec
  text are in [course-content.md, Phase 3 as built](features/course-content.md#phase-3-as-built).
- e2e smoke checks the by-type list, calendar rows, search and prev / next.

## 2026-10-17: person profile and my profile

- New `/people/{id}` (head): a person's cohorts as student (status, mentor) and as staff. Names in `/people` link to it.
  See [features/people.md](features/people.md).
- New `/me` (everyone): own account, cohorts, edit name and username, change password; linked from the account menu.
  See [features/profile.md](features/profile.md). Changing the password signs the user in again, because the API evicts
  the old tokens.
- Not run against a backend yet: check both pages and the password change on a local backend before release.

## 2026-10-16: course content v2 spec (not built)

- New [features/course-content.md](features/course-content.md): the LMS hosts courses, OCW-style. Student course page
  with a contents rail (course pages, modules → lessons with lock / done state), lesson page with materials in order
  (markdown with KaTeX and highlighted code, inline PDF on desktop, embedded video from YouTube / Vimeo / Drive /
  Loom, file and link cards), mark complete, prev / next; materials by type and a cohort calendar (Phase 3);
  assignment pages per mode (homework, exam with countdown, one attempt and a trial upload, practice with the solution
  after the first attempt) and solution release states (Phase 2).
- Editors: course editors per course (head assigns; program leads implicit), `/editor/[courseId]` outline with up /
  down reorder and move, material editor (textarea + live preview, `.md` upload, image paste as `file:` references,
  video host check), assignment editor (Phase 2), per-cohort solution release.
- Decisions: markdown stack `marked` + `marked-katex-extension` + `katex` + `highlight.js` + `dompurify`, rendered in
  the browser, `v-html` only in `MarkdownView`; textarea editor instead of `UEditor` (lossless markdown, math);
  file links go through Nitro to the API's `302` redirect endpoints (no expiring URL in a page); upload `purpose`
  (`cover`, `content_image`, `content`, `submission`) validated by the API, content types from file extensions; exam
  and practice reviews accept only. Phased plan in the spec.
- Reconciled with backend `spec/content.md` (same day): every endpoint, field and error code uses the backend's name
  (e.g. `permission_denied`, `content_has_submissions`, `exam_window_started`, `lesson_locked`, `material_locked`,
  `release_invalid`, `no_such_file`, `released_on`, `release_hint`, `releases_on`, `solution_of_id`, `PATCH
  /materials/{m} {file_ids}`, `PUT /cohorts/{c}/materials/{m}/release`, `GET /courses/{course}`); the backend added
  what the UI needed (`GET /cohorts/{c}/assignments`, `GET /cohorts/{c}/solutions`, course progress figures,
  `server_time`, `timezone`, `can_manage_editors`, `cohort_count`). Same phases: prev / next moves to Phase 3,
  calendar and search use backend endpoints, Phase 2 needs the cohort timezone (O22) decided first and deploys
  together with backend P2, which removes the singular assignment endpoints Phase 1 still uses. O21, O23, O25
  resolved in the specs.
- Nav "Courses" will show the real courses; the external-courses mock is removed in Phase 1.
- PRODUCT.md and DESIGN.md: the LMS hosts course content (positioning, principle 3, operating context; contents rail
  + reading column layout, markdown body style, new signature components; Course Status Control retired).
- [assignments](features/assignments.md), [reviews](features/reviews.md), [dashboards](features/dashboards.md),
  [mock features](features/mock-features.md) point at the new model. Open items O21–O28 added; O7, O10, O11, O14,
  O17, O19 mapped to phases.
- Backend counterpart: `../backend/spec/content.md` (also spec only).

## 2026-10-16: programs v2

- Built per [features/programs.md](features/programs.md): `/programs` with Active / Draft / Archived tabs, cards and
  up/down reorder; `/programs/[id]` with status actions and confirms, overview, curriculum editor and cohorts with all
  mentors; program modal (slug from title with ru/kz transliteration, cover upload via storage, lead picker); cohort
  form lists active programs only, end date from the program duration (optional on create), "N courses attached"
  toast; program-lead view (own programs only; Home, Cohorts, Programs; `/people` and `/contests` answer 403);
  read-only program block for students (home) and mentors (`/cohort`); ru plurals with three forms.
- Removed: `server/data/programs.ts` and the old programs page.
- **To do on build:** `npm run api:types` (backend migration `a7c3e9d51b20` is live). e2e smoke: 83 checks.

## 2026-10-16: programs v2 spec

- [features/programs.md](features/programs.md) rewritten: programs as course templates; status tabs (draft / active /
  archived) with confirm-guarded actions; create/edit modal (slug from title, duration, cover upload, lead); curriculum
  editor over existing courses (order, start week/day, length hint, "applies to new cohorts only"); cohorts section
  with all mentors; scoped program-lead view; read-only program info for students and mentors; error table; split
  cache keys (`programs` / `program:<id>` / `program-options`); Russian plural rules. The static syllabus
  `server/data/programs.ts` and the per-cohort `…/staff` calls go away.
- [features/cohorts.md](features/cohorts.md): the program picker lists active programs only; the end date defaults
  from the program duration and is optional on create; the create toast reports attached courses;
  `program_not_active`.
- [features/dashboards.md](features/dashboards.md): students and mentors see their cohort's program (cover, title,
  description), read-only; a lead-only head dashboard hides invites.
- Backend counterpart: `../backend/spec/domain.md` (Programs v2, also spec only).

## 2026-10-16: cohort logic v2

- Cohorts follow the API's lifecycle: status and week come from the API; `/cohorts` has a status filter (Active and
  Planned by default, Finished optional); Finish, Cancel and Delete are offered by status; a finished cohort is
  read-only everywhere.
- Several mentors and reviewers per cohort (staff section) with a mentor per student: inline select, bulk assign and
  Auto-assign.
- The roster loads from `GET /cohorts/{c}/roster` (one call); only the transitions the API allows are offered; Move is
  atomic; dropped students can be re-added.
- CSV import shows a report (enrolled, re-added, already enrolled, unknown, staff); each API error code has its own
  message in en and ru; cache keys follow the cohort id.
- Review fixes: `cohort_not_found` toasts and returns to `/cohorts` from any mutation; Auto-assign with no mentors
  and bulk "No mentor" report correctly; the move text says when earlier progress comes back; finished cohorts fall
  back to the end date when `finished_at` is missing; the roster route is head-only; `/api/assignments` calls
  `/me/access` once; Nitro CSV errors are translated; the disabled Auto-assign shows its tooltip; copy aligned with
  the spec ("{n} students", "Assigned {n} students", "Week N of M").

## 2026-10-16: cohorts table fills its box

- Fixed: the cohorts table (head home and `/cohorts`) was narrower than its bordered wrapper, leaving a gap on the
  right. Still scrolls sideways on narrow screens.
- Cohorts without an end date show "week N" instead of "week N of 0"; the progress column is labelled "Lessons".
- All tables (cohorts, roster, people) fit their box: long names, emails and cohort lists truncate with the full
  text on hover; numbers are right-aligned; only the sorted column shows an arrow. On phones the roster and people
  tables fit without sideways scrolling (status and role move under the name, the roster's actions stay visible),
  and the cohorts table scrolls with the cohort name pinned.
- People: the filter tabs scroll on phones instead of cutting off the first one.

## 2026-10-15: account recovery

- Built [features/account-recovery.md](features/account-recovery.md): "Forgot password?" on the login page,
  `/forgot-password`, `/reset-password` and `/verify-email`, so the links the API emails now work (closes O8).
- Passwords are checked against the API's policy in the form on `/reset-password` and `/accept-invite` (8–128
  characters, upper and lower case, a digit, a special character); the API's own field message shows if it still refuses.
- New check: `scripts/e2e-recovery.py`.

## 2026-10-15: account recovery spec, invite username fix

- New spec [features/account-recovery.md](features/account-recovery.md): forgot password, `/reset-password`,
  `/verify-email`, with the API calls, error mapping and build steps.
- Fixed: the invite form accepted usernames the API refuses (uppercase, `.`, `-`, up to 40 characters), so they
  failed with a 422 after submitting. The form and the Nitro route now use the API's rule: 2–32 of `a–z 0–9 _`.

## 2026-10-15: switch to the LMS API

- The app now uses `api.devhouse.kz` through Nitro (BFF) instead of the in-memory mock for auth, invites, cohorts,
  people, programs, assignments, reviews and dashboards. See [architecture.md](architecture.md).
- Login by email or username; view switcher for accounts with several views; Telegram and demo logins removed.
- Invites are emailed by the API and accepted at `/accept-invite?token=`; the old `/invite/[token]` page is gone.
- Assignments attach to lessons and are due N days after the lesson opens.
- Contests, external courses, career and sessions stay on the mock; only their pages show "Demo data".
- **To do on deploy:** set `NUXT_API_BASE` (defaults to production) and the production `NUXT_PUBLIC_ROLE_IDS_HEAD` /
  `NUXT_PUBLIC_ROLE_IDS_MENTOR` (O1).
- Spec-driven development starts here: this `spec/` folder.
