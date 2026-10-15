# Reviews

**Roles:** mentor · **Data:** API

Mentors review students' work quickly: oldest first, accept or send back with feedback.

## Screens

| Route | Who | What it shows / does |
|---|---|---|
| `/reviews` | mentor | Tabs: waiting (oldest first, "overdue" after 48 h) and reviewed (latest 30). |
| `/reviews/[submissionId]` | mentor | Assignment title, student, cohort; the submitted link and note; decision (accept, or request changes with required feedback); instructions and due date. After a decision, opens the next waiting submission. |

## Behavior

- Covers every cohort the mentor staffs (relation `mentor` or `reviewer`). The API decides visibility: a mentor sees
  their assigned students, a reviewer the whole cohort.
- "Reviewed" is ordered by submission time: the queue carries no review time.
- Reviewing twice is a conflict ("already reviewed").
- Earlier attempts aren't shown: no staff endpoint lists them (O11).

## API

| UI call (Nitro) | API calls | Notes |
|---|---|---|
| `GET /api/reviews` | `/me/access`, `GET /cohorts/`, per staffed cohort × 3 statuses `GET …/submissions` | |
| `GET /api/reviews/[id]` | `GET /submissions/{id}`, `GET /cohorts/{c}/lessons/{l}/assignment`, `GET /cohorts/{c}`, `…/staff` | |
| `POST /api/reviews/[id] {verdict, feedback}` | `POST /submissions/{id}/review {decision, feedback}` | `not_reviewable` → 409 |

## Acceptance criteria

- [x] A new submission appears in the mentor's waiting list and dashboard.
- [x] The detail shows the link, note and instructions.
- [x] Request changes and accept both work; a second review is refused.

## Known gaps

[O11](../open-items.md) attempt history for staff
