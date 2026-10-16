# Home dashboards

**Roles:** everyone · **Data:** API, with mock widgets (contest, career, external courses, sessions)

`/` shows one dashboard per active view. It keeps the "Demo data" badge while it has mock widgets.

## Student

- Greeting; "week N of M · cohort" (week from the API, never computed), "starts {date} · cohort" for a planned
  cohort, or, with neither, "you're not in an active cohort yet". With several, the active cohort wins over a planned
  one.
- **Past cohorts**: finished cohorts the student completed, listed under the main block as "{cohort} · finished
  {date}", linking to their archived assignments ([cohorts](cohorts.md#student-side)).
- **Next up**: the earliest assignment deadline in the next 14 days that needs the student (not submitted or sent
  back). **Queue**: the next three, plus "new feedback" when there is recent feedback.
- Rail: the student's own mentor, or "Mentor not assigned yet" (no fallback to another mentor of the cohort);
  cohort size; contest and career (mock).
- External courses list (mock).

API: `GET /dashboard/student` (active enrollments), `GET /cohorts/` (status, week, `finished_at`), `…/mentors`
(the student's own row), `/me/access` (completed enrollments for past cohorts).

## Mentor

- Summary of the waiting queue and overdue count; waiting submissions, oldest first.
- Per staffed planned or active cohort (finished ones are left out): program, status, week from the API, active and
  paused students only with lessons completed / released, overdue reviews, at risk.
- The waiting queue still includes finished cohorts: mentors close the backlog after the end.
- Rail: sessions and contest (mock).

API: `GET /dashboard/mentor`, `GET /cohorts/`, review queues as in [reviews](reviews.md).

## Head

- Totals over planned and active cohorts (cohorts, students, backlog, at risk), the [cohorts table](cohorts.md)
  with the same rows as `/cohorts`' default filter, pending [invites](invites.md).
- Mentor load: per mentor across cohorts (a cohort can have several), waiting and overdue submissions of the
  students assigned to them, from the roster rows; waiting work of students without a mentor shows as "No mentor".
- Contest (mock).

API: no admin dashboard yet (backend Phase 5); assembled from the cohort rows and `GET /invites/`.

## Acceptance criteria

- [x] Student dashboard shows the cohort and mentor after enrollment.
- [x] Mentor dashboard lists a new submission and the cohort's students.
- [x] Head dashboard shows mentor load; accepted invites are gone.
- [x] A student without an active cohort sees the "not in an active cohort" line (typechecked, not run). ✓ screenshot
- [x] After their cohort finishes, a student sees it under past cohorts, not as current. ✓ e2e-smoke + screenshot
- [ ] A student without an assigned mentor sees "Mentor not assigned yet", even when the cohort has mentors.
- [ ] The mentor dashboard leaves out finished cohorts and counts only active and paused students; the waiting queue
  still lists a finished cohort's submissions.
- [x] Head mentor load lists each mentor of a two-mentor cohort with their own students' waiting work. ✓ e2e-smoke (per-mentor waiting from roster rows)
