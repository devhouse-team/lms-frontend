# LeetCode contests

**Roles:** everyone reads, registers and opens profiles; the superuser and LeetCode mentors manage · **Data:** API.
Registration, stored results and attendance wait for the backend ([contests-api](contests-api.md), O35); mentors,
attendance management, the LMS rating and profiles wait for [leetcode-api](leetcode-api.md) (O36).

The academy sits LeetCode's weekly and biweekly contests together. The superuser picks which contests the academy
tracks and names **LeetCode mentors**, who manage contests too. Everyone with a LeetCode ID can register ("I will
attend"). After a contest the API stores each user's result; the LMS shows who took part, who registered and did not
(no-show), who took part without registering, and ranks people with its **own rating** (Elo-style, LMS users only).

The backend's `is_superuser` assigns mentors. A mentor is a `contest_manager`: adds, removes and syncs contests,
registers other people, corrects attendance. The `admin` role and program leads read and register like anyone else.

## Screens

| Route | Who | What it shows / does |
|---|---|---|
| `/contest` | everyone | **Running and upcoming** contests: countdown, registered count, Register / Cancel. **Past contests**: date tabs; **Results** (place, name, LeetCode ID, attendance mark, solved/4, own row marked) and **Rating** (LMS leaderboard: place, rating, last change, contests, solved). Names link to the profile. |
| `/leetcode/{username}` | everyone | A person's progress: **rating card** (big rating, trend arrow; hover or arrow keys pick a contest and show its date, title, LMS rank n/m and solved x/4), line chart of the rating over time, totals, every contest with mark, rank, solved and rating change. A LeetCode link. |
| `/contests` | superuser, LeetCode mentor | Saved contests (select, remove). **LeetCode mentors** (superuser only): pick a user, add, remove. For the selected contest: upcoming → **Registrations** (register or cancel anyone with a LeetCode ID); finished → results with a per-row menu (excuse, took part, clear correction), counts, **Update results** and when it last ran. **Add from LeetCode** (upcoming and past lists). Nav entry "Manage contests" for managers in every role. |
| `/people/{id}` | head (admin) | **LeetCode contests** section: the same progress view. |
| `/` (Home) | student, mentor, head | **Next contest** rail: title, date, countdown. Student: Register / Cancel until the start, then "Running now" with a link. Head: registered count and a link to `/contests` (managers) or `/contest`. |

## Behavior

- **Which contest is "next".** The running one, else the soonest upcoming. Status is derived from `startsAt` and
  `durationSec` on the client (`contestStatus`), never stored.
- **Registration** is optimistic and rolls back on failure. It closes at the start: the button is replaced by "Registration
  closed" (or "Running now"). A user without a LeetCode ID sees the button disabled and a link to `/me`; the API's
  `422 leetcode_required` shows the same hint. Other API errors are toasts keyed by code (`contest.err.<code>`).
- **Managers register others** on `/contests` until the start, with the same rules (`contest_started`,
  `leetcode_required`). The list is the contest's results (every user with a LeetCode ID).
- **Attendance** per contest, from `registered`, `attended` and the manager's correction: took part (check), no-show
  (user-x, warning), took part without registering (user-plus), excused (shield-check), neither (no mark). Marks carry
  text labels for screen readers. A correction ("excused", or "took part") needs a finished contest, takes an optional
  note, can be cleared, and **never changes the rating**.
- **Before the first sync** of a finished contest the results list has everyone with "—", plus the line "Results are
  stored within an hour after the contest ends." (`results_synced_at` is null).
- **Place in a contest** is by problems solved; ties share a place (1, 2, 2, 4); people who did not take part come
  last with no place.
- **LMS rating** is computed by the API ([leetcode-api](leetcode-api.md#lms-rating)); the UI only shows it. Start 1500.
  The leaderboard (`GET /api/contests/rating`) lists users with at least one rated contest. Users never rated show
  "Not rated yet" on their profile and no chart.
- **Profile** (`/leetcode/{username}`, `ContestProgress`): `GET /api/contests/users/{username}`; `404 user_not_found`
  reads "This person was not found". The chart is plain SVG (no chart library): x by contest date, y by rating after the
  contest; the latest contest is shown until the pointer or ←/→ picks another.
- **Mentors.** Only the superuser sees the section and the user picker (`GET /users/` through
  `/api/contests/managers/options`). Removing a mentor takes effect on their next session load.
- **Old API.** The mapper reads missing fields as "not registered; attended when `solved` is set; no override", and the
  new endpoints answer 404/405 (toast "could not save", rating and profile show their error text).

## API

| UI call (browser route) | API calls | Notes |
|---|---|---|
| `GET /api/contests/saved` | `GET /contest/` | any signed-in user; carries `registered`, `registrations`, `results_synced_at` |
| `GET /api/contests/saved/{slug}/results` | `GET /contest/{slug}/results` | any signed-in user; ranked on the client; carries `override` and the user id |
| `PUT` / `DELETE /api/contests/saved/{slug}/registration` | same path under `/contest` | any signed-in user, for themselves |
| `PUT` / `DELETE /api/contests/saved/{slug}/registrations/{userId}` | same path under `/contest` | manager |
| `PUT` / `DELETE /api/contests/saved/{slug}/attendance/{userId}` | same path under `/contest` | manager; body `{ status: excused \| attended, note }` |
| `POST /api/contests/saved/{slug}/sync` | `POST /contest/{slug}/sync` | manager |
| `GET /api/contests/rating` | `GET /contest/rating` | any signed-in user |
| `GET /api/contests/users/{username}` | `GET /contest/users/{username}` | any signed-in user |
| `GET /api/contests/managers`, `PUT` / `DELETE /api/contests/managers/{id}`, `GET .../managers/options` | `/contest/managers[/{id}]`, `GET /users/` | superuser |
| `GET /api/contests/leetcode/{past,upcoming}` | `GET /contest/fetch_past`, `fetch_upcoming` | manager; paging on past |
| `POST /api/contests/saved` | `POST /contest/` | manager; 422 unknown slug, 503 LeetCode down |
| `DELETE /api/contests/saved/{slug}` | `DELETE /contest/{slug}` | manager |
| `GET /api/dashboard/{mentee,mentor,head}` | `GET /contest/` | next contest for the rail; a failure reads as "no contest" so Home still loads |

Guards: `requireContestManager` (session `canManageContests` = `is_superuser` or `/me/access.contest_manager`) on the
manage routes; `requireSuperuser` (session `isSuperuser`) on the mentor routes. Page meta `contestManager: true` on
`/contests`.

## Checks

Run from the repo root. The role and screen checks in Acceptance criteria are manual and need the backend ([O35](../open-items.md), [O36](../open-items.md)); no script yet.

| What | Command |
|---|---|
| Mappers, status, next contest, attendance and overrides, ranking, profile series and trend | `node --experimental-strip-types scripts/contests.check.ts` |
| Types and build | `npm run typecheck`, `npm run build` |

## Acceptance criteria

- [x] Mappers read both today's and the new API shape; status, next contest, attendance, overrides and ties are right (`contests.check.ts`).
- [x] The profile series (rated contests, oldest first) and the trend arrow are right (`contests.check.ts`).
- [x] Typecheck and production build pass.
- [ ] Only the superuser and mentors see "Manage contests"; only the superuser sees the mentor section; a student or an admin-role head gets 403 (manual, needs the backend).
- [ ] The superuser assigns a mentor, who then registers others and excuses a no-show; removing the mentor closes `/contests` (manual, needs the backend).
- [ ] A student registers and cancels on `/contest` and from Home; the count follows (manual, needs the backend).
- [ ] The Rating tab is ordered by rating; a name opens `/leetcode/{username}`; hover and arrow keys move the chart (manual, needs the backend).
- [ ] `/people/{id}` shows the same progress.
- [ ] Against the real backend: the manual checks above pass (waits for [O35](../open-items.md) and [O36](../open-items.md)).

## Known gaps

- [O35](../open-items.md), [O36](../open-items.md): registration, stored results, mentors, overrides, rating and profiles are not in the API yet.
- Mentor Home shows the next contest but offers no Register button (mentors register on `/contest`).
- `/people/{id}` shows "not found" for a person without a LeetCode ID.
