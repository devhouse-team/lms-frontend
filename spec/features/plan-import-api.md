# Course plan import: what the frontend needs from the API

For the backend team. The frontend parses Markdown, CSV or JSON in the browser (`app/utils/planImport.ts`) and sends the
result as one tree. Tracked as [O32](../open-items.md). UI: [setup-flow](setup-flow.md#stage-4-plan-import).

## Endpoint

`POST /courses/{course_id}/import`. Same permission as the other authoring calls (`can_edit_course`: 404 if the course
isn't visible, then 403). The frontend reaches it through its editor allowlist as `POST /api/editor/courses/{id}/import`.

### Request

```json
{
  "mode": "append",
  "dry_run": true,
  "modules": [
    {
      "title": "Basics",
      "release_offset_days": 0,
      "lessons": [
        {
          "title": "Variables",
          "items": [
            { "type": "video", "title": "Intro", "url": "https://www.youtube.com/watch?v=abc" },
            { "type": "pdf", "title": "Cheat sheet", "url": "https://example.com/a.pdf" },
            { "type": "link", "title": "Docs", "url": "https://docs.python.org" },
            { "type": "task", "title": "Homework 1" }
          ]
        }
      ]
    }
  ]
}
```

- `mode`: `append` (default) or `replace`.
- `dry_run`: default `false`. When `true` nothing is written.
- `release_offset_days` is optional (≥ 0). When missing: after the last existing module + 7 days for `append`, `i * 7`
  for `replace`, counting from the module's own position in the request.
- Do not 422 the whole request over content problems (empty titles, bad URLs, too long). Those are `issues` below, so
  the preview can show every one at once. Keep the schema permissive: strings with only a generous `max_length`. Only
  structural problems (not JSON, wrong types, more than 100 modules, 200 lessons per module, 100 items per lesson) are 422.

### What is created

| `type` | Creates | Notes |
|---|---|---|
| `video` | `video` material | URL must pass `video.embed_url` |
| `link` | `link` material | `http(s)` URL |
| `pdf` | `link` material | A PDF material needs an uploaded file, so a PDF URL becomes a link. Warning `pdf_as_link`. |
| `task` | `homework` assignment | `due_offset_days: 7`, accepts text, links and files, `max_files: 10`, no attachments |

Everything is created **unpublished** (lessons, materials, assignments). The wizard's last step publishes. An item
without a title takes its URL (warning `title_from_url`).

### Response (200)

```json
{
  "applied": false,
  "counts": { "modules": 1, "lessons": 1, "materials": 3, "assignments": 1 },
  "issues": [
    { "path": "modules[0].lessons[0].items[1]", "severity": "error", "code": "bad_url", "message": "A link needs an http(s) URL" }
  ]
}
```

- `applied` is `true` only for a real run (`dry_run: false`) that wrote everything. A real run with at least one
  `error` writes nothing and returns `applied: false` with the issues.
- `counts` are what the request would create, also for a dry run.
- `path` is `modules[i]` / `modules[i].lessons[j]` / `modules[i].lessons[j].items[k]` (zero-based, request order).
- `severity`: `error` blocks, `warning` does not.
- `code` is stable (the frontend translates it; `message` is a fallback in English). Suggested: `title_required`,
  `title_too_long` (200), `bad_url`, `video_host_not_allowed`, `too_many_materials` (50 per lesson),
  `too_many_assignments` (10 per lesson), `empty_module`, `empty_lesson`, `pdf_as_link`, `title_from_url`.
- A dry run must give the same issues as the real run would.

### One transaction

Validate everything first, then write all modules, lessons, materials and assignments in a single transaction, with a
single `commit`. A failure leaves the course untouched. Record one audit entry (`course.import`, counts and mode).
Do not call the per-item `create_*` services: they commit one by one. Share their checks (`materials._check_url`
and the like) rather than copying them.

### `replace`

Deletes the course's modules (lessons, materials and assignments go with them) and then creates the new ones, in the
same transaction. Refuse it, with a 422 error envelope (not an `issue`), when:

- an assignment in the course has submissions: `content_has_submissions` (existing code), or
- an unfinished cohort teaches the course (`cohort_count > 0` in the outline): a new code, e.g. `import_replace_blocked`.
  Content is live in running cohorts, so replacing it would pull lessons away from students.

Course pages (materials without a lesson) are not touched.

## Tests the frontend relies on

- dry run writes nothing and reports the same issues as the real run;
- a real run with an error writes nothing;
- `append` keeps existing modules and numbers new positions after them;
- `replace` is blocked by submissions and by a running cohort, allowed for a draft course;
- everything created is unpublished;
- limits: 50 materials and 10 assignments per lesson are issues, not 500s;
- a non-editor gets 404 or 403 like the other authoring calls.

## After it ships

Regenerate `openapi.json`; the frontend then runs `npm run api:types`. The frontend defines its own request and response
types until then.
