# Open items

Known gaps and undecided questions. Backend items are mirrored in `../backend/spec/open-items.md`.

| # | Item | Owner | Blocks | Notes |
|---|---|---|---|---|
| O1 | Production role ids for `admin` and `mentor` | BE | Invites in prod | No roles endpoint; ids are per database (local had 3/4). Set `NUXT_PUBLIC_ROLE_IDS_*`, or BE adds `GET /roles`. |
| O2 | No student role to invite with | PO + BE | Student onboarding | Student invites are disabled. Students need an account another way, then the head enrolls them. Related to backend D4. |
| O3 | Login lockout and registration limits per IP see Vercel's IP | BE + Ops | Pilot at scale | Nitro sends `X-Forwarded-For`; the API must trust it (`TRUSTED_PROXY_HOPS`) and be reachable only via trusted proxies. Backend D1. |
| O4 | Deleting an assignment deletes its submissions | BE | | The frontend refuses while submissions exist; the API should too. |
| O5 | Invites: no preview, copy-link or revoke | BE | | The token is only in the email. |
| O6 | `GET /users/` has no roles | BE | | People roles are derived from cohort relations; non-superuser admins can't be shown as head. |
| O7 | One API call per lesson to find assignments | BE | Large cohorts | Ask for `GET /cohorts/{c}/assignments`. |
| O8 | `/verify-email` and `/reset-password` pages | FE | Password reset | The API emails links to them. No "forgot password" on the login page yet. |
| O9 | At-risk rule is a placeholder | PO | | Active, 3+ lessons opened, under half completed. |
| O10 | No course authoring UI | FE + PO | Assignments | Courses, modules, lessons and attaching courses to cohorts are API-only for now. |
| O11 | Staff can't see earlier submission attempts | BE | | Review detail shows no history. |
| O12 | Mock features lose state on Vercel | FE | | See [mock features](features/mock-features.md). |
| O13 | One mentor per cohort in the UI | PO | | The API supports several mentors and reviewers and a mentor per student. |
| O14 | Notification links point at paths that don't exist | FE + BE | Notifications | Backend sends `/mentor/submissions/{id}`, `/app/cohorts/…`; the app has `/reviews/{id}`, `/assignments/{c}-{l}`. No notifications UI yet. |
