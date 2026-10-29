# Setup flow: create wizards

Step-by-step creation of a program, a cohort and a course, for heads. Prototype: `public/mockups/setup-flow/` (branch
`mockup/setup-flow`). Built in stages; each is its own change.

| Stage | What | State |
|---|---|---|
| 0 | `WizardShell`, `/create` hub (chain checklist 2026-10-28) | built 2026-10-27 |
| 1 | Program wizard | built 2026-10-27 |
| 2 | Cohort wizard | built 2026-10-28 |
| 3 | Course wizard (manual structure) | built 2026-10-28 |
| 4 | Course plan import | frontend built 2026-10-28; waits for the API ([O32](../open-items.md)) |

## Rules

- **Create early.** The entity is created as a draft as soon as its first step is valid. Later steps edit it with the
  calls the existing pages use. The id is in the URL, so a reload resumes; nothing lives only in the browser.
- **Pages, not modals.** "Create" buttons lead to the wizards. The create/edit modals stay for editing.
- **Locked steps follow the entity.** Without an id only step 1 exists. A program that is no longer a draft redirects
  to its page (the done screen, step 5, is only for an active program).
- Wording follows the app: "cohort" (the prototype says "поток").

## Shell

`WizardShell`: step rail on `md+` (done ✓, current `aria-current="step"`, steps past `reach` are not links), a "Step n of
N: name" line below `md`. Route is `base?step=n`. `current` above the step count is the done screen.

## Hub: `/create`

Head only, also in the nav ("Create"). Cards: Program, Course, Cohort, each to its wizard. A recommendation follows the
chain: no program → create one; no courses → add them (an empty draft opens at its courses step); no active program →
activation step of a draft; no cohort → cohort wizard; no students → `/cohorts`. Below it the "All at once" checklist
(program, courses, cohort, people): done / locked-with-reason / open. Everything is read off `/api/programs`
(`courseCount`, `cohortCounts`, `activeStudents`): no extra requests.

## Program wizard: `/create/program[/:id]?step=1..5`

| Step | Fields / UI | Calls |
|---|---|---|
| 1 Basics | title, slug (follows title), duration weeks 1-104, description (markdown). Cover and lead stay in the edit modal. Revisiting edits the draft. | `POST /api/programs`, then `PATCH /api/programs/{id}` with changed fields |
| 2 Courses | searchable checklist of `course-options`; ticking adds the course after the last content, unticking removes it | `PUT` / `DELETE /api/programs/{id}/courses/{course}` |
| 3 Schedule | `CurriculumTimeline`: one row per course with an editable start week (saved after a short pause), up / down, and a bar on the week grid (flagged past the program length); "Place one after another"; longer / shorter warning | `PUT .../courses/{course}`, `PUT .../courses/order` |
| 4 Activation | warnings, none blocks: no courses, unpublished course, course without modules, content longer than the program. Activate or keep the draft. | `POST /api/programs/{id}/activate` |
| 5 Done | open the program, create something else | |

A bar runs from the start week to the week the course's last module opens, read from each course's outline
(`/api/editor/courses/{id}`). A course whose outline can't be read, or without modules, counts a week per module. The API
has no per-course length: [program-course-weeks-api](program-course-weeks-api.md) asks for one. The start is a week;
the program page's popover is week-only as well (a start that is not a week boundary keeps its day until changed).

Errors: `slug_taken` on the slug field, everything else through `useProgramErrors`.

## Cohort wizard: `/create/cohort[/:id]?step=1..6`

`?program=` preselects the program. Without an id only steps 1-2 exist; with one, steps 2-6. A finished cohort
redirects to its page (a started cohort is still wizard material: team and students make sense once it runs).

| Step | Fields / UI | Calls |
|---|---|---|
| 1 Program | active programs only (`/api/programs/options`); none → link to the program wizard | |
| 2 Dates | name (defaults to "program · start" until typed), start, end (computed from the program length, read-only), timezone. Creates the cohort. Revisiting edits it; start and timezone are locked once it has started. | `POST /api/cohorts`, then `PATCH /api/cohorts/{id}` with changed fields |
| 3 Plan | start, end, item and exam counts; the cohort calendar by week; exam windows. "Left out of the plan" lists why items are missing: no courses, a course not published, a course without a published lesson (a module reaches the calendar only with one), each with a link to the fix | `GET /api/calendar?cohort=`, `GET /api/cohorts/{id}/courses`, `CohortExamWindows` |
| 4 Team | `CohortStaff`; next needs a mentor | |
| 5 Students | `AddStudentsPanel` (one person, emails, CSV); "assign automatically" runs once on finish | `POST /api/cohorts/{id}/mentors/auto` |
| 6 Done | open the cohort, create something else | |

Errors: `cohort_name_taken` on the name, `cohort_started` and `cohort_ends_in_past` on the start date, the rest through
`useCohortErrors`. The calendar leaves out unpublished courses (the step says so).

## Course wizard: `/create/course[/:id]?step=1..6`

Anyone who may create courses (`course.create`), not only heads; the editor API decides. One page instance per course.
`?return=/create/program/:id` (only that shape is accepted) adds the course to the program from the done screen.
Steps 2-4 render `EditorOutline` with `focus="structure" | "materials" | "assignments"`: the same component and calls
as the course editor, showing one part. `stay` keeps a new assignment in the wizard instead of opening its editor.
Material and assignment editors opened from these steps get `?back=<wizard step>` and their back link returns there
(only `/create/course/…` is accepted).

| Step | UI | Calls |
|---|---|---|
| 1 Basics | title, slug (follows title), description. Creates the course as a draft; revisiting edits it. | `POST /api/editor/courses`, `PATCH courses/{id}` |
| 2 Structure | course pages, modules (release day offset), lessons, reorder. Next needs a lesson. | editor allowlist |
| 3 Materials | each lesson open with its materials: add by kind, publish, reorder, delete. A module without lessons says so and offers "Add lesson" (steps 3-4 only; the rest of the structure is edited in step 2) | editor allowlist |
| 4 Assignments | each lesson with its assignments; templates fill mode, timing and file limit (`assignmentTemplates.ts`) | editor allowlist |
| 5 Publish | stats; checklist (`courseReview.ts`, only an empty course blocks); "publish everything"; sample lesson; editors; draft or publish | `PATCH` lessons / materials / assignments, `PATCH courses/{id}` |
| 6 Done | with `?return=`: add to the program (after its last content) and go back; else build a program, open the editor, create another | `PUT /api/programs/{p}/courses/{id}` |

Differences from the prototype: module release is entered as a week (stored as `release_offset_days` = (week - 1) × 7;
an old value that is not a whole week shows as "week 2, day 3" and is kept until changed); the sample
lesson is a list of titles, not a student view (no cohort-less preview exists); solutions are attached in the
assignment editor.

## Plan import (course wizard, structure step)

Second tab "Import from file" next to the manual outline (`CoursePlanImport`). Format Markdown, CSV or JSON, pasted or
uploaded, with a sample.

1. **Check**: `app/utils/planImport.ts` parses the text into a tree. Syntax problems are found in the browser (lines that
   belong to no lesson, unknown type, missing titles). Without errors, the tree goes to the API as a dry run.
2. **Preview**: counts of what would be created, and every issue with its place ("Module › Lesson › item 3"). The
   issue `code` is translated under `wizard.course.import.issue`; unknown codes show the API's `message`.
3. **Apply**: append to the end, or replace the structure. Errors block the button. Imported content is unpublished;
   the last wizard step publishes. After applying the tab returns to the outline.

The API contract is [plan-import-api](plan-import-api.md). Until the endpoint exists, Check shows the local preview and a
notice that the server cannot check plans, and Apply stays off. Module release days are chosen by the API (7 days
apart); the prototype's weeks and per-item tags are not imported.
