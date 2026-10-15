# Programs

**Roles:** head · **Data:** API + static syllabus

## Screens

| Route | Who | What it shows / does |
|---|---|---|
| `/programs` | head | Expandable list: program title, module count, cohort count. Expanded: modules in order, cohorts with student count and mentor. |

## Behavior

- Programs and cohorts come from the API. Modules come from `server/data/programs.ts`, matched by program `slug`
  (`frontend`, `backend`, `mobile`, `ml`, `algorithms`); other slugs show "no modules recorded".
- Read-only: creating or editing programs isn't built (the API supports it).

## API

| UI call (Nitro) | API calls | Notes |
|---|---|---|
| `GET /api/programs` | `GET /programs/`, `GET /cohorts/`, per cohort `…/staff` | Also feeds the cohort form's program picker |

## Acceptance criteria

- [x] A program created on the API is listed and selectable when creating a cohort.

## Known gaps

Program editing UI; syllabus not in the API.
