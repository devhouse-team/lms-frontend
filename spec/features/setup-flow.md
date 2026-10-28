# Setup flow: create wizards

Step-by-step creation of a program, a cohort and a course, for heads. Prototype: `public/mockups/setup-flow/` (branch
`mockup/setup-flow`). Built in stages; each is its own change.

| Stage | What | State |
|---|---|---|
| 0 | `WizardShell`, `/create` hub | built 2026-10-27 |
| 1 | Program wizard | built 2026-10-27 |
| 2 | Cohort wizard | planned |
| 3 | Course wizard (manual structure) | planned |
| 4 | Course plan import | blocked on the backend ([O32](../open-items.md)) |

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

Head only. Cards: Program (wizard), Course (`/courses`), Cohort (`/cohorts`) until their wizards exist. A recommendation
shows when there is no program yet.

## Program wizard: `/create/program[/:id]?step=1..5`

| Step | Fields / UI | Calls |
|---|---|---|
| 1 Basics | title, slug (follows title), duration weeks 1-104, description (markdown). Cover and lead stay in the edit modal. Revisiting edits the draft. | `POST /api/programs`, then `PATCH /api/programs/{id}` with changed fields |
| 2 Courses | searchable checklist of `course-options`; ticking adds the course after the last content, unticking removes it | `PUT` / `DELETE /api/programs/{id}/courses/{course}` |
| 3 Schedule | `CurriculumTimeline` (bars on a week grid, flagged past the program length); "Place one after another"; `ProgramCurriculum` for order, start week, remove | `PUT .../courses/{course}`, `PUT .../courses/order` |
| 4 Activation | warnings, none blocks: no courses, unpublished course, course without modules, content longer than the program. Activate or keep the draft. | `POST /api/programs/{id}/activate` |
| 5 Done | open the program, create something else | |

Course length on the timeline is its module count (min 1), as one week per module. The API has no per-course length;
`weeksOfContent` only covers the whole program.

Errors: `slug_taken` on the slug field, everything else through `useProgramErrors`.

## Stage 2: cohort wizard (planned)

Program (active only, `?program=` preselects) → dates (name, start, computed end, timezone; the cohort is created here
and takes the curriculum snapshot) → plan (real dates from the cohort calendar, exam window overrides) → team (staff)
→ students (email list, CSV, invites; mentor auto-assign). Reuse `AddStudentsModal` tabs, `CohortStaff`,
`CohortExamWindows`.

## Stage 3: course wizard (planned)

Basics → structure (modules with release week, lessons, course pages) → materials → assignments (templates, max 10 per
lesson) → publish (checklist, student preview). Goes through `useCourseEditor` and the editor allowlist. Returning to a
program wizard: `?return=`.

## Stage 4: plan import

Needs a backend endpoint that takes a parsed tree (see O32). The parsers (Markdown, CSV, JSON) and the validation rules
are in the prototype's `app.js`.
