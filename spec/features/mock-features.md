# Mock features

**Roles:** everyone · **Data:** in-memory mock (none left)

Features the product needs but the API doesn't have yet. They run on the mock, keyed by the real user id. Their pages
carry the "Demo data" badge. State resets on restart and is not shared between server instances (so on Vercel it
can vanish between requests).

| Feature | Screens | Mock routes | Backend status |
|---|---|---|---|

## Moving one to the API

1. Rewrite this feature's section as its own feature file with the real API calls (spec first).
2. Replace the mock routes with API-backed ones; keep the view model if the screens don't change.
3. Drop the `mock` flag from its pages and its data from `db.ts`.
