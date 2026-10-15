# Home dashboards

**Roles:** everyone · **Data:** API, with mock widgets (contest, career, external courses, sessions)

`/` shows one dashboard per active view. It keeps the "Demo data" badge while it has mock widgets.

## Student

- Greeting; "week N of M · cohort" or, without an active cohort, "you're not in an active cohort yet".
- **Next up**: the earliest assignment deadline in the next 14 days that needs the student (not submitted or sent
  back). **Queue**: the next three, plus "new feedback" when there is recent feedback.
- Rail: mentor (the student's own, else the cohort's), cohort size; contest and career (mock).
- External courses list (mock).

API: `GET /dashboard/student` (first active cohort), `GET /cohorts/`, `…/mentors`, `…/staff`.

## Mentor

- Summary of the waiting queue and overdue count; waiting submissions, oldest first.
- Per staffed cohort: program, week, students with lessons completed / opened, overdue reviews, at risk.
- Rail: sessions and contest (mock).

API: `GET /dashboard/mentor`, `GET /cohorts/`, review queues as in [reviews](reviews.md).

## Head

- Totals (cohorts, students, backlog, at risk), the [cohorts table](cohorts.md), pending [invites](invites.md).
- Mentor load: per cohort mentor, waiting submissions and the oldest one.
- Contest (mock).

API: no admin dashboard yet (backend Phase 5); assembled from the cohort rows and `GET /invites/`.

## Acceptance criteria

- [x] Student dashboard shows the cohort and mentor after enrollment.
- [x] Mentor dashboard lists a new submission and the cohort's students.
- [x] Head dashboard shows mentor load; accepted invites are gone.
- [ ] A student without an active cohort sees the "not in an active cohort" line (typechecked, not run).
