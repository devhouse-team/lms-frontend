# Program curriculum: length of each course

For the backend team. Tracked as [O33](../open-items.md). UI: [setup-flow](setup-flow.md), Program wizard, Schedule.

## Why

The schedule step draws a bar per course: from its start week to the week its last module opens. `ProgramCourseRead`
has `start_offset_days`, `modules` and `lessons`, but not when the modules open. The frontend now reads every course's
outline (`GET /courses/{id}`, one request per course) and takes the largest `release_offset_days`. That is one
extra request per course, and it fails for a head who cannot open a course in the editor.

The program already computes the same thing for the whole program: `weeks_of_content` in `program_read`
(`start_offset_days + release_offset_days`, maximum, `// 7 + 1`).

## Change

Add to `ProgramCourseRead`:

| Field | Type | Meaning |
|---|---|---|
| `content_weeks` | `int` | Cohort week (1-based) in which the course's last module opens, counted from the **course's own start**: `max(release_offset_days) // 7 + 1`. `0` if the course has no modules. |

In `curriculum()` (`src/modules/programs/service.py`), next to the `modules` count:

```python
select(CourseModule.course_id, func.max(CourseModule.release_offset_days))
.where(CourseModule.course_id.in_(course_ids))
.group_by(CourseModule.course_id)
```

`content_weeks = 0 if max is None else max // 7 + 1`. Regenerate `openapi.json`.

The program-level `weeks_of_content` does not change. It equals the largest
`(start_offset_days + max_release) // 7 + 1` over the courses.

## Frontend after it ships

`app/pages/create/program/[[id]].vue` (`lastRelease`, `lenOf`) uses `content_weeks` and drops the outline requests.
A bar spans `startWeek .. startWeek + content_weeks - 1` when the start is a week boundary.
