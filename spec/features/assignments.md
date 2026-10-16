# Assignments

**Roles:** head and course editors (author), mentor (read), student (submit) · **Data:** API

Graded practice. Follows the API model (backend decision D2): an assignment belongs to a **lesson** of a course, and
is due a number of days after that lesson opens for the cohort.

> **Course content v2 (spec, not built):** [course-content.md](course-content.md) replaces this model in phases.
> Phase 1: the submit form takes files, a markdown note and links (the link is no longer required); history and the
> instructions render as markdown; assignments are also created from the course editor (`/editor/[courseId]`).
> Phase 2: several assignments per lesson, modes `homework` / `exam` (time window, one attempt, trial attempt) /
> `practice` (unlimited, solution after the first attempt), accepted formats and limits, solutions with release
> rules, a new page `/assignments/[cohortId]/[assignmentId]` (old `[c]-[l]` links redirect), an assignment editor page
> instead of the modal, and `GET /cohorts/{c}/assignments` (closes O7). The singular endpoints this page uses today
> (`/lessons/{l}/assignment`, `/cohorts/{c}/lessons/{l}/assignment`, `…/lessons/{l}/submissions`) keep working until
> Phase 2, which deploys together with the backend release that removes them. This file describes what is built today.

## Screens

| Route | Who | What it shows / does |
|---|---|---|
| Cohort page, "Assignments" section | head, mentor | Each assignment: title, lesson, due date for this cohort (or "no deadline"), submission count. Add / edit / delete only with `course.update`. |
| Assignment modal | course editors | Lesson (only lessons without an assignment; fixed when editing), title, instructions, due offset in days (empty = no deadline). With no free lessons: explains that assignments attach to the cohort's course lessons. |
| `/assignments` | student | Open and accepted groups: title, status, time left or due date. |
| `/assignments/[cohortId-lessonId]` | student | Status, title, instructions; submit form (link + note) when not submitted or sent back; "waiting for review" otherwise; history with feedback; due date; reviewer. |

## Behavior

- **Due date** for a cohort = lesson release day + offset; a due day ends at 23:59:59 UTC (backend D5). The API
  computes it (`due_on`).
- **Status** maps from the latest submission: none → not submitted, `submitted` → waiting, `changes_requested` →
  changes, `approved` → accepted. Students see assignments of opened lessons in their active cohorts only.
- **Submitting** sends the link as `links[0]` and the note as `body`; no files yet (the API supports uploads).
  A second submission while one waits is a conflict.
- Editing replaces the whole assignment. An assignment belongs to the course, so a change shows in every cohort
  using that course.
- **Delete is refused while any cohort has submissions on it** (409 "has submissions"): the API would delete the
  submissions too (O4).
- Mentors read assignments through the cohort-scoped endpoint; the staff endpoint needs `course.update`.

## API

| UI call (Nitro) | API calls | Notes |
|---|---|---|
| part of `GET /api/cohorts/[id]` | `…/courses`, `…/courses/{c}/outline`, per lesson `GET /cohorts/{c}/lessons/{l}/assignment` | O7 |
| `POST /api/assignments {lessonId, title, description, dueOffsetDays}` | `PUT /lessons/{l}/assignment` | |
| `PATCH /api/assignments/[lessonId]` | `PUT /lessons/{l}/assignment` | |
| `DELETE /api/assignments/[lessonId]` | `GET /lessons/{l}/assignment`, per cohort × status `GET …/submissions?assignment_id`, then `DELETE /lessons/{l}/assignment` | Guard |
| `GET /api/assignments` | `/me/access`, per active cohort the outline walk + `GET /cohorts/{c}/lessons/{l}/assignment` | |
| `GET /api/assignments/[id]` | `GET /cohorts/{c}/lessons/{l}/assignment`, `GET /cohorts/{c}`, `…/staff`, `…/mentors` | |
| `POST /api/assignments/[id]/submissions {url, note}` | `POST /cohorts/{c}/lessons/{l}/submissions` | |

## Acceptance criteria

- [x] Head attaches an assignment to a lesson; it shows with a due date and the lesson is no longer free.
- [x] Editing to "no deadline" works; the student sees no due date.
- [x] The student sees the assignment as not submitted, submits a link and note, and a second submit is refused.
- [x] After "changes requested" the student sees the feedback and reviewer and can resubmit; after approval it's accepted.
- [x] Mentors see assignments without edit controls.
- [x] Deleting an assignment with submissions is refused.
- [ ] Deleting an assignment without submissions removes it.

## Known gaps

[O4](../open-items.md) delete cascade · [O7](../open-items.md) per-lesson calls (course content Phase 2) · O10 course
authoring UI and file uploads in submissions (course content Phase 1)
