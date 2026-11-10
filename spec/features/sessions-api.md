# Mentoring sessions API

For the backend team. Tracked as [O38](../open-items.md). UI: [sessions](sessions.md). Backend [S7.3 and S7.4](../../../lms-backend/spec/open-items.md) (G9).

## Why

Mentors run a weekly group session per cohort and 1:1 calls with mentees. Today the frontend invents a schedule in an
in-memory mock. Mentors must create, change and cancel real sessions; students and mentors must see them on Home,
`/mentor` and `/sessions`.

## Model

`mentoring_session`:

| Column | Type | Notes |
|---|---|---|
| `id` | PK | |
| `cohort_id` | FK | |
| `mentor_id` | FK user | cohort staff with role `mentor` |
| `kind` | enum | `group`, `one` |
| `student_id` | FK user, null | required when `kind` is `one`, null when `group` |
| `starts_at` | timestamptz | stored and sent in UTC |
| `duration_min` | int | 15–240 |
| `link` | url, null | meeting link |
| `note` | text, null | up to 500 characters, trimmed; empty becomes null |
| `cancelled_at` | timestamptz, null | a cancelled session is kept |
| `created_at` | timestamptz | |

## Endpoints

Errors use the API's usual envelope. Codes the frontend reads, following the backend convention (domain rule
violations are `422`, missing permission is `403`, as `cohort_finished` and `student_cannot_be_staff` today):
`session_in_past` (422), `cohort_finished` (422), `not_your_mentee` (422), `session_cancelled` (422),
`not_cohort_mentor` (403, create only), `permission_denied` (403),
`validation_error` (422), `session_not_found` (404).

### `GET /me/sessions?from&to`

`from` and `to` are ISO 8601 timestamps; default `from` is now and `to` is `from` + 28 days. The window is half-open,
[`from`, `to`): a session is listed when `starts_at + duration_min > from` and `starts_at < to`, so one in progress
stays listed. `to <= from` is `422 validation_error`. Ordered by `starts_at`. Cancelled sessions are included, with
`cancelled_at` set, so the UI can show them struck through.

- Mentor: sessions where `mentor_id` is them.
- Student: group sessions of cohorts where their enrollment is `active` or `paused`, and their own 1:1s. Finishing a
  cohort turns those enrollments `completed`, so a finished cohort's group sessions drop out.
- A user who is mentor in one cohort and student in another gets the union of both rules, each session once.

Each item: `id`, `kind`, `cohort_id`, `cohort_name`, `mentor_id`, `mentor_name`, `student_id`, `student_name` (both null
for `group`), `starts_at`, `duration_min`, `link`, `note`, `cancelled_at`. Anyone else gets an empty list.

### `POST /sessions`

Body: `cohort_id`, `kind`, `student_id` (for `one`), `starts_at`, `duration_min`, `link`, `note`. Returns the item
above (`201`). The caller is the mentor.

Checks run in this order: 404, then 403, then 422.

- `404 cohort_not_found`: the cohort is unknown or not visible to the caller (backend visibility rule).
- `403 not_cohort_mentor`: the caller sees the cohort but is not mentor staff on it (a reviewer, student, program
  lead or admin).
- `422 not_your_mentee`: for `one`, `student_id` is unknown, not enrolled, not the caller's mentee in that cohort, or
  the enrollment is not `active` or `paused`.
- `422 cohort_finished`: the cohort is finished.
- `422 session_in_past`: `starts_at` is not in the future.
- `422 validation_error`: `duration_min` out of range, `student_id` missing for `one` or set for `group`, bad `link`,
  `note` too long. A valid `link` is an absolute `https://` or `http://` URL of at most 2000 characters.

### `PATCH /sessions/{id}`

Only the owner mentor. Body, all optional: `starts_at`, `duration_min`, `link`, `note`. Kind, cohort and student do not
change (cancel and create a new one). Checks run in this order: `404 session_not_found`, then `403 permission_denied`
(anyone but the owner mentor, another mentor of the same cohort included), then 422, with `session_cancelled` before
the other 422s. `session_in_past` applies only when `starts_at` is in the body. `null` clears `link` and `note`;
`null` for `starts_at` or `duration_min` is `422 validation_error`, as are the other validation rules.
`422 cohort_finished` once the cohort is finished. Returns the item.

### `POST /sessions/{id}/cancel`

Only the owner mentor (`404 session_not_found`, then `403 permission_denied` for anyone else). Sets `cancelled_at`.
Idempotent: cancelling again keeps the first `cancelled_at` and returns `200`. Cancelling a session in the past is
allowed. Returns the item.

## Permissions

| Caller | `GET /me/sessions` | Create, change, cancel |
|---|---|---|
| Student | group sessions of cohorts they are `active` or `paused` in, and own 1:1s | no (403) |
| Mentor | own sessions | own sessions, in cohorts they are mentor in |
| Program lead, admin, superuser | empty list unless they are staff or students themselves | no (403) |

## Tests

- Student sees group sessions of an active cohort and their own 1:1; not another student's 1:1; not a finished
  cohort's group sessions.
- Default window is now to +28 days; `from` and `to` narrow it; order is by `starts_at`; cancelled rows are included.
- A session that started 10 minutes ago and lasts 60 minutes is still listed with the default `from`.
- `POST` for `one` with a student who is another mentor's mentee is `422 not_your_mentee`; with a dropped or unknown
  student too.
- `POST` by a reviewer of the cohort is `403 not_cohort_mentor`; by a mentor of another cohort `404 cohort_not_found`;
  in a finished cohort `422 cohort_finished`; with a past `starts_at` `422 session_in_past`.
- `PATCH` and `cancel` by another mentor, even of the same cohort, are `403 permission_denied`; `PATCH` on a
  cancelled session is `422 session_cancelled`.
- `cancel` twice returns the same `cancelled_at`.

## Frontend after it ships

Regenerate `shared/types/api.d.ts` and read sessions from `GET /me/sessions`: the `/sessions` list, the `/mentor`
list, the Home rail and `nextSessionAt` on the student's mentor card (the first future, not cancelled session of the
student's current cohort). The mentor gets forms to create, edit and cancel. Until then a failing or 404 read means "not available
yet": the screens show their empty state and nothing breaks, the same rule as payments ([O34](../open-items.md)).

## Known gaps

No recurrence (a weekly session is created one by one), no student booking, no notifications or reminders, no
calendar export.

## Open questions for the backend

- Heads (program leads, admins) cannot see a cohort's sessions yet. Optional, later: `GET /cohorts/{c}/sessions`.
