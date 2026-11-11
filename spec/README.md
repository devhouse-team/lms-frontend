# DevHouse LMS frontend spec

The living description of what the frontend **is**: which screens exist, what each one does, which API calls back it,
and the rules it enforces. The backend's counterpart is [`../../backend/spec/`](../../backend/spec/README.md); the API
contract is `../backend/openapi.json` (types in `shared/types/api.d.ts`).

| File | What it answers |
|---|---|
| [architecture.md](architecture.md) | How the app is built: Nitro as the API client (BFF), sessions, data mapping, config. |
| [features/](features/) | One file per feature: who uses it, screens, behavior, API calls, acceptance criteria. |
| [open-items.md](open-items.md) | Known gaps and decisions still to make, with owners. |
| [CHANGELOG.md](CHANGELOG.md) | What changed, when, and why. One entry per merged change. |

## Features

| Feature | Roles | Data |
|---|---|---|
| [Auth and roles](features/auth.md) | everyone | API |
| [Invites](features/invites.md): role invites; cohort (student) invites, preview, resend, revoke | head, program lead, invitee | API |
| [Password reset and email verification](features/account-recovery.md) | everyone | API |
| [Cohorts](features/cohorts.md) | head, mentor, student | API |
| [People](features/people.md): list and per-person profile | head | API |
| [My profile](features/profile.md): own account, name, username, password; account settings: change email, resend verification, log out everywhere | everyone | API |
| [Notifications](features/notifications.md): bell with unread count, panel, `/notifications`, email switches | everyone | API |
| [My grades](features/grades.md): `/grades`, per-course results and totals | student | API |
| [Programs](features/programs.md) | head, program lead; student and mentor read-only | API |
| [Assignments](features/assignments.md) | head, mentor, student | API |
| [Reviews](features/reviews.md) | mentor, student | API |
| [Course content](features/course-content.md) (spec, not built): course and lesson pages, materials, markdown with math and code, course editor, assignment modes, exams, solutions | everyone; course editors author | API |
| [Payments](features/payments.md): monthly billing per student, reminder 7 days before, block when overdue | head manages; student | API (backend pending) |
| [LeetCode contests](features/contests.md): register, results, attendance, LMS rating, profiles; superuser and LeetCode mentors manage | everyone; superuser and mentors manage | API (registration, results, mentors, rating: backend pending, [contests-api](features/contests-api.md), [leetcode-api](features/leetcode-api.md)) |
| [Career steps](features/career.md): five-step job-readiness checklist on `/career` and the Home rail | student | API (backend pending, O37) |
| [Career steps API](features/career-api.md): backend contract for career steps (O37) | backend team | API (backend pending) |
| [Mentoring sessions](features/sessions.md): mentor schedules, edits and cancels group and 1:1 sessions; students see them | mentor; student | API (backend pending, O38) |
| [Mentoring sessions API](features/sessions-api.md): backend contract for mentoring sessions (O38) | backend team | API (backend pending) |
| [Home dashboards](features/dashboards.md) | everyone | API |

## Spec-driven workflow

The spec leads, the code follows. For any change in behavior:

1. **Spec first.** Edit the feature file (or add one from [features/_template.md](features/_template.md)): the
   behavior, the API calls, and the acceptance criteria that will prove it. A new criterion is unchecked
   (`- [ ]`) until the code meets it. Open questions go to [open-items.md](open-items.md), not into the code.
2. **Check the contract.** Every call the feature needs must exist in `../backend/openapi.json`. If it doesn't,
   record the gap in open-items.md (and in the backend's `spec/open-items.md`) before building around it.
3. **Build** to the spec. Pages call `/api/*`; Nitro routes call the API through `server/utils/api.ts`.
4. **Verify** each acceptance criterion, then tick it: `npm run typecheck`, and against a local backend
   `python3 -I scripts/e2e-smoke.py` (see [architecture.md](architecture.md#verifying)).
5. **Record**: a [CHANGELOG.md](CHANGELOG.md) entry; close or add open items.

Review a PR against the spec diff first: if the spec didn't change, behavior shouldn't have either.
