# Mentoring sessions

**Roles:** mentor · student · **Data:** API (not built yet, see [sessions-api](sessions-api.md); [O38](../open-items.md))

A mentor runs a weekly group session per cohort and 1:1 calls with their mentees. The mentor schedules, edits and
cancels them on `/sessions`; students and mentors see them on `/mentor`, `/sessions` and Home.

## Screens

| Route | Who | What it shows / does |
|---|---|---|
| `/sessions` | mentor | Upcoming sessions grouped by day: time, kind, who (the student for 1:1, the cohort for group), time left. **New session** opens the form; each row has edit and cancel. Cancelled rows are struck through with a "Cancelled" badge and no actions. |
| `/mentor` | student | The mentor card and the student's sessions: kind, date, time left, a "Join" button when the session has a link. Cancelled rows are struck through. |
| `/` (Home) | mentor | **Upcoming sessions** in the right rail: the next four, cancelled ones left out. |
| `/` (Home) | student | **Next session** on the mentor card: the first session of the current cohort that has not started and is not cancelled. Hidden when there is none. |

## Behavior

- **Window.** The list is `GET /me/sessions` with its default window (now to +28 days); a session in progress stays listed. The API's order (by start) is kept.
- **Form.** Cohort (active or planned cohorts where the user is mentor staff), type (group or 1:1), student (1:1 only: the mentor's own active or paused mentees in that cohort), start, duration (15 to 240 minutes, default 60), meeting link (optional, `http://` or `https://`), note (optional, up to 500 characters). The start is read on the browser's clock and sent as a UTC instant.
- **Edit.** Only start, duration, link and note change; cohort, kind and student are shown as text. Only changed fields are sent; saving without changes just closes the form. Kind, cohort and student change by cancelling and creating a new session.
- **Cancel.** Asks for confirmation, then `POST /sessions/{id}/cancel`. The session stays in the list as cancelled.
- **Errors.** The API's code picks the message (`sessions.err.<code>`): `session_in_past` and `not_your_mentee` show under their field, `validation_error` shows the API's field messages, the others (`not_cohort_mentor`, `cohort_finished`, `session_cancelled`, `session_not_found`, `permission_denied`) as a toast. After `cohort_finished`, `session_cancelled` or `session_not_found` the list reloads. Anything else shows "Could not save".
- **Missing endpoint.** `GET /me/sessions` failing (404, 403, 5xx; not 401) means "not available yet": `/sessions` shows "Coming soon", `/mentor` and the Home rails show their empty text, the mentor card has no next session. A 401 still ends the session.

## API

| UI call | API calls | Notes |
|---|---|---|
| `GET /api/sessions` | `GET /me/sessions` | `{ items, available }`; `available` is false when the read fails |
| `POST /api/sessions` | `POST /sessions` | Body: `cohortId`, `kind`, `studentId` (1:1), `startsAt`, `durationMin`, `link`, `note` |
| `PATCH /api/sessions/{id}` | `PATCH /sessions/{id}` | Any of `startsAt`, `durationMin`, `link`, `note`; empty `link` or `note` clears it |
| `POST /api/sessions/{id}/cancel` | `POST /sessions/{id}/cancel` | |
| `GET /api/cohorts/mine` | | Cohorts and rosters for the form pickers |
| `GET /api/dashboard/mentor` (`sessions`) | `GET /me/sessions` | Not cancelled, first four |
| `GET /api/dashboard/mentee` (`mentor.nextSessionAt`) | `GET /me/sessions` | See above |
| `GET /api/mentor/profile` (`sessions`) | `GET /me/sessions` | Empty list when the read fails |

`with` is derived for the viewer: the student (1:1) or the cohort (group) for the mentor, the mentor for a student.

## Acceptance criteria

- [ ] With the endpoint missing (404): `/sessions` shows "Coming soon", `/mentor` and the Home rails show their empty text, nothing else breaks.
- [ ] A mentor creates a group session and a 1:1; both appear on `/sessions`, and the student sees them on `/mentor`.
- [ ] A past start shows the `session_in_past` message under the start field.
- [ ] Editing changes the row; a link makes "Join" appear on the student's `/mentor`.
- [ ] Cancelling keeps the row, struck through, and removes it from the Home rail and from the student's next session.

## Known gaps

[O38](../open-items.md): the backend has no sessions yet. No recurrence, student booking, reminders or calendar export ([sessions-api](sessions-api.md#known-gaps)).
