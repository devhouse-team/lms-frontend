# Payments: billing API

For the backend team. Tracked as [O34](../open-items.md). UI: [payments](payments.md).

## Why

Heads must set a payment day per student and mark payments. Students must learn, when they open the LMS, whether
their payment is near or overdue. Nothing in the API stores this ([backend X3](../../../lms-backend/spec/open-items.md)
lists payments as out of scope; this asks to lift that for a plain schedule, with no prices or amounts).
The frontend enforces the block; the API only stores and serves the data.

## Model

Billing belongs to a **user**, not to an enrollment: one bill even when the student is in two cohorts. Cohort start
and length play no part. A student who joined on 20 September and one who joined on 20 October are each billed on
their own day, every month.

`student_billing` (one row per user; a missing row means "not billed"):

| Column | Type | Notes |
|---|---|---|
| `user_id` | FK, PK | |
| `enabled` | bool | default `false`. Turning it off keeps `billing_day` and `next_due_on`. |
| `billing_day` | int 1–31, null | |
| `next_due_on` | date, null | Always on the billing day (see Rules) |

`billing_payment` (history, append-only):

| Column | Type | Notes |
|---|---|---|
| `id` | PK | |
| `user_id` | FK | |
| `due_on` | date | the `next_due_on` this payment settled |
| `paid_at` | timestamptz | |
| `recorded_by` | FK user | |
| `note` | text, null | up to 500 characters, trimmed; empty becomes null |

`status` and `days_left` are **computed on read**, never stored. `today` is the calendar date in the organisation's
timezone (one configured zone, the same one the cohorts use).

| status | when |
|---|---|
| `exempt` | `enabled` is false, or there is no row |
| `overdue` | `today > next_due_on` |
| `due_soon` | `next_due_on - 7 days <= today <= next_due_on` |
| `paid` | otherwise |

`days_left = next_due_on - today` (negative when overdue); `null` when `exempt`.

## Rules

1. **The due date sits on the billing day.** "Every 8th" means `next_due_on` is an 8th. A month shorter than the day
   uses its last day (day 31 → 28/29 February).
2. **The due day itself is not overdue.** A student due on the 8th is `due_soon` all day on the 8th and `overdue` from
   the 9th. The frontend blocks on `overdue` only.
3. **Marking paid moves one period.** It settles the current `next_due_on` and moves it one month on, to the billing
   day. It does not catch up: a student three months behind who is marked paid once is still `overdue`, with two
   periods owed, until the head marks again. Marking paid ahead of time (status `paid`) is allowed and also moves one
   month.
4. **Switching billing off keeps the schedule.** Switching it back on with a `next_due_on` in the past makes the
   student `overdue` at once. The frontend therefore proposes the next upcoming date when it re-enables, but the API
   accepts whatever date the head sends.
5. **Money is out of scope.** No amounts, prices, invoices or payment provider. A payment is a head's record that the
   student paid.

## Endpoints

Errors use the API's usual envelope, `{ "error": { "code", "message", ... } }`. Codes the frontend reads:
`validation_error` (422), `billing_disabled` (409), `user_not_found` (404). A 403 is shown as a generic failure.

### `GET /me/billing`

Any signed-in user, their own row. A user without a row gets `enabled: false, status: "exempt"` (200, not 404). The
frontend calls it at sign-in and on every reload for students, so it must be cheap and must not 5xx for users without
a row.

```json
{ "enabled": true, "billing_day": 20, "next_due_on": "2026-12-20", "status": "due_soon", "days_left": 5 }
```

### `GET /billing/students`

Admin and superuser: every student. Program lead: students enrolled in their programs. A "student" is a user with at
least one enrollment in any status. Plain array, **no pagination** (the frontend pages it in the browser; same
trade-off as frontend O31). Query: `status` (repeatable; filter on the computed status, so it needs a `CASE` in the
query), `cohort_id`, `q` (name, email, username).

Each row: `user_id`, `name`, `email`, `username`, `profile_image_url`, `cohorts: [{ cohort_id, cohort_name }]`
(cohorts where the enrollment is active or paused), the four fields of `GET /me/billing`, and `last_paid_at` (latest
`paid_at`, null if none). Students with no billing row are included with `enabled: false`, so a head can switch them
on.

### `GET /billing/students/{user_id}`

One row, same shape and permission as the list (the student's profile page reads it). A user with no billing row gets
`enabled: false, status: "exempt"` (200). `404 user_not_found` when the user does not exist; `403` when a program lead
cannot see the student.

### `PATCH /billing/students/{user_id}`

Same permission as the list. Body, all optional: `enabled`, `billing_day` (1–31), `next_due_on`. Creates the row if
missing. Applied in this order:

1. Merge the body onto the stored row.
2. If only `billing_day` changed (no `next_due_on` in the body) and a `next_due_on` is stored, move it to that day
   within its current month (rule 1).
3. Validate, else `422 validation_error`:
   - `billing_day` outside 1–31;
   - `enabled` is true and, after the merge, there is no `billing_day` or no `next_due_on`;
   - `next_due_on` is sent with a `billing_day` (or the stored one) and its day does not match (rule 1).

The frontend sends `{ enabled: false }` alone to switch off, and all three fields to switch on. A `next_due_on` sent
without `billing_day` is valid when it matches the stored day; the frontend always sends both together. Returns the
row as in the list.

### `POST /billing/students/{user_id}/payments`

Body: `{ "note": "..." }` (optional, max 500). In one transaction: insert a `billing_payment` with
`due_on = next_due_on`, then set `next_due_on` one month on (rules 1 and 3). Returns the updated row (list shape).
`409 billing_disabled` when `enabled` is false. Concurrent calls must not both settle the same period: lock the
`student_billing` row.

### `GET /billing/students/{user_id}/payments`

Same permission. History, newest first, no pagination: `id`, `due_on`, `paid_at`, `recorded_by_name`, `note`. The
profile shows the note in full next to each payment.

## Permissions

| Caller | Own `GET /me/billing` | Student endpoints |
|---|---|---|
| Student, mentor | yes | no (403) |
| Program lead | yes | only students in their programs (403 for others) |
| Admin, superuser | yes | all students |

## Tests

- Status boundaries: due in 8 days → `paid`; 7 → `due_soon`; today → `due_soon`; yesterday → `overdue`.
- `billing_day` 31 across February, leap year included; marking paid on 31 January gives 28 or 29 February, then 31 March.
- Late payer: due 3 months ago, mark paid once → still `overdue`, `next_due_on` two months ago plus one.
- PATCH: day alone moves the date; day and a mismatched date is 422; enabling without any date is 422; disabling keeps both fields.
- POST on a disabled student is 409; two parallel POSTs record two different periods, never the same one twice.
- A program lead cannot read or write a student outside their programs, and sees only theirs in the list.
- `GET /me/billing` for a user without a row is 200 `exempt`.

## Frontend after it ships

Regenerate `shared/types/api.d.ts` (`npm run api:types`) and replace the hand-written API shapes in
`app/api/utils/billing.ts` with `components['schemas'][...]`. Until then a failing `GET /me/billing` counts as "not
billed", so nothing breaks. Optional later: reject student calls with `402` while `overdue`, so the block cannot be
bypassed from outside the UI.

## Open questions for the backend

- Should a student with no active or paused enrollment (finished or dropped everywhere) be `exempt` regardless of
  `enabled`? The frontend only bills students whose account has a student cohort relation, and heads can switch
  billing off by hand, so the default here is no automatic rule.
- Which timezone is "the organisation's"? The cohorts carry one (`Asia/Almaty` in current data); using that keeps
  "today" consistent across the LMS.
