# DevHouse LMS frontend spec

The living description of what the frontend **is**: which screens exist, what each one does, which API calls back it,
and the rules it enforces. The backend's counterpart is [`../../backend/spec/`](../../backend/spec/README.md); the API
contract is `../backend/openapi.json` (types in `shared/types/api.d.ts`).

| File | What it answers |
|---|---|
| [architecture.md](architecture.md) | How the app is built: Nitro as the API client (BFF), sessions, data mapping, the remaining mock, config. |
| [features/](features/) | One file per feature: who uses it, screens, behavior, API calls, acceptance criteria. |
| [open-items.md](open-items.md) | Known gaps and decisions still to make, with owners. |
| [CHANGELOG.md](CHANGELOG.md) | What changed, when, and why. One entry per merged change. |

## Features

| Feature | Roles | Data |
|---|---|---|
| [Auth and roles](features/auth.md) | everyone | API |
| [Invites](features/invites.md) | head, invitee | API |
| [Password reset and email verification](features/account-recovery.md) | everyone | API |
| [Cohorts](features/cohorts.md) | head, mentor | API |
| [People](features/people.md) | head | API |
| [Programs](features/programs.md) | head | API + static syllabus |
| [Assignments](features/assignments.md) | head, mentor, student | API |
| [Reviews](features/reviews.md) | mentor, student | API |
| [Home dashboards](features/dashboards.md) | everyone | API + mock widgets |
| [Mock features](features/mock-features.md): contests, external courses, career, sessions | everyone | in-memory mock |

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
