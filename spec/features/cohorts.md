# Cohorts

**Roles:** head (manage), mentor (read) · **Data:** API

A cohort is a group of students in one program, led by a mentor. The head creates and staffs cohorts and manages
enrollment; the mentor sees their students' progress.

## Screens

| Route | Who | What it shows / does |
|---|---|---|
| `/cohorts` | head | Table: cohort, program, mentor (or "no mentor"), active students, week N of M, progress, at risk, review backlog. Sortable. "Create cohort". |
| `/cohorts/[id]` | head | Header with program, week, mentor, "Edit". Roster with per-student actions. "Add student". [Assignments](assignments.md) section. |
| `/cohort` | mentor | Every cohort the mentor staffs: roster (read-only) and assignments. |

Create/edit modal: name, program (fixed after creation), start date, length in weeks, mentor (optional).

## Behavior

- **Length** is stored as start and end dates: `ends_on = starts_on + weeks × 7`. Week = whole weeks since start + 1,
  capped at the length; 0 before the start. New cohorts are `planned` before their start date, `active` after.
- **Mentor.** The UI has one mentor per cohort: the first staff member with role `mentor`. Setting one makes them
  staff (`mentor`) and mentor of every enrolled student, and removes the previous mentor from staff. "No mentor"
  removes both. New enrollments get the cohort's mentor.
- **Mentor picker** lists everyone who isn't a student: a new mentor has no cohort yet, so no role.
- **Add student**: anyone who is a student elsewhere or not placed yet, and not in this cohort.
- **Roster row**: name, username, assignments accepted / total, lessons completed / opened, submissions waiting for
  review (overdue after 48 h), and a badge: the enrollment status when not active, else "at risk".
- **At risk**: active, 3+ lessons opened, under half completed (a placeholder rule, O9).
- **Status** change: active / paused / completed / dropped; the API may refuse a transition.
- **Move** to another cohort = enroll there, then mark this enrollment dropped (history stays).
- Progress in the cohorts table = mean of completed / opened lessons over non-dropped students.

## API

| UI call (Nitro) | API calls | Notes |
|---|---|---|
| `GET /api/cohorts` | `GET /cohorts/`; per cohort `GET …/staff`, `GET …/progress`, `GET …/submissions?status=submitted` | |
| `POST /api/cohorts` | `POST /programs/{p}/cohorts`, then mentor setup | Returns `{id, name}` |
| `PATCH /api/cohorts/[id]` | `PATCH /cohorts/{c}`, mentor setup when changed | Program can't change |
| `GET /api/cohorts/[id]` | `GET /cohorts/{c}`, `/cohorts/?program_id`, `…/staff`, `…/enrollments`, `…/progress`, 3 × `…/submissions`, `…/courses`, outlines, per-lesson assignment, `/me/access` | O7 |
| `GET /api/cohorts/mine` | `/me/access`, then the roster per staffed cohort | |
| `GET /api/cohorts/options` | `GET /cohorts/` | For pickers |
| `POST /api/cohorts/[id]/enrollments {userId}` | `POST …/enrollments`, `PUT …/mentors/{user}` if there's a mentor | 409 when already enrolled |
| `PATCH /api/enrollments/[id] {status}` | `PATCH /enrollments/{id}` | Enrollment id, not user id |
| mentor setup | `PUT/DELETE …/staff/{user}`, `PUT/DELETE …/mentors/{student}` | |

## Acceptance criteria

- [x] Head creates a cohort with a mentor; the roster shows that mentor.
- [x] Week maths: a cohort that started 8 days ago with 12 weeks shows "week 2 of 12".
- [x] Enrolling a student shows them on the roster; enrolling twice is a conflict.
- [x] Pausing an enrollment works and shows the status badge.
- [x] The mentor's `/cohort` lists their cohort and students, read-only.
- [x] The roster counts accepted assignments per student.
- [ ] Moving a student enrolls them in the target cohort and drops the old enrollment.
- [ ] Changing or removing the mentor updates staff and every student's mentor.

## Known gaps

[O7](../open-items.md) per-lesson calls · [O9](../open-items.md) at-risk rule · the API allows several mentors and
reviewers per cohort; the UI shows and sets one.
