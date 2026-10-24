# Mock features

**Roles:** everyone · **Data:** in-memory mock (`server/utils/db.ts`)

Features the product needs but the API doesn't have yet. They run on the mock, keyed by the real user id. Their pages
carry the "Demo data" badge. State resets on restart and is not shared between server instances (so on Vercel it
can vanish between requests).

| Feature | Screens | Mock routes | Backend status |
|---|---|---|---|
| LeetCode contests | `/contest` (student), home rail (`/contests` for head is live on API `/contest`) | `GET /api/contests`, `POST /api/contest/registration` | Phase 4 (E11) |
| Career steps | `/career`, home rail | `PATCH /api/career/[id]` | Not planned |
| Mentoring sessions | `/sessions` (mentor), `/mentor` (student), rails | `GET /api/sessions`; inside `/api/mentor/profile` and dashboards | S7.3, S7.4 |

`/mentor` (student) mixes both: the mentor comes from the API, the sessions from the mock (none for real users).

## Moving one to the API

1. Rewrite this feature's section as its own feature file with the real API calls (spec first).
2. Replace the mock routes with API-backed ones; keep the view model if the screens don't change.
3. Drop the `mock` flag from its pages and its data from `db.ts`.
