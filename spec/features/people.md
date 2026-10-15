# People

**Roles:** head · **Data:** API

Everyone with an account, their role and where they are, plus pending invites.

## Screens

| Route | Who | What it shows / does |
|---|---|---|
| `/people` | head | Tabs all / students / mentors / leadership with counts, search by name, email, username or cohort. Table: name + email, role ("not in a cohort" when none), cohort / program. Rail: pending [invites](invites.md). "Invite" button. |

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
| `GET /api/people` | `GET /users/` (all pages of 100), `GET /cohorts/`, per cohort `…/staff` + `…/enrollments`, `GET /invites/` | Also feeds the mentor and student pickers |

## Acceptance criteria

- [x] The list includes newly accepted mentors and registered students with derived roles.
- [x] Pending invites appear in the rail; accepted ones don't.

## Known gaps

[O6](../open-items.md) roles in the user list
