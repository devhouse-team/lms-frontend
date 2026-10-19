# My grades

**Roles:** student · **Data:** API · **Status:** spec, not built (2026-10-19)

One table per course of the student's results: what they handed in, when, whether it was late, the score out of the
maximum and the start of the feedback, each row linking to the assignment. Success: a student answers "how am I doing
in this course?" in one screen, without opening every assignment.

## Screens

| Route | Who | What it shows / does |
|---|---|---|
| `/grades` (new) | student (`roles: ['mentee']`) | Title "Оценки". Cohort picker (`USelect`) when the student has more than one cohort with grades (active first, then finished ones they completed, newest first); `?cohort=` holds the choice, default the active cohort. Then one section per course of that cohort, in the cohort's course order: course title, totals line, table. |
| `/grades?cohort={c}&course={course}` | student | The same page scrolled to that course's section (`id="course-{course}"`). |
| Nav (student) | student | New item "Оценки" (`i-lucide-graduation-cap`, `/grades`) after "Задания". |
| Course sidebar (`CourseContents.vue`) | student in a course (not staff) | New link "Оценки" (`i-lucide-graduation-cap`) after "Calendar", to `/grades?cohort={c}&course={course}`. |

### Table columns

| Column | Content | Under `sm` |
|---|---|---|
| Задание | title, linking to `/assignments/{c}/{a}` | card heading |
| Урок | `lesson.title` | second line, muted |
| Режим | mode label (`lesson.mode.*`: Домашнее задание / Экзамен / Практика) | badge |
| Статус | `StatusBadge` (not submitted / waiting / changes / accepted), from `my_status` | badge |
| Сдано | `my_result.submitted_at`, `short` date + time in the cohort's timezone; "попытка {version}" when version > 1; a "Поздно" badge (`color: warning`, `i-lucide-clock-alert`) when `is_late`. "—" with no result. | line |
| Балл | `score / max_score` (e.g. `8 / 10`); `score` alone when `max_score` is null; "—" not reviewed or no score; nothing for practice | right-aligned, `tabular-nums` |
| Отзыв | first 140 characters of `feedback` as plain text (markdown stripped to text, one line, ellipsis); "—" without | clamped two lines |

The whole row is not a link (cells hold a link and text); the title is the link. Practice rows are listed in their
lesson's place, muted, with no score.

## Behavior

- **Data.** One `GET /cohorts/{c}/assignments` per cohort (the same list `/assignments` uses), with the new
  `max_score` and `my_result` fields; course titles from `GET /cohorts/{c}/courses`. Rows keep the API order (course
  start offset, module, lesson, assignment position); Nitro groups them by `course_id`. Only assignments of opened
  lessons appear (API rule), so the table grows as the course goes on.
- **Which result.** `my_result` is the latest counted submission (trials never count). Resubmitted after "changes
  requested" and not yet reviewed: status "waiting", score and feedback "—" (the earlier feedback stays on the
  assignment page's history). This is the API's rule; the page doesn't merge versions.
- **Totals per course**, shown above its table:
  - **Graded:** rows with mode `homework` or `exam`, `max_score` set and `my_result.score` set. Line: "Баллы: {sum} из
    {max} · оценено {n} из {m}", where `sum` = Σ score, `max` = Σ max_score of the graded rows, `m` = homework and exam
    rows with a `max_score` that are visible now. Practice never counts. A percentage is not shown (a partial course
    reads misleadingly).
  - No graded rows: "Пока нет оценок".
  - Counts of the other states in one muted line: "Сдано {k} из {all} · с опозданием: {late}" (`all` = homework + exam
    rows; `late` only when > 0).
  - Totals are computed in Nitro, not in the page (one place, one rule).
- **Empty states.**
  - No cohort as a student at all: `UEmpty` "Вы пока не учитесь ни в одной когорте" with a link to `/courses`.
  - Cohort without assignments yet (nothing opened, or none published): "Заданий пока нет. Они появятся, когда откроются
    уроки."
  - A course in the cohort with no assignments: the course is omitted.
- **Loading / error.** The page uses `HomeState` (skeleton, error with "Повторить"), like `/me`.
- **Finished cohort.** Read-only, same table; the picker labels it "{cohort} · завершена". Dropped enrollments are not
  offered (the API answers `403` for them).
- **Staff** don't get this page (the API sends `my_result: null` to staff). Mentors read a student's work from reviews.

## API

| UI call (Nitro) | API calls | Notes |
|---|---|---|
| `GET /api/grades` (new) | `/me/access` and `GET /cohorts/` (as `/api/assignments` does: `myAccess`, `listCohorts`), then per cohort in parallel `GET /cohorts/{c}/assignments` (`cohortAssignmentItems`) and `GET /cohorts/{c}/courses` | `requireRole(event, 'mentee')`. Cohorts: enrollment `active` plus finished ones with enrollment `completed` (the `/api/assignments` rule). → `GradesResponse` below |

```ts
interface GradesResponse {
  cohorts: {
    id: string, name: string, status: CohortStatus, timezone: string
    courses: {
      courseId: string, title: string
      totals: { score: number, max: number, graded: number, gradable: number, submitted: number, all: number, late: number }
      rows: {
        id: string, to: string, title: string, lessonTitle: string, mode: AssignmentMode,
        status: AssignmentStatus,             // from my_status, 'not_submitted' when null (toUiStatus)
        maxScore: number | null,
        result: { version: number, submittedAt: string, late: boolean, score: number | null,
                  feedback: string | null, reviewedAt: string | null } | null
      }[]
    }[]
  }[]
}
```

`feedback` goes to the page in full; the page renders the excerpt as plain text (whitespace collapsed, markdown
marks `#*_>\`[]()` dropped; never `v-html`). `max_score` / `my_result` must be in the regenerated
`shared/types/api.d.ts` before building (backend change deploying 2026-10-19).

**Not used:** `GET /cohorts/{c}/progress/me` (completed lesson ids and released count: the course list already shows
done / released from `GET /cohorts/{c}/courses`, and the outline marks done lessons) and `GET /enrollments/me` (the
student's enrollments: `/me/access` already gives cohort, relation and enrollment status, and `/cohorts/` the cohort
fields). Neither adds anything the UI needs; drop them.

### Errors

| Code | HTTP | Can happen on | Shown as / then |
|---|---|---|---|
| `cohort_not_found` | 404 | one cohort's list (deleted meanwhile) | That cohort is left out; the rest render |
| `permission_denied` / `forbidden` | 403 | one cohort's list (enrollment dropped meanwhile) | Same: left out |
| `unauthorized` | 401 | any | Session handling as everywhere (login) |
| `api_unreachable` / other | 502 / 5xx | any | `HomeState` error with Retry |

Nitro uses `apiFind` (404 → null) for the per-cohort calls and skips nulls; a 403 is caught the same way.

### Cache keys

| Key | Fetched by | Holds |
|---|---|---|
| `grades` (new) | `/grades` | `GradesResponse` |

Nothing on this page mutates. Submitting on an assignment page clears `grades` (`clearNuxtData('grades')`) next to
the keys it already clears, so going back shows the new row.

## i18n

New namespace `grades.*`, both locales; reuse `lesson.mode.*`, `subStatus.*`, `review.late`.

| Key | ru | en |
|---|---|---|
| `nav.grades` / `grades.title` | Оценки | Grades |
| `grades.cohort` | Когорта | Cohort |
| `grades.finished` | {cohort} · завершена | {cohort} · finished |
| `grades.col.assignment` / `.lesson` / `.mode` / `.status` / `.submitted` / `.score` / `.feedback` | Задание / Урок / Режим / Статус / Сдано / Балл / Отзыв | Assignment / Lesson / Mode / Status / Submitted / Score / Feedback |
| `grades.attempt` | попытка {n} | attempt {n} |
| `grades.late` | Поздно | Late |
| `grades.total` | Баллы: {sum} из {max} | Points: {sum} of {max} |
| `grades.graded` | оценено {n} из {m} | {n} of {m} graded |
| `grades.submitted` | Сдано {k} из {all} | {k} of {all} submitted |
| `grades.lateCount` | с опозданием: {n} | late: {n} |
| `grades.noScores` | Пока нет оценок | No grades yet |
| `grades.emptyCohort` | Заданий пока нет. Они появятся, когда откроются уроки. | No assignments yet. They appear as lessons open. |
| `grades.noCohort` | Вы пока не учитесь ни в одной когорте | You're not in a cohort yet |
| `grades.toCourses` | К курсам | Go to courses |
| `grades.scoreOf` (screen readers) | {score} из {max} баллов \| {score} из {max} баллов \| {score} из {max} баллов | {score} of {max} points |
| `grades.assignmentsCount` | {n} задание \| {n} задания \| {n} заданий | {n} assignment \| {n} assignments |

Dates through `useCohortFormat()` in the cohort's timezone.

## Accessibility

- A real `<table>` per course with `<caption>` = course title (visually the section heading, `sr-only` caption
  references it), `<th scope="col">`; under `sm` the same rows render as a `<ul>` of cards, not a hidden table.
- Score cell has an accessible text "8 из 10 баллов" (`grades.scoreOf`), not just "8 / 10".
- "Поздно" is a word with an icon, not colour alone; status uses `StatusBadge` (tint + word).
- The cohort picker has a visible label; changing it updates `?cohort=` and moves focus to the first course heading.
- The truncated feedback has its full text one click away (the assignment link), not only in a tooltip.

## Acceptance criteria

Verified by `npm run typecheck` and, against a local backend with the `my_result` change, `scripts/e2e-smoke.py`
extended for (e2e) items; the rest in a browser.

- [ ] A student with one reviewed homework (8 of 10), one waiting exam (max 20) and one practice sees three rows; the
      totals read "Points: 8 of 10 · 1 of 2 graded" and "2 of 2 submitted"; practice shows no score. (e2e:
      `GET /api/grades` totals `{score: 8, max: 10, graded: 1, gradable: 2}`)
- [ ] A late submission shows the "Late" badge; an on-time one doesn't. (e2e: `result.late`)
- [ ] A resubmission waiting for review shows "waiting", "attempt 2" and "—" for score and feedback.
- [ ] Each title opens `/assignments/{c}/{a}`.
- [ ] The course sidebar "Grades" link opens `/grades` scrolled to that course.
- [ ] With an active and a completed cohort, the picker offers both; `?cohort=` survives a reload.
- [ ] A mentor or head opening `/grades` gets the 403 page; the nav doesn't show it to them.
- [ ] Empty states: no cohort, no assignments yet.
- [ ] Under 640 px the rows are cards with every field readable; screen reader reads "8 из 10 баллов".
- [ ] Russian plurals for 1, 2, 5, 21 assignments.

## Known gaps

- Totals are a plain sum; there is no weighting, final grade or pass mark in the API (backend X8 rubrics is out).
- Earlier reviewed attempts' scores aren't in `my_result` (latest counted submission only); history stays on the
  assignment page.
- No export (CSV / PDF).
