# Payments

**Roles:** head (program lead and admin) manage; student sees the reminder and the block · **Data:** API (not built yet, see [payments-api](payments-api.md); [O34](../open-items.md))

Students pay monthly, each on their own day. Cohort start and length play no part: a student who joined on 20 September
and one who joined on 20 October each pay on their own 20th. A head sets up billing per student. A student whose due
date is within 7 days gets a reminder when they open the LMS. A student who is past the due date and unpaid is blocked.

The rule is enforced **in the frontend only** for now. A student who calls the API directly is not stopped.

## Model

Billing belongs to a **user**, not to an enrollment: one bill even when the student is in two cohorts.

| Field | Meaning |
|---|---|
| `enabled` | Billing is on. Off = never reminded, never blocked. Default off, so existing students are not blocked on release. |
| `billing_day` | 1–31. A shorter month uses its last day. Defaults to the day the student joined. |
| `next_due_on` | Date the next payment is due. |
| `status` | `exempt` (billing off) · `paid` (more than 7 days to go) · `due_soon` (0–7 days) · `overdue` (past the date) |
| `days_left` | `next_due_on` minus today; negative when overdue. |

"Mark paid" records a payment and moves `next_due_on` one month ahead, onto `billing_day`.

## Screens

| Route | Who | What it shows / does |
|---|---|---|
| `/payments` | head | All students with billing: status tabs, search, billing day, next due date, days left, last paid. Row actions: mark paid, edit, history. |
| `/` (Home) | student | **Payment** card in the right rail: status badge, days left (not when paid), next due date, billing day. Hidden when billing is off. |
| every page | student | `due_soon`: a reminder dialog, once per LMS open. |
| `/people/{id}` | head (admin) | **Payments** section for a student: status, due date, billing day, Mark paid / Edit, and every payment with date, recorded by and note. Hidden for non-students and when the billing call fails. |
| `/payment-required` | student | `overdue`: the only page they can open. Message, due date, log out. A user with another role (mentor, head) can switch to it. |

## Behavior

- **Who is billed.** Only the student view (`role === 'mentee'`). A user who is also a mentor or head is blocked only while in the student view.
- **Reminder.** Shown on the first page of an LMS open (a browser session) while `status === 'due_soon'`. Closing it hides it until the next open. It stops when the student is marked paid (the next load shows `paid`) or the due date passes (then the block applies).
- **Block.** Any route except `/payment-required` redirects there. The page has no menu. Marking paid unblocks the student on their next load or refresh.
- **Missing endpoint.** `GET /me/billing` failing (404, 501, any error but 401) counts as `exempt`: the frontend can ship first, and a billing outage never locks students out.
- **Mark paid moves one period.** A student several months behind stays overdue (and blocked) until every owed period is marked; each mark moves the due date one month. Switching billing back on with an old date would block at once, so the edit dialog proposes the next upcoming date.
- **Day and date agree.** The due date is always on the billing day. In the edit dialog, picking day 8 moves the date to the 8th of the same month, and picking a date sets the day to its day.
- **Setting up.** Enabling billing needs `billing_day` and `next_due_on`. The edit dialog proposes the next occurrence of the day.
- **Notes.** A note is typed when marking a payment paid and stays with that payment. The profile and the History panel on `/payments` show it. There is no separate per-student note.
- **Head scope.** An admin sees every student; a program lead sees the students of their programs (the API decides).

## API

| UI call (Nitro) | API calls | Notes |
|---|---|---|
| `GET /api/me/billing` | `GET /me/billing` | Read with the session user (`loadUser`) |
| `GET /api/billing/students` | `GET /billing/students` | |
| `GET /api/billing/students/{id}` | `GET /billing/students/{user_id}` | One student, for the profile |
| `PATCH /api/billing/students/{id}` | `PATCH /billing/students/{user_id}` | |
| `POST /api/billing/students/{id}/payments` | `POST /billing/students/{user_id}/payments` | Mark paid |
| `GET /api/billing/students/{id}/payments` | `GET /billing/students/{user_id}/payments` | History |

## Acceptance criteria

- [ ] `due_soon` student: the reminder opens on the first page of a session, not on the next navigation, and again in a new session.
- [ ] `paid` or `exempt` student: no reminder, no block.
- [ ] Student Home shows the Payment card for a billed student (any status) and none for an unbilled one.
- [ ] `overdue` student: every route lands on `/payment-required`; log out works.
- [ ] A mentor who is also a student can switch to the mentor view and use the LMS.
- [ ] `GET /me/billing` failing (404): no reminder, no block.
- [ ] `/people/{id}` of a student shows the billing state and every payment with its note; marking paid there updates both at once.
- [ ] `/payments` filters by status and search; Mark paid moves the due date one month; Edit saves the three fields.

## Known gaps

[O34](../open-items.md): the backend has no billing yet. Enforcement is frontend-only.
