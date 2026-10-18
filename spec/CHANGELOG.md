# Changelog

Newest first. One entry per merged change: what changed, for whom, and anything to do.

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
