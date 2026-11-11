# Career steps

**Roles:** student · **Data:** API (not built yet, see [career-api](career-api.md); [O37](../open-items.md))

Five job-readiness steps a student ticks off: CV, GitHub, LinkedIn, mock interview, first applications. The student sees
progress on `/career` and on Home. Step `mock` is the "mock interview" step, not mock data.

## Screens

| Route | Who | What it shows / does |
|---|---|---|
| `/career` | student | The five steps in fixed order with a hint each and a checkbox; "{done} of {total}". |
| `/` (Home) | student | **Career** card in the right rail: the same steps, read-only, with the count. |

## Behavior

- **Order and labels.** The API returns the steps in the fixed order `cv`, `github`, `linkedin`, `mock`, `apply`; labels and hints are translated by the frontend.
- **Ticking.** The checkbox flips at once and `PUT /me/career/{step}` saves it; on failure it flips back and a "Could not save" toast shows.
- **Missing endpoint.** `GET /me/career` failing (404, 403, 5xx; not 401) means "not available yet": `/career` shows "Coming soon" and the Home card is hidden. A 401 still ends the session.

## API

| UI call (Nitro) | API calls | Notes |
|---|---|---|
| `GET /api/dashboard/mentee` (`career`) | `GET /me/career` | `career` is `null` when the read fails |
| `PATCH /api/career/{id}` | `PUT /me/career/{step}` | Body `{ done }` |

## Acceptance criteria

- [ ] With the endpoint missing (404): `/career` shows "Coming soon", Home has no career card, nothing else breaks.
- [ ] Ticking a step persists across reload; unticking removes it.
- [ ] A failed save reverts the checkbox and shows the toast.
- [ ] Home card and `/career` show the same count.

## Known gaps

[O37](../open-items.md): the backend has no career steps yet. Mentor and head views of a student's progress wait for the optional `GET /users/{id}/career`.
