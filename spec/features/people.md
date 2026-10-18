# People

**Roles:** head · **Data:** API

Everyone with an account, their role and where they are, plus pending invites.

## Screens

| Route | Who | What it shows / does |
|---|---|---|
| `/people` | head | Tabs all / students / mentors / leadership with counts, search by name, email, username or cohort. Table: name + email, role ("not in a cohort" when none), cohort / program. Rail: pending and expired [invites](invites.md) of both kinds (role, or "Student · {cohort}"), with Resend / Revoke. "Invite" button (role invites; students are invited from the cohort). Names link to the profile. |
| `/people/{id}` | head | One person: avatar, name, email, username, derived role, admin and email-verified badges. "As a student": every cohort they were enrolled in (current first) with status, date of the last status change and, for current enrollments, their mentor. "As staff": cohorts where they are mentor or reviewer. Unknown, deactivated or non-numeric ids show "Person not found". |

## Behavior

The API's user list has no roles, so the UI derives one per person:

| Role | Rule |
|---|---|
| head | `is_superuser` |
| mentor | staff in any cohort |
| mentee | enrolled in any cohort; the active enrollment's cohort is shown |
| none | none of the above: shown as "not in a cohort" |

Deactivated accounts are hidden. Sorted head, mentor, mentee, none, then by name. Admins who aren't superusers show
as mentor/mentee/none (the API doesn't expose their roles: O6).

## API

| UI call (Nitro) | API calls | Notes |
|---|---|---|
| `GET /api/people` | `GET /users/` (all pages of 100), `GET /cohorts/`, per cohort `…/staff` + `…/enrollments`, `GET /invites/` (with cohort invites: `?kind=role` and `?kind=cohort`, see [invites](invites.md#api)) | Also feeds the mentor and student pickers |
| `GET /api/people/{id}` | `GET /users/` and the same cohort relations; per current enrollment `GET /cohorts/{id}/mentors` | The API has no user lookup by id, so the person is found in the list (404 when absent). Shared code: `server/utils/people.ts` |

## Acceptance criteria

- [x] The list includes newly accepted mentors and registered students with derived roles.
- [x] Pending invites appear in the rail; accepted ones don't.
- [ ] A name in the list opens `/people/{id}` with the right cohorts, statuses and mentor; a mentor or student gets 403 there; `/people/invite` still opens the invite form. (Typechecked; not yet run against a backend.)

## Known gaps

[O6](../open-items.md) roles in the user list
