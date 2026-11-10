# Career steps API

For the backend team. Tracked as [O37](../open-items.md). UI: [career](career.md).

## Why

Students tick five career steps (CV, GitHub, LinkedIn, mock interview, applications) on `/career` and see progress on
Home. Today it isn't stored; the frontend is built against this contract and reads it tolerantly. Mentors and heads want
to see a student's progress. The backend lists it as not in MVP ([G9](../../../lms-backend/spec/open-items.md)); this
asks for a plain checklist, nothing more.

Step `mock` means "mock interview", a real product step. It has nothing to do with mock data.

## Model

`career_step` (one row per user and finished step; a row present means done):

| Column | Type | Notes |
|---|---|---|
| `user_id` | FK | cascade on delete; PK with `step` |
| `step` | enum | `cv`, `github`, `linkedin`, `mock`, `apply` |
| `done_at` | timestamptz | when it was ticked |

The set of steps is fixed in the API, in this order: `cv`, `github`, `linkedin`, `mock`, `apply`. Labels and hints are
translated by the frontend.

## Endpoints

Errors use the API's usual envelope. Codes the frontend reads: `career_step_not_found` (404). The 403 code is
`permission_denied`; the frontend shows it as a generic failure. A body without a boolean `done` is
`422 validation_error`.

### `GET /me/career`

All five steps, always in the fixed order, one item each:

```json
[{ "step": "cv", "done": true, "done_at": "2026-11-03T09:12:00Z" },
 { "step": "github", "done": false, "done_at": null }]
```

Allowed for a user with an enrollment `active`, `paused` or `completed` in any cohort. Anyone else, a user with only
`dropped` enrollments included, gets `403`.

### `PUT /me/career/{step}`

Body `{ "done": true }`. Ticks or unticks the step and returns the item as above. Idempotent: ticking a done step
keeps the first `done_at`; unticking a step with no row is a no-op. Unknown `step` is `404 career_step_not_found`.
Same permission as `GET /me/career`.

### Optional, later: `GET /users/{id}/career`

No screen uses it yet (planned for a mentor or head profile view). Same shape as `GET /me/career`, for one student.
Allowed: a mentor with a `mentor_assignment` row for this student in any cohort, the lead of any program the student
is enrolled in, admins and superusers. Others get `403`, and so does a target that is not a student. A mentor loses
the row when the enrollment becomes `dropped` or `completed` by `PATCH` or move; the finish procedure keeps it, so
mentors of a finished cohort keep access. `404 user_not_found` when the user does not exist.

### Optional: `career_done` on `/dashboard/mentor`

Add `career_done` (int 0–5, steps done) to each mentee row of `GET /dashboard/mentor`, so the mentor's list needs no
call per student. Optional; without it the frontend calls `GET /users/{id}/career` only on a profile.

## Permissions

| Caller | Own career (`/me/career`) | `GET /users/{id}/career` |
|---|---|---|
| Student (`active`, `paused` or `completed` enrollment) | read, write | no (403) |
| Mentor | no (403) | students with a `mentor_assignment` to them, any cohort |
| Program lead | no (403) | students in their programs |
| Admin, superuser | no (403) | all students |

## Tests

- `GET /me/career` for a student with no rows returns five items, all `done: false`, in the fixed order.
- `PUT` twice with `done: true` keeps the first `done_at`; `done: false` then removes the row; unknown step is 404.
- A user with no enrollment gets 403 on `/me/career`; a dropped-only student too.
- A mentor reads a mentee of a finished cohort (assignment kept by finish), not a student they never mentored (403),
  nor one whose enrollment was dropped by `PATCH`; a non-student target is 403.
- A program lead reads only students of their programs.

## Frontend after it ships

Regenerate `shared/types/api.d.ts` (`npm run api:types`) and read the steps from `GET /me/career`. Until then a
failing or 404 read means "not available yet": the career page and Home rail show no steps and nothing breaks, the
same rule as payments ([O34](../open-items.md)).

## Open questions for the backend

- Should a student with only a dropped enrollment keep access? The default here is no: `active`, `paused` or
  `completed` only.
