# Changelog

Newest first. One entry per merged change: what changed, for whom, and anything to do.

## 2026-10-15: switch to the LMS API

- The app now uses `api.devhouse.kz` through Nitro (BFF) instead of the in-memory mock for auth, invites, cohorts,
  people, programs, assignments, reviews and dashboards. See [architecture.md](architecture.md).
- Login by email or username; view switcher for accounts with several views; Telegram and demo logins removed.
- Invites are emailed by the API and accepted at `/accept-invite?token=`; the old `/invite/[token]` page is gone.
- Assignments attach to lessons and are due N days after the lesson opens.
- Contests, external courses, career and sessions stay on the mock; only their pages show "Demo data".
- **To do on deploy:** set `NUXT_API_BASE` (defaults to production) and the production `NUXT_PUBLIC_ROLE_IDS_HEAD` /
  `NUXT_PUBLIC_ROLE_IDS_MENTOR` (O1).
- Spec-driven development starts here: this `spec/` folder.
