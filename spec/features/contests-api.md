# LeetCode contests: registration, stored results, attendance (API)

For the backend team. Tracked as [O35](../open-items.md). UI: [contests](contests.md).

## Why

The `leetcode` module already lists LeetCode's contests, saves one by slug and returns each user's result. Four things
are missing for the student side:

1. Students cannot read saved contests: `contest.read` is not granted to them.
2. There is no "I will attend" sign-up in the LMS.
3. Results are fetched live, one LeetCode call per user, on every view. That is slow and a LeetCode outage breaks the
   page. They should be stored once the contest is over.
4. No attendance: nobody can see who registered and did not take part, or who took part unregistered.

Managing contests (add, remove, re-sync) becomes **superuser only** here; [leetcode-api](leetcode-api.md) then lets the
superuser name LeetCode mentors who manage too. Today `contest.manage` also reaches the `admin` role.

## Model

`contest_registration` (a user's sign-up for one saved contest):

| Column | Type | Notes |
|---|---|---|
| `contest_id` | FK `contest`, PK | cascade on delete |
| `user_id` | FK `user`, PK | cascade on delete |
| `created_at` | timestamptz | |

`contest_result` (what LeetCode said about one user for one contest; written by the sync):

| Column | Type | Notes |
|---|---|---|
| `contest_id` | FK `contest`, PK | cascade on delete |
| `user_id` | FK `user`, PK | |
| `leetcode_id` | text | the handle used for the lookup |
| `attended` | bool | LeetCode's `attended` flag |
| `solved` | int, null | `problemsSolved`; null when not attended |
| `ranking` | int, null | LeetCode's rank, kept for later; the UI ranks by `solved` |

`contest.results_synced_at` (timestamptz, null): when the last sync finished; null before the first.

Attendance is **derived on read**, never stored. The frontend derives it from `registered` and `attended`:

| `registered` | `attended` | meaning |
|---|---|---|
| yes | yes | took part |
| yes | no | no-show |
| no | yes | took part without registering |
| no | no | did not take part |

## Rules

1. **Registration closes at `start_time`.** Before it, PUT and DELETE work; from the start on, both answer
   `409 contest_started`.
2. **A LeetCode ID is required to register.** `422 leetcode_required` otherwise. Un-registering needs no ID.
3. **Any signed-in user may register**: student, mentor, head.
4. **Results are stored, not fetched per view.** A taskiq job (pattern of `notifications/tasks.py`) runs hourly and
   syncs every saved contest whose end (`start_time + duration`) was between 1 and 48 hours ago. LeetCode's history
   lags the end of a contest, hence the delay. A superuser can sync any finished contest by hand.
5. **A sync covers every user with a `leetcode_id`**, registered or not (that is how walk-ins appear). It reuses
   `fetch_user_contest_results`, the title match and `RESULTS_CONCURRENCY` of the current `contest_results`, then
   upserts one `contest_result` row per user and sets `results_synced_at`. A LeetCode failure for one user keeps that
   user's old row and does not fail the sync; if LeetCode is unreachable for all, answer `503` and keep every old row.
6. **Before the first sync**, `GET .../results` still lists every user with a `leetcode_id`, with
   `attended: false, solved: null`. The frontend shows "results are stored within an hour" while
   `results_synced_at` is null.
7. **Deleting a contest deletes its registrations and results** (cascade).

## Endpoints

Errors use the API's usual envelope, `{ "error": { "code", "message", ... } }`. Codes the frontend reads:
`contest_not_found` (404), `contest_started` (409), `contest_not_finished` (409), `leetcode_required` (422),
`validation_error` (422, unknown slug on save), `contest_exists` (409). A 403 is shown as a generic failure.
Unchanged routes keep their shape: `GET /contest/fetch_past`, `GET /contest/fetch_upcoming`, `POST /contest/`,
`DELETE /contest/{title_slug}`.

### `GET /contest/`

Any signed-in user. Saved contests, latest start first. Three new fields:

```json
{ "id": 7, "title_slug": "weekly-contest-470", "title": "Weekly Contest 470", "start_time": "2026-11-09T12:00:00Z",
  "duration": 5400, "created_at": "...", "registered": true, "registrations": 12, "results_synced_at": null }
```

`registered` is the caller's own sign-up; `registrations` the number of registered users.

### `PUT /contest/{title_slug}/registration`

Any signed-in user, for themselves. Idempotent (a second PUT is still `204`). `404 contest_not_found`,
`409 contest_started`, `422 leetcode_required`.

### `DELETE /contest/{title_slug}/registration`

Cancel the caller's sign-up. Idempotent (`204` when there was none). `404 contest_not_found`,
`409 contest_started`.

### `GET /contest/{title_slug}/results`

Any signed-in user. Reads stored rows only, no call to LeetCode. One item per non-deleted user with a `leetcode_id`:

```json
{ "user": { "id": 3, "name": "...", "username": "aigul", "email": "..." }, "leetcode_id": "aigul_lc",
  "solved": 3, "registered": true, "attended": true }
```

`solved` is null when `attended` is false. `404 contest_not_found`.

### `POST /contest/{title_slug}/sync`

Superuser only. Runs the sync of rule 5 now and returns the contest as `GET /contest/` does, with the new
`results_synced_at`. `409 contest_not_finished` before the contest has ended, `404 contest_not_found`,
`503` when LeetCode is unreachable.

The rating leaderboard and a person's profile are specified in [leetcode-api](leetcode-api.md), not here.

## Permissions

Management here is superuser only; [leetcode-api](leetcode-api.md) widens it to superuser or contest manager (LeetCode mentor). Build both together.

| Caller | Read (list, results) | Register | Add / remove / sync / fetch from LeetCode |
|---|---|---|---|
| Student, mentor | yes | yes | no (403) |
| Program lead, admin role | yes | yes | no (403) |
| Superuser | yes | yes | yes |

Implementation hint: management routes use `get_current_superuser`; the rest use `get_current_user`. The
`contest.read` and `contest.manage` permissions can go.

## Tests

- A student, a mentor, an admin-role user and a program lead get 403 on `fetch_past`, `fetch_upcoming`, `POST /`,
  `DELETE`, `sync`. A superuser gets 200/201/204.
- Every signed-in role can `GET /contest/` and results.
- Register twice → both `204`, `registrations` goes up once. Un-register twice → both `204`.
- A user without `leetcode_id` registering → `422 leetcode_required`.
- Registering at `start_time` and after → `409 contest_started`; one second before → `204`.
- Sync before the end → `409 contest_not_finished`. Sync twice → same rows, no duplicates.
- Sync with one user's LeetCode lookup failing → the others updated, that user's old row kept.
- Results before the first sync → all users listed, `attended: false`.
- Deleting a contest removes its registrations and results.

## Frontend after it ships

Regenerate `shared/types/api.d.ts` (`npm run api:types`) and replace the hand-written shapes in
`app/api/utils/contests.ts` with `components['schemas'][...]`. Until then the mapper accepts today's responses (no
`registered`, `registrations`, `results_synced_at`; no `registered`/`attended` on results) and reads them as "not
registered, attended when `solved` is set". Then run the checks in [contests](contests.md#checks).

## Open questions for the backend

- Should registration also close a little before the start (say 5 minutes) to leave time for the sync of
  participants? The default here is: closes at `start_time`.
- Is an hourly job enough, or should the job also re-sync the last 48 hours every time (cheap with `RESULTS_CONCURRENCY`
  but one LeetCode call per user)? The default here is: once per contest in the 1–48 hour window, plus the manual sync.
