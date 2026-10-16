# Changelog

Newest first. One entry per merged change: what changed, for whom, and anything to do.

## 2026-10-16: cohorts table fills its box

- Fixed: the cohorts table (head home and `/cohorts`) was narrower than its bordered wrapper, leaving a gap on the
  right. Still scrolls sideways on narrow screens.
- Cohorts without an end date show "week N" instead of "week N of 0"; the progress column is labelled "Lessons".
- All tables (cohorts, roster, people) fit their box: long names, emails and cohort lists truncate with the full
  text on hover; numbers are right-aligned; only the sorted column shows an arrow. On phones the roster and people
  tables fit without sideways scrolling (status and role move under the name, the roster's actions stay visible),
  and the cohorts table scrolls with the cohort name pinned.
- People: the filter tabs scroll on phones instead of cutting off the first one.

## 2026-10-15: account recovery

- Built [features/account-recovery.md](features/account-recovery.md): "Forgot password?" on the login page,
  `/forgot-password`, `/reset-password` and `/verify-email`, so the links the API emails now work (closes O8).
- Passwords are checked against the API's policy in the form on `/reset-password` and `/accept-invite` (8–128
  characters, upper and lower case, a digit, a special character); the API's own field message shows if it still refuses.
- New check: `scripts/e2e-recovery.py`.

## 2026-10-15: account recovery spec, invite username fix

- New spec [features/account-recovery.md](features/account-recovery.md): forgot password, `/reset-password`,
  `/verify-email`, with the API calls, error mapping and build steps.
- Fixed: the invite form accepted usernames the API refuses (uppercase, `.`, `-`, up to 40 characters), so they
  failed with a 422 after submitting. The form and the Nitro route now use the API's rule: 2–32 of `a–z 0–9 _`.

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
