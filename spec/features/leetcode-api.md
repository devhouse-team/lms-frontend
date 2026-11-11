# LeetCode contests: mentors, attendance management, LMS rating, participant profile (API)

For the backend team. Tracked as [O36](../open-items.md). Builds on [contests-api](contests-api.md) (O35). UI:
[contests](contests.md).

## Why

1. The superuser alone manages contests. They want to name **LeetCode mentors**, any user, who manage them too.
2. Superuser and mentors must **manage attendance**: register or un-register anyone before the start, and after the
   sync correct the outcome (excuse a no-show, mark someone who took part but LeetCode missed).
3. The LMS needs **its own rating** (Elo-style, among LMS users only) and a leaderboard. LeetCode's global rating and
   rank are not used.
4. Every participant gets a **profile**: rating over time, attended contests, LMS rank per contest.

This **replaces** the "superuser only" rule of contests-api.md for management routes: they become *superuser or
contest manager*. Only assigning managers stays superuser only.

## Model

`contest_manager` (a user who manages contests):

| Column | Type | Notes |
|---|---|---|
| `user_id` | FK `user`, PK | cascade on delete |
| `created_by` | FK `user` | the superuser |
| `created_at` | timestamptz | |

`/me/access` gains `contest_manager: bool` (the UI shows "Manage contests" when `is_superuser or contest_manager`).

`contest_attendance_override` (a manager's correction; the synced LeetCode row is never edited):

| Column | Type | Notes |
|---|---|---|
| `contest_id` | FK `contest`, PK | cascade on delete |
| `user_id` | FK `user`, PK | |
| `status` | enum `excused`, `attended` | `excused`: not counted as a no-show. `attended`: counts as took part |
| `note` | text, null | shown to managers |
| `set_by`, `set_at` | FK `user`, timestamptz | |

Effective attendance of a user in a contest, from `registered`, LeetCode's `attended` and the override:

| LeetCode `attended` | override | effective `attended` | `attendance` label |
|---|---|---|---|
| yes | none | yes | `attended` if registered, else `walk_in` |
| no | `attended` | yes | same two labels |
| no | `excused` | no | `excused` |
| no | none | no | `no_show` if registered, else `absent` |

An override never changes `solved` and **never changes the rating** (the rating uses LeetCode's own `attended` and
`solved` only).

## Permissions

| Caller | Read (list, results, rating, profile) | Register self | Manage contests (fetch, add, remove, sync) | Register others, overrides | Assign managers |
|---|---|---|---|---|---|
| Any signed-in user | yes | yes | no (403) | no (403) | no (403) |
| Contest manager | yes | yes | yes | yes | no (403) |
| Superuser | yes | yes | yes | yes | yes |

## Endpoints

Errors use the usual envelope. New codes the frontend reads: `user_not_found` (404). Reused: `contest_not_found`,
`contest_started`, `contest_not_finished`, `leetcode_required`, `validation_error`.

### Managers (superuser only)

- `GET /contest/managers` → `[{ "user": { "id", "name", "username", "email" }, "created_at" }]`, by name.
- `PUT /contest/managers/{user_id}` → `204`, idempotent. `404 user_not_found`.
- `DELETE /contest/managers/{user_id}` → `204`, idempotent.

The user picker uses the existing `GET /users/`.

### Registration of another user (manager)

- `PUT /contest/{title_slug}/registrations/{user_id}` and `DELETE` of the same path → `204`, idempotent. Same rules as
  self-registration: `409 contest_started` from the start on, `422 leetcode_required` when that user has no
  LeetCode ID, `404 contest_not_found`, `404 user_not_found`.

The registrant list is the existing `GET /contest/{slug}/results` (every user with a LeetCode ID and their
`registered` flag).

### Attendance override (manager)

- `PUT /contest/{title_slug}/attendance/{user_id}` with `{ "status": "excused" | "attended", "note": "..." | null }` →
  `204`, replaces any earlier override. `409 contest_not_finished` before the contest ends, `422 validation_error`
  for another status, `404`s as above.
- `DELETE` of the same path → `204`, idempotent.

### `GET /contest/{title_slug}/results` (changed)

Each row gains `override: { "status": "excused" | "attended", "note": null } | null`. `attended` is the **effective**
flag of the table above. `user` carries `id`.

### `GET /contest/rating` (any signed-in user)

The leaderboard: users with at least one rated contest, highest rating first; ties share `place`.

```json
[{ "user": { "id": 3, "name": "Aigul", "username": "aigul", "email": "..." }, "leetcode_id": "aigul_lc",
   "rating": 1612, "place": 1, "attended": 4, "solved": 12, "last_delta": 18 }]
```

### `GET /contest/users/{username}` (any signed-in user)

```json
{ "user": { "id": 3, "name": "...", "username": "aigul", "email": "..." }, "leetcode_id": "aigul_lc",
  "rating": 1612, "place": 1,
  "totals": { "registered": 5, "attended": 4, "no_show": 1, "excused": 0, "solved": 12 },
  "history": [{ "slug": "weekly-contest-100", "title": "Weekly Contest 100", "start_time": "2026-10-29T12:00:00Z",
                "registered": true, "attended": true, "attendance": "attended", "override": null, "solved": 3,
                "lms_rank": 1, "participants": 3, "rating_before": 1594, "rating_after": 1612 }] }
```

- `history`: every contest with stored results in which the user has a row, **newest first**. `lms_rank`,
  `participants`, `rating_before`, `rating_after` are null when the user did not take part (LeetCode's `attended`).
- `rating` and `place` are null before the first rated contest. `404 user_not_found` for an unknown username, a deleted
  user, or a user without a LeetCode ID.

## LMS rating

Start at **1500**. A contest is rated when its results are stored. Participants are the users with LeetCode's
`attended` true. Replay **all** contests with stored results in start order on every sync or delete, so the outcome is
deterministic and survives re-syncs; ratings are rounded to integers after each contest.

For participant `i` with rating `Ri`, over the other participants `j`:

1. `rank_i` = 1 + number of participants who solved more. Ties share it. `mid_i` = `rank_i + (ties_i - 1) / 2`.
2. `seed(R) = 1 + Σ_j 1 / (1 + 10^((R - Rj) / 400))`.
3. Target `m_i = sqrt(mid_i · seed(Ri))`. `R*` is the `R` with `seed(R) = m_i` (binary search, `R` in 0..5000).
4. `Δ_i = (R* - Ri) · f(k_i)` with `f(k) = 1 / (1 + Σ_{t=0..k} (5/7)^t)`, where `k_i` is the number of contests the
   user was rated in before this one (the first contest moves a rating by half the gap).
5. `rating_after = round(Ri + Δ_i)`. With fewer than two participants, `Δ = 0` and nobody is "rated" in that contest
   (it does not count as `k`).

`lms_rank` is `rank_i`; `participants` the number of participants. Users who did not take part keep their rating.

## Tests

- A student and a mentor get 403 on `GET/PUT/DELETE /contest/managers`. A manager gets 403 there too, and 200/201/204
  on `fetch_upcoming`, `fetch_past`, `POST /`, `DELETE`, `sync`.
- `/me/access.contest_manager` follows the assignment; PUT twice and DELETE twice are `204`.
- A manager registers another user: `204`, idempotent, `registrations` counts it; `409 contest_started` at the start;
  `422 leetcode_required` for a user without an ID. A student doing it gets 403.
- Override before the end → `409 contest_not_finished`. `excused` turns `no_show` into `excused`; `attended` makes
  `attended` true; DELETE restores. Neither changes any rating.
- Rating: everyone starts at 1500; in the first contest the best solver ends above 1500 and the worst below;
  `rating_before` equals the previous `rating_after`; re-syncing changes nothing; a contest with one participant moves
  nobody; deleting a contest recomputes.
- Profile and leaderboard shapes as above; `404 user_not_found`.
