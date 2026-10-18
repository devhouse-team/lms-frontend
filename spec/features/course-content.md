# Course content

**Roles:** student (reads, submits), mentor and reviewer (read their cohorts' courses, review), course editors (author),
head and program lead (author, assign editors, release solutions) · **Data:** API

The LMS hosts the course itself, the way MIT OpenCourseWare does: a course page with a contents sidebar, one page per
lesson (session) with its materials in order (notes, slides, video, readings, code, practice, solutions), a "by type"
index and a calendar. On top of what OCW has, dev.house adds what a cohort needs: release dates, deadlines, progress,
submissions with files, exams in a time window, solutions that open at the right moment, and mentor review. Success:
a student reads, watches and submits everything for a week without leaving the LMS; an editor builds a lesson with
math, code, a PDF and a video in one sitting; nothing on these pages contradicts what the API will accept.

Status: **Phases 1, 2 and 3 built** (Phases 1–2 2026-10-17, Phase 3 2026-10-18; course content v2, 2026-10-16). Decisions: product owner 2026-10-16 (PO1–PO6 below) and
the defaults in the decisions doc (D-…). Contract: `../backend/spec/content.md` and `../backend/openapi.json`
(`npm run api:types`). Endpoint, field and error-code names below are **exactly those of backend spec/content.md**
(reconciled 2026-10-16); the generated types win and this file gets corrected where they differ.

Built in three phases ([Phased plan](#phased-plan), same boundaries as the backend): 1 materials and reading +
homework with files + editor; 2 assignment modes, exams, practice, trial attempt, solutions (needs D5's cohort
timezone decided first; deployed together with backend P2); 3 by-type view, calendar, prev / next, course search.

### Phase 1 as built

Differences from the text below (the code follows these):

- **Uploads send `purpose` everywhere**, program covers included (`cover`), so the backend can make the field
  required. `useStorageUpload().upload(file, purpose)`; `POST /api/files {filename, size, purpose}` derives the type from
  the extension (`shared/utils/fileTypes.ts`) and checks the purpose's limits before calling the API.
- **Authoring goes through one allowlisted proxy**, `server/api/editor/[...path].ts`: the editor pages work on the
  API's own authoring shapes (`CourseOutline`, `MaterialRead`, …, snake_case) instead of mapped view models. Every
  path and method is allowlisted; the API decides permissions and validates bodies. Same URLs as the API table.
- **Raw HTML in markdown shows as text** (backend markdown contract: `html: false`), and DOMPurify still runs over the
  output. Relative image paths render nothing (only `https:` and `file:` resolve).
- **Files attach at once** in the material editor (each upload or removal is a `PATCH {file_ids}`), so the preview's
  `file:` images resolve before Save; Save covers title, tags, body, URL and published.
- Not built in Phase 1: the sticky bottom "Contents" bar on phones (the header has the Contents button), preview
  scroll sync, remembering open modules in `sessionStorage` (Phase 3 sidebar polish), a separate assignment editor
  (the modal is reused, with a markdown statement).
- `apiError()` is null-safe (pages pass `error.value` directly).
- Review fixes (2026-10-17): the material editor keeps attached files in their own state, so attaching never resets
  unsaved text, and file-list PATCHes run one at a time (several pasted images all stay attached); pasting several
  images inserts all placeholders at once. Videos embed through `VideoEmbed` (sandboxed iframe, host allowlist
  `isEmbedUrl`, lazy, also in previews). Markdown images accept only `https:` and our exact file routes; links accept
  http(s), mailto, `#` and those routes. `MarkdownView` drops stale renders and falls back to plain text when a
  renderer chunk can't load.

### Phase 2 as built

Differences from the text below (the code follows these):

- **Every Nitro route is off the singular assignment endpoints** (grep finds no `/lessons/{l}/assignment`,
  `/cohorts/{c}/lessons/{l}/assignment` or `/cohorts/{c}/lessons/{l}/submissions`); the backend can drop them in the
  coordinated release. `AssignmentFormModal`, `AssignmentsManager` and the `/api/assignments` POST/PATCH/DELETE routes
  are gone; assignments are authored only in the course editor.
- The cohort page and `/cohort` list the cohort's assignments read-only (`CohortAssignments`), then "Exam windows"
  (`CohortExamWindows`) and "Solutions" (`CohortSolutions`). The exam list comes from the cohort detail (one
  `GET /cohorts/{c}/assignments`), so there is no separate `GET /api/cohorts/[id]/exams`. Window actions show on the
  head / lead cohort page; mentors see windows read-only; solution actions follow `can_release`.
- Old links: `/assignments/{c}-{l}` is a page that asks `GET /api/assignments/resolve/[key]` and replaces the URL.
- Times: exam windows format in the cohort's zone (`app/utils/zonedTime.ts` converts the override's cohort-local
  inputs to UTC); due days format in UTC (D5); countdowns, "your time" and local submission times render after mount
  (`useServerClock`, `ClientOnly`), so a viewer in another zone gets no hydration mismatch.
- Statement attachments attach at once in the assignment editor (as material files). The material editor gains
  "Solution of" and "Opens" (release), with the rules the API would refuse disabled and a default rule picked when
  the link changes.
- Practice sends with "Send attempt" and toasts "Attempt sent"; its page shows "Sent" / "Commented" instead of a
  status badge.
- Exam closing: a send or upload still running at `closes_at` keeps the form mounted (`SubmitForm` emits `busy`) and
  holds off "missed" until it lands; the page refetches at `closes_at` and again 2 min 5 s later. An open exam the
  student can't send to (paused enrollment, `can_submit: false`) shows a notice. On `/assignments` an exam missed
  after the grace moves to its own "Missed" group.
- Scores are whole numbers (max score from 1, a review score from 0 to the max).
- `scripts/zoned-time.check.ts` checks the zone conversions (Almaty, Berlin spring gap and autumn overlap):
  `node --experimental-strip-types scripts/zoned-time.check.ts`.

### Phase 3 as built

Differences from the text below (the code follows these):

- **Materials by type** loads the course's list once (`GET /api/courses/[c]/[course]/materials`, key
  `course-materials:<c>:<course>:all`) and filters by `?tag=` on the page; the API's `tag` filter isn't used. Rows
  carry no file metadata (`MaterialByType` has none), so there is no size or Download column: the material title
  links to its anchor on the lesson (`#m-<id>`) or to the course page, and the lesson title to the lesson. Staff see
  locked rows as links (they read ahead); students see them muted with the lock text (`useLockText`, shared with
  `MaterialBlock`).
- **Calendar** columns are **Opens** (module openings and after-due solution releases), **Due** and **Exams**.
  The API's calendar is cohort-wide (backend decision 30), so Due shows no status badge. Due and exam items link to
  the assignment page for students and to the lesson for staff; module openings link to the course. Items of a
  course that isn't published are left out (as on `/courses`). The current week is a raised row with a "This week"
  chip, not a yellow left rule (DESIGN bans side stripes); "Jump to this week" is the Today link. Without
  `?cohort=` the calendar opens my first current cohort (active, then planned); the switcher lists my current cohorts.
- **Prev / next** come from the lesson view's `prev` / `next` (no extra call). A locked neighbour shows its title and
  "Opens {date}" without a link for students. Course pages walk among the pages the reader can open (from the shared
  outline). `CoursePager` renders the pair at the end of the column from `md`, and below `md` a sticky bottom bar
  (previous, "Contents", next) in the panel footer, which replaces the header's Contents button there.
- **Search**: inside `/courses/[c]/[course]/…` the ⌘K palette adds an "In this course" group from
  `GET /api/courses/[c]/[course]/search?q=` (250 ms debounce, 2+ characters, stale answers dropped, not run through
  the palette's local filter). Material hits open the lesson at the material's anchor; assignment hits open the
  assignment page for students and the lesson for staff. Snippets are the API's raw text.
- **Sidebar**: footer links "Materials by type" and "Calendar" (`/calendar?cohort=<c>`); opened / closed modules are
  kept in `sessionStorage` per course (`course-open:<course>`), and the current lesson's module always opens.
- Nav item "Calendar" (`/calendar`) for students and mentors; heads open a cohort's calendar from its course sidebar.

## Decisions this spec relies on

| # | Decision | Source |
|---|---|---|
| PO1 | The LMS hosts course content. PRODUCT.md and DESIGN.md change accordingly (course and lesson pages allowed, same design language). | PO |
| PO2 | Authors are **course editors**, assigned per course by the head. A program lead is automatically an editor of the courses in their programs' curricula. `course.update` holders edit everything. Only `course.create`/`course.update` create courses and assign editors. | PO |
| PO3 | Video is **embed only**: YouTube (incl. unlisted), Vimeo, Google Drive, Loom. No upload. Captions or a transcript are an attached file or markdown. | PO |
| PO4 | Solutions: release `with_lesson` \| `after_due` (default for solutions: the day after the cohort's due date) \| `manual` (staff release per cohort). Backend detail: solutions use `after_due`, `after_submit` (practice) or `manual`, never `with_lesson`; per-cohort release by course editors and cohort managers. | PO, backend content.md |
| PO5 | One assignment model with modes `homework`, `exam`, `practice`; optional trial attempt for exams; accepted formats (files, text, links) with limits per assignment. | PO |
| PO6 | Markdown everywhere (lessons, statements, submissions, feedback, descriptions) with KaTeX math, highlighted fenced code, tables, images; editors write in an editor or upload a `.md`. | PO |
| D-lesson | A lesson is a session page holding an ordered list of **materials**: `markdown` (≤ 200 000 chars), `pdf`, `video`, `file`, `link`, `image`. Each has `title`, `kind`, `tags[]` (fixed enum), `position`, `is_published`, `release`. Existing lesson content becomes the first material. | decisions doc |
| D-pages | Course-level pages (syllabus, about, grading, resources) are materials on the course (no module), listed at the top of the sidebar. | decisions doc |
| D-many | Several assignments per lesson (Phase 2). | decisions doc |
| D-files | Content files are linked to materials; an author attaches only files they uploaded. Content files open **inline** (pdf, images, markdown, text); the rest download. Markdown images are `![alt](file:<id>)`, only files attached to that material. No SVG. Reconciled with the backend: bodies stay raw, reads carry file metadata only, bytes come from `302` redirect endpoints ([files](#files-and-viewers)). | decisions doc, backend content.md |
| D-live | Edits to running cohorts are live (no versioning). Deleting what has submissions → 422 (unpublish instead); changing an exam window after it opened in some cohort → 422. | decisions doc |

Decisions made **in this spec** (frontend; PO can override): [markdown stack](#rendering-stack) (marked + KaTeX +
highlight.js + DOMPurify, rendered in the browser), [editor](#markdown-editor) (textarea + live preview, not
`UEditor`), [routes](#routes) (`/courses` becomes the real courses; mock removed), [file links through Nitro](#files-and-viewers)
(no 5-minute URL ever sits in a page), PDF embedding only on desktop, exam reviews accept or score only (no "send
back"; same as backend decision 19), practice is out of the review queue unless a filter is on, trial attempts
(up to 3, before the window only, per backend) show the latest one, exam times shown in the cohort's timezone.

## User flows

1. **Student, a normal week.** Home → "Continue: Lecture 5" → lesson page: reads the notes (formulas and code
   rendered), watches the embedded video, opens the slides PDF inline, downloads the starter code → assignments block
   → homework page → attaches `solution.pdf`, writes a short markdown note → Send. Back on the lesson → "Mark
   complete" → Next lesson.
2. **Student, exam.** Calendar shows "Midterm · Fri 14:00–16:00". Two days before, the exam page shows a countdown and
   "Send a trial attempt" → uploads a test file → "Trial received: test.pdf, 120 KB" (up to 3 trials, only before the
   window). At 14:00 the statement appears; student uploads answers → confirm "You can submit only once" → Sent. At
   16:00 the form is gone (a send already in flight is accepted for 2 more minutes and marked late). The day after
   the exam the solution opens on the assignment and lesson pages.
3. **Student, practice.** Practice set → submits an attempt → the solution appears at once; submits again later; a
   mentor may leave a comment.
4. **Editor builds a lesson.** `/courses` → "Editing" → course → outline → module "Week 3" → "Add lesson" → in the
   lesson row "Add material" → Markdown → material editor: pastes notes, drags two images in (uploaded, inserted as
   `file:` references), checks the preview (math renders), tags "Lecture notes" → Save → back → "Add material" →
   Video → pastes a YouTube link → preview → Save → publishes the lesson.
5. **Editor adds an assignment with a solution** (Phase 2): lesson row → "Add assignment" → Exam, statement,
   window Fri 14:00 for 120 min, files only, PDF, 1 file, trial on → Save → "Add solution" → PDF, release "after due".
6. **Head assigns editors.** Course editor → "Editors" → "Add editor" → picks a mentor. The program lead appears there
   already ("via program Backend").
7. **Editor or head releases a solution early** (Phase 2): `/cohorts/[id]` (head, program lead) or `/cohort` (a
   mentor who also edits the course) → Solutions → "Release now" on "Problem set 2 · solution" → confirm. Plain
   mentors see the list read-only (backend: release is for course editors and cohort managers).
8. **Mentor reviews files.** `/reviews/[id]` → sees the attached PDF (opens inline) and the rendered note → accepts.

## Routes

The nav item "Courses" (`nav.courses`) today opens the **mock** external-courses tracker. It is replaced by real
courses for every role (Phase 1); the mock goes away (see [Mock removal](#mock-removal)).

| Route | Who | What it shows / does | Phase |
|---|---|---|---|
| `/courses` | everyone signed in | Student: courses of their cohorts. Mentor: their cohorts' courses, plus "Editing". Head / lead: "Editing" (all courses for `course.update`, else theirs) and "Create course" (`course.create`). | 1 |
| `/courses/[cohortId]/[courseId]` | student of the cohort, cohort staff | Course home: header, contents sidebar, description, "Continue", upcoming work in this course. | 1 |
| `/courses/[cohortId]/[courseId]/lessons/[lessonId]` | same | Lesson (session) page. | 1 |
| `/courses/[cohortId]/[courseId]/pages/[materialId]` | same | A course-level page (syllabus, about…). | 1 (rendered), 3 (polish) |
| `/courses/[cohortId]/[courseId]/materials` | same | Materials by type, tag filter. | 3 |
| `/calendar` | student (cohort switcher if several), staff via `?cohort=` | Cohort calendar by week. | 3 |
| `/assignments/[cohortId]/[assignmentId]` | student | Assignment page per mode; target of `review_completed`, `exam_opens_soon`, `solution_released` notifications. Old `/assignments/[c]-[l]` redirects to the lesson's first assignment. | 2 |
| `/assignments/[cohortId]-[lessonId]` | student | Today's page, extended with files and markdown text (singular API endpoints, removed in Phase 2). | 1 |
| `/editor/[courseId]` | course editors, `course.update` | Course editor: tabs Outline, Settings, Editors. | 1 |
| `/editor/[courseId]/materials/[materialId]` | same | Material editor. | 1 |
| `/editor/[courseId]/assignments/[assignmentId]` | same | Assignment editor. | 2 (Phase 1 keeps the modal) |
| `/cohorts/[id]`, `/cohort` | head / lead; mentor | New "Solutions" and "Exam windows" sections: per-cohort release and window override (actions only when the API allows). | 2 |
| `/reviews/[id]` | mentor | Shows files and rendered markdown; exam and practice handling. | 1 (files), 2 (modes) |

Editor pages are open to any signed-in role view (an editor may be any user); the API decides: `403
permission_denied` (or `404 course_not_found` for a course the caller can't see) shows the "not an editor" empty
state. Ids are the API's integers as strings (`apiId()`).

## Screens: student

### `/courses` (student)

- One group per current cohort (active, then planned), headed "{cohort} · week N of M"; finished cohorts the student
  completed collapse into "Archive · {cohort}" (read-only, as [cohorts](cohorts.md#student-side)).
- Each course is a **list row** (ruled list, not cards): title, "{done} / {released} lessons" figure
  (`completed_lesson_count` / `released_lesson_count`), next deadline in this course (`next_deadline`; figure, yellow
  under 24 h), chevron. Planned cohort: "Opens {date}" and no link.
- Empty: "You're not in a cohort yet. Your courses appear here once the head enrolls you."

### Course home `/courses/[cohortId]/[courseId]`

Layout (desktop ≥ `lg`): contents sidebar 16rem on the left, reading column on the right (prose capped at 72ch,
media up to 48rem). Below `lg`: a "Contents" button in the page header opens the sidebar in a `USlideover` (left).

**Header:** course title (title type), cohort name and status badge, "{done} / {released} lessons done" in Geist Mono,
next deadline in this course. No progress bar, no percent ring (PRODUCT: honest figures, no vanity).

**Contents sidebar** (shared by course home, lesson, course pages, by-type view):

- Group 1, **Course pages** (D-pages): course-level materials in order (Syllabus, About, Grading…). Hidden when none.
- Then each **module** as a disclosure (expanded: the current one and the next one; others collapsed, state kept in
  `sessionStorage` per course): module title, "opens {date}" while locked.
- Each **lesson** row: state icon + title + one figure:
  - released, not done: empty circle; done: check (emerald tint); locked (release date in the future): lock icon,
    row is not a link (`aria-disabled="true"`), second line "Opens {date}"; current page: raised background,
    yellow icon, `aria-current="page"`.
  - Figure: the nearest open deadline in the lesson ("due Fri", from its `assignments[].due_on`), an exam window
    ("exam 14:00", `opens_at`), or nothing.
- State comes from the outline: lesson `released_on`, `is_released`, `completed`.
- Staff (mentor, head) see locked lessons as links with the badge "Not open for students yet"; they can read ahead.
- Footer links (Phase 3): "Materials by type", "Calendar".

**Main column:** description (markdown, rendered), **Continue** panel (the one solid-yellow button: the first
released lesson not marked done, else the next upcoming one with its opening date and no button), "Upcoming in this
course" (next 3 deadlines / exam windows, ruled list).

States: loading skeleton (sidebar + column); 404 or not visible → "Course not found" + "Back to courses"; any other
error → `HomeState` load error with Retry. Finished cohort → read-only banner "This cohort finished on {date}. You
can still read everything; submitting is closed." Planned cohort → "This cohort starts on {date}" and nothing
released.

### Lesson page `/courses/[cohortId]/[courseId]/lessons/[lessonId]`

Sidebar as above. Main column, top to bottom:

1. **Header:** module title as a muted line above (it's a breadcrumb link, not an eyebrow), lesson title, release
   date figure, "Done" badge if marked.
2. **Materials in order** (each a section with its title as a 14px heading and its tags as neutral chips):

| Kind | Viewer | Notes |
|---|---|---|
| `markdown` | `MarkdownView` ([stack](#rendering-stack)): headings, lists, tables (scroll inside their frame), images, KaTeX inline `$…$` and display `$$…$$`, fenced code with highlighting and a copy button | Shown in full, never clamped. |
| `pdf` | Desktop (fine pointer, ≥ `md`, not iOS): `<iframe>` of the file's Nitro route ([files](#files-and-viewers)), 80vh, `title` = material title, with a toolbar row: filename, size, "Open in new tab", "Download". Phones, tablets, iOS, Android: a file card with "Open" (inline, new tab) and "Download" (no iframe: iOS shows only the first page, Android Chrome has no inline PDF viewer). | SSR renders the card; the iframe replaces it on mount when the media check passes. |
| `video` | Responsive 16:9 `<iframe>` of the API's `embed_url` ([hosts](#video-embeds)), `loading="lazy"`, `allow="fullscreen; picture-in-picture"`, `referrerpolicy="strict-origin-when-cross-origin"`, `title`. Attached transcript/captions files as file cards under it. | `embed_url: null` (old data the allowlist rejects) shows a link card "Open video" with `url` instead of an iframe. |
| `file` | File card: type icon (by extension), filename, size (Mono, "1.2 MB"), type label ("ZIP", "Jupyter notebook", "Python"), "Download". Files with `viewable: true` (pdf, images, txt, md, csv, vtt, code) also get "View" (opens inline in a new tab). | |
| `link` | Link card: title, host (Mono), optional description, external-arrow; `target="_blank" rel="noopener noreferrer"`. | |
| `image` | `<img>` up to the column width, `loading="lazy"`, alt = material title or its caption; click opens the full image in a new tab. | |
| any locked (`is_released: false`) | A muted row: lock icon, title, tags, and why, from `release_hint`: `after_due` → "Opens after the due date, {releases_on}", `after_submit` → "Opens after your first attempt", `manual` → "The course team will open it". | Never hidden entirely: the student knows it exists and when it comes. |

3. **Assignments block:** each of the lesson view's `assignments[]` as a list row: mode chip (Homework / Exam /
   Practice), title, status badge (`my_status`, [StatusBadge](../../app/components/StatusBadge.vue) vocabulary), due
   date or window figure, chevron to its page. Phase 1: at most one (today's model), linking to
   `/assignments/[c]-[l]`.
4. **Mark complete:** a toggle button "Mark complete" / "Done ✓ · Undo" (state: the lesson view's `completed`).
   Disabled with a reason when the cohort isn't active ("This cohort has finished" / "starts on {date}") or the
   enrollment is paused. Optimistic: flips at once, rolls back with a toast on error. Not shown to staff. Closes
   [O17](../open-items.md).
5. **Prev / next (Phase 3):** "← {previous lesson}" and "{next lesson} →" from the lesson view's `prev` / `next`,
   across module boundaries, skipping locked lessons for students (next locked → "Next: {title} opens {date}", not a
   link). Below `md` a sticky bottom bar with the two buttons and "Contents" (Phase 1: "Contents" only).

Errors: lesson not open for a student (`403 lesson_locked`) → "This lesson opens on {date}" (`released_on` from the
cached outline) + back to course; 404 `lesson_not_found` → "Lesson not found". Unpublished lessons exist only in the
editor, for staff too.

### Course-level page `/courses/[cohortId]/[courseId]/pages/[materialId]`

A single material rendered with the same viewer, sidebar on the left, no assignments block, no mark complete, no
prev/next (Phase 3 adds prev/next among course pages).

### Materials by type `/courses/[cohortId]/[courseId]/materials` (Phase 3)

- Filter: a toggle group of tags that have at least one released material in this course (Lecture notes, Slides,
  Lecture videos, Readings, Problem sets, Solutions, Exams, Code…), one selected at a time plus "All"; kept in the
  URL (`?tag=`).
- Result: a table grouped by module: lesson title (link to the lesson, anchored at the material), material title,
  kind icon, and for files size + Download. Locked materials listed muted with their opening date (same rule as the
  lesson page). The OCW "week × type" index, in a ruled table.
- Empty: "No {type} in this course yet."

### Calendar `/calendar` (Phase 3)

- Cohort switcher (only if the student has several current cohorts); staff open it with `?cohort=<id>`.
- One **row per week** of the cohort (week 1 … M, current week highlighted with a yellow left rule, past weeks
  muted): the week's dates (Mono), then three columns: **Lessons** opening that week (course · lesson, link),
  **Due** (assignments due that week, with status badge for students), **Exams** (window date and time in the cohort
  timezone). Phones: the three columns stack inside the row.
- From `GET /cohorts/{c}/calendar` (items `module_opens`, `due`, `exam_window`, `solution_release`), grouped into
  weeks in Nitro.
- "Today" jump link; empty weeks show a dimmed "—".

### Assignment page `/assignments/[cohortId]/[assignmentId]` (Phase 2; Phase 1 extends today's page)

Common layout (today's): main column + right rail. Main: mode chip, status badge, title, **statement** (markdown),
**attachments** (file cards), then the mode-specific block, then the attempts history. Rail: deadline or window
(Mono; times in the cohort timezone with the zone label, plus "your time HH:MM" when the browser zone differs), the
student's mentor, the solution block.

**Submit form** (shared by all modes, built from the assignment's accepted formats and limits):

- **Files** (if `accepts.files`): `UFileUpload` multiple, `accept` from `accepts.file_types` (empty = every allowed
  type), "Up to {max_files} files, {types}, 25 MB each". Each file uploads on select (purpose `submission`,
  [limits](#upload-limits)) with a progress state and can be removed before sending; a type or size outside the
  limits is refused before upload with the reason.
- **Text** (if `accepts.text`): the [markdown editor](#markdown-editor) in compact mode (Write / Preview tabs),
  50 000 chars.
- **Links** (if `accepts.links`): one URL input, "Add link" up to 10; http(s) only.
- At least one accepted part must be non-empty ("Add a file, text or link"). If only some are accepted, the others
  aren't shown.
- Send is disabled while any upload is in progress. On error the form keeps everything (files stay uploaded and
  listed) so a retry costs nothing.
- Phase 1 (homework only, no per-assignment formats yet): files (any API-allowed type, ≤ 10), markdown note, links
  (≤ 10); the link is no longer required.

**Homework:** as today: form while not submitted or after "changes requested"; "waiting for review" while one waits
(a second send is `submission_pending`); after the due date the form stays with the notice "The due date has passed.
You can still send; it will be marked late." Approved → accepted state.

**Exam** (state machine from the API's `phase`, `can_submit`, `can_trial` and `submissions`; server time is the
truth, see [time](#time-and-countdowns)):

| State | When | Shows |
|---|---|---|
| Not open | `phase: not_open` (before `opens_at`) | Countdown "Opens in 1 d 4 h" (Mono, yellow under 24 h), window "Fri 18 Oct, 14:00–16:00 (Asia/Almaty)", "The statement appears when the window opens. You can submit once." `statement: null`, `files: []` in the response. Trial block when `can_trial`. |
| Open | `phase: open` (`opens_at` ≤ now < `closes_at`), no counted submission | Statement, attachments, countdown to `closes_at` (yellow under 15 min), the submit form. Send → confirm dialog "Send your exam answer? You can submit only once and can't change it afterwards." The form hides at `closes_at`; a send already in flight is accepted by the API for 2 more minutes and marked late. |
| Submitted | a counted submission exists | "Submitted at 15:12" (+ "late" if `is_late`) + the attempt; no form; later the grade/feedback. |
| Missed | `phase: closed`, no submission | "The window closed at 16:00. You didn't submit." The statement stays visible after the close (API). |
| Cohort not active | cohort finished/planned | Notice as today, no form. |

When the countdown reaches the window opening, the page refetches once with 0–3 s random delay; if the API still
says "not open" (clock skew), it retries every 5 s up to 6 times, then shows "Reload the page". No polling otherwise.

**Trial attempt** (exam with `trial_enabled`): a separate block "Check your upload" with the same form limited to
the accepted formats, labelled "Trial — doesn't count". Shown while `can_trial` (from lesson open until `opens_at`,
at most 3 per student: "{n} of 3 trials used"). Sends with `is_trial: true`. Result: "Trial received: {filenames}
({sizes}) at {time}. Your upload works." The latest of `trials[]` is shown, older ones aren't. Trials never appear in
history, the review queue, or counts. `trial_limit` / `trial_not_allowed` → refetch (the block disappears).

**Practice:** form always available while the cohort is active (unlimited attempts, no "waiting" lock, no due
date). History lists every attempt. The solution (`after_submit`) opens right after the first submission (the page
refetches after Send). Feedback, if a mentor leaves one (an `approved` review with feedback), shows under the attempt.
No status badge beyond "Sent" / "Commented".

**Solution block** (rail on desktop, after the history on phones): per entry of `solutions[]`:
- `is_released: false`, `release_hint: after_due`: "Solution opens {releases_on}" (the day after the due date or the
  exam in this cohort).
- `release_hint: after_submit` (practice): "Solution opens after your first attempt."
- `release_hint: manual`: "The course team will open the solution."
- Released: the material (viewer as on the lesson page).

### `/assignments` (student)

Unchanged list, plus the mode chip and exam windows ("Exam · Fri 14:00"). Phase 2 reads `GET /cohorts/{c}/assignments`
(one call per cohort; added to the backend spec for this). Practice items sit in a separate "Practice" group, never in "Open" (they have no deadline
pressure).

## Screens: editors

### `/courses` (editing group)

Ruled list of editable courses (`GET /courses/`, rows with `can_edit: true`): title, slug (Mono), published / draft
chip. Head with `course.create`: "Create course" (modal: title, slug from title as in programs, description
markdown) → lands on `/editor/[id]`. (Module/lesson counts and "via program" aren't in the list response; the
Editors tab shows how someone edits.)

### Course editor `/editor/[courseId]`

Tabs (URL `?tab=`): **Outline** (default), **Settings**, **Editors** (only when the outline's `can_manage_editors`).

**Outline** (one call, `GET /courses/{course}`, all publish states):

- **Course pages** group: materials on the course, with "Add page" and up / down (`PUT /courses/{course}/pages/order`).
- Each **module**: title, "opens on day {offset}" (`release_offset_days`), menu (Rename, Edit release offset,
  Delete), up / down buttons. "Add module" at the end. Modules have no publish switch (the API has none; lessons and
  materials do).
- Each **lesson** inside: title, publish switch, "{n} materials · {m} assignments", up / down, menu (Rename, **Move
  to module…** (select module + position: end), Delete). Clicking the row expands it inline:
  - **Materials**: kind icon, title, tag chips, release chip (Phase 2: "with lesson" / "after due · HW 3" / "after
    first attempt" / "manual"), publish switch, up / down, Edit (→ material editor), Delete. "Add material" menu: Markdown, PDF, Video, File,
    Link, Image → a small modal (title; for PDF/File/Image the file picker; for Video/Link the URL) creates it, then
    Markdown opens the material editor; others stay in the outline.
  - **Assignments** (the outline's `assignments[]`): mode chip, title, due/window summary, `submission_count`, Edit,
    Delete. "Add assignment" (Phase 1: today's `AssignmentFormModal` on `PUT /lessons/{l}/assignment`, at most one,
    statement now markdown; Phase 2: modal title + mode → assignment editor).
- Reorder: up / down move one step and send the full new order (`PUT …/order`) like the program curriculum; focus
  stays on the moved row's same button; disabled at the ends. Moving across modules only through "Move to module…".
  No drag and drop (keyboard and screen-reader friendly, no extra dependency).
- Publish switches act at once with a toast; a published lesson with no published material shows a warning chip
  "Empty for students".
- **Delete** asks to confirm; `content_has_submissions` → "Students have already submitted work here. Unpublish it
  instead." with an "Unpublish" action in the toast.
- Edits are live in running cohorts: a persistent hint at the top of the outline: "Changes are visible to students
  right away in {n} cohorts." (n = the outline's `cohort_count`).

**Settings:** title, slug, description (markdown editor), published switch. `course_slug_taken` → field error.

**Editors** (`can_manage_editors`): `GET /courses/{course}/editors`; rows with `source: "editor"` (name, Remove →
`DELETE /courses/{course}/editors/{user}`) and `source: "program_lead"` (read-only, "via program", `program_id`).
"Add editor" → people picker (`people-options`) → `PUT /courses/{course}/editors/{user}`; `422
student_cannot_be_staff` → "This person studies in a cohort of this course."; `404 user_not_found` → refetch.

### Material editor `/editor/[courseId]/materials/[materialId]`

Header: back to the outline (lesson anchored), title input, kind (fixed after creation), Save (primary; ⌘/Ctrl+S),
"Unsaved changes" dot. Leaving with unsaved changes asks to confirm (route guard + `beforeunload`).

Fields by kind:

| Field | Kinds | Control and rules |
|---|---|---|
| Title | all | 1–200 chars. |
| Body | `markdown` | [Markdown editor](#markdown-editor), ≤ 200 000 chars (counter turns warning at 90 %). "Upload .md" replaces the body (confirm if not empty). |
| File | `pdf`, `image` (exactly 1), `file` (1–50) | `UFileUpload`; current file cards with Replace / Remove. PDF: `application/pdf`; image: png/jpeg/gif/webp; file: [content types](#upload-limits). Purpose `content`. |
| Attachments | `markdown` (0–50), `video` (0–5: captions `.vtt`/`.txt`, transcript PDF) | Files attached to the material (images used in the body, transcripts). Each: card, "Insert" (markdown: inserts `![name](file:<id>)` or `[name](file:<id>)` at the caret), Remove (warns if the body still references it). |
| URL | `video`, `link` | Video: checked against the [host allowlist](#video-embeds) while typing; valid → live preview iframe; invalid → "Only YouTube, Vimeo, Google Drive and Loom links can be embedded." Link: http(s). The note (`body`, ≤ 5 000) is the link's description. |
| Tags | all | `USelectMenu` multiple from the fixed enum, labels translated, at most 5. |
| Solution of | Phase 2, any kind | Select an assignment of this course (`solution_of_id`); setting it makes the material a solution (the API adds the `solution` tag). |
| Release | Phase 2 | Not a solution: "With the lesson" (`with_lesson`, default) · "Manually, per cohort" (`manual`). A solution: "After the due date" (`after_due`, default; homework with a due date or exam) · "After the student's first attempt" (`after_submit`, default and only date rule for practice) · "Manually, per cohort" (`manual`). Options the API would refuse (`release_invalid`, `solution_needs_due`) are disabled with the reason. |
| Published | all | Switch. |

Files are attached and detached by saving the material with the new full `file_ids` list (`PATCH /materials/{m}`);
there is no per-file endpoint.

Image paste / drop into the body: each image is uploaded (purpose `content_image`, ≤ 5 MB), attached to the material, and a
placeholder `![Uploading name…]()` at the caret is replaced with `![name](file:<id>)`. Failure removes the
placeholder and toasts the reason. Alt text defaults to the filename without extension; the preview flags images
with empty alt.

`.md` upload: read in the browser (`FileReader`, UTF-8, ≤ 200 000 chars), never stored as a file. Relative image paths
in it (`![](img/a.png)`) can't resolve: after loading, a warning lists them: "3 images point to files on your
computer. Upload them here and replace the paths."

### Markdown editor

**Decision: a plain textarea with a toolbar and a live preview, not Nuxt UI's `UEditor` in markdown mode.**

| | `UEditor` (`contentType: 'markdown'`, TipTap + `@tiptap/markdown`) | Textarea + preview (chosen) |
|---|---|---|
| Fidelity | Round-trips through the ProseMirror schema: anything the schema lacks (math `$…$`, tables without the table extension, raw HTML, footnotes) is escaped or dropped, and formatting is normalized on save, so an uploaded `.md` comes back rewritten. | Stores exactly what the author typed. |
| Math | Needs a custom math node extension. | Preview renders it with the reader's pipeline. |
| Preview = what students see | No (editor rendering ≠ reader rendering). | Yes: the same `renderMarkdown()` renders preview and pages. |
| Cost | Already installed. | `UTextarea` + ~100 lines; no new dependency. |

The component `MarkdownEditor` (one, reused for materials, statements, submission text, feedback, course and program
descriptions):

- `UTextarea` in Geist Mono 13px, autoresize (min 12 rows in full mode, 5 in compact), soft wrap, tab inserts two
  spaces (Esc then Tab leaves the field, so keyboard users aren't trapped).
- Toolbar (icon buttons with labels and shortcuts): Bold (⌘B), Italic (⌘I), Heading, Link (⌘K), Inline code, Code
  block, Inline math (`$…$`), Display math (`$$…$$`), Table (inserts a 3×2 skeleton), Image (file picker → same flow
  as paste), Upload .md (full mode only). Each wraps the selection or inserts at the caret.
- Preview: full mode on ≥ `lg` side by side (50/50, scroll synced by ratio); below `lg` and in compact mode, "Write"
  / "Preview" tabs. Re-rendered 300 ms after typing stops. `file:<id>` references resolve against the material's
  attachments to the editor's file route (`GET /materials/{m}/files/{f}` behind Nitro; unknown id → a placeholder box
  "File {id} isn't attached to this material").
- Counter "12 340 / 200 000" (Mono) appears past 80 %.

### Assignment editor `/editor/[courseId]/assignments/[assignmentId]` (Phase 2)

| Field | Rules |
|---|---|
| Title | 2–200. |
| Lesson | Select; moving to another lesson of the course is allowed. |
| Mode | Segmented: Homework / Exam / Practice. Disabled once `submission_count > 0`; the API refuses a change with `content_has_submissions`. |
| Statement | Markdown editor (full), ≤ 200 000 (`statement`). |
| Attachments | `file_ids` (0–20, purpose `content`), shown with the statement (exam: hidden from students until the window opens). |
| Accepted formats | Checkboxes: Files, Text, Links (`accepts_files`, `accepts_text`, `accepts_links`; ≥ 1). |
| File limits | `max_files` 1–20 (default 10); `file_types` presets PDF (`pdf`), Images (`image`), ZIP (`archive`), Office documents (`document`), Code and text (`text`), Jupyter notebooks (`notebook`); none checked = any allowed type; 25 MB each (API maximum, shown, not editable). |
| Max score | Optional number > 0 (`max_score`). When set, review asks for a score. |
| Due (homework only) | "Due {n} days after the lesson opens" (`due_offset_days` ≥ 0; empty = no deadline). Practice has no due date; exam uses the window. |
| Window (exam) | "Opens {n} days after the lesson opens at {HH:MM}" (`opens_offset_days`, `opens_time`, in the cohort's timezone) + duration (`duration_minutes`, 10–10 080). `exam_window_started` once it opened in a cohort without an override → field error with "Change it for one cohort instead" (cohort page). |
| Trial attempt | Switch (exam only, `trial_enabled`): "Let students send up to 3 test submissions before the exam. They never count." |
| Solutions | `GET /assignments/{a}`'s `solutions[]`: list with release chip; "Add solution" → creates a material in the assignment's lesson with `solution_of_id` = this; the API sets `release` (`after_due` for homework/exam, `after_submit` for practice). |

Save is explicit; dirty guard as in the material editor.

### Solutions and exam windows per cohort (Phase 2; `/cohorts/[id]` and `/cohort`)

A "Solutions" section (collapsed by default) from `GET /cohorts/{c}/solutions`: assignment, lesson, `release`, state
in this cohort ("Opens {releases_on}", "Released {released_at} by {released_by}", "Hidden (manual)"). Actions per row
only when `can_release` (course editors, head, program lead): "Release now" (`PUT /cohorts/{c}/materials/{m}/release`;
confirm: "Students of {cohort} will see it at once") and, for a manual release, "Hide again" (`DELETE …/release`).
Allowed in finished cohorts too (the API allows it). Plain mentors see the list read-only.

An "Exam windows" section from `GET /cohorts/{c}/assignments?mode=exam`: exam, window in the cohort timezone,
`window_source` ("from the course" / "set for this cohort"). For course editors and cohort managers: "Change for this
cohort" (two datetime inputs in the cohort timezone → `PUT /cohorts/{c}/assignments/{a}/window {opens_at,
closes_at}`) and "Use the course's window" (`DELETE`). Once open, only a later end is accepted
(`exam_window_started`); after the close `exam_window_closed`; finished cohort `cohort_finished`.

## Screens: mentor review changes

- **Detail `/reviews/[id]`** (Phase 1): the submission shows **files** as file cards (inline "Open" when
  `viewable`, "Download" for all, through `GET /submissions/{s}/files/{f}`), **links** (all of them, not only the first), and the **text rendered as markdown**.
  Feedback is written in the markdown editor (compact) and rendered in history. Statement rendered as markdown.
- **Modes** (Phase 2): a mode chip in the header. Homework: Accept / Request changes (as today). **Exam**: Accept
  only (with score when `max_score` is set) and feedback; no "Request changes" (one attempt), the API answers
  `review_decision_not_allowed` otherwise. **Practice**: "Leave feedback" only (sends `decision: approved` with the
  feedback), optional.
- **Queue `/reviews`** (Phase 2): `GET /cohorts/{c}/submissions` defaults to `mode=homework&mode=exam`; a toggle
  "Include practice" adds `mode=practice` and shows them in their own group. Exams show "Exam" and are ordered with the rest (oldest first). Trials never appear.
- **Attempts** (Phase 2): earlier attempts of the same student and assignment (`SubmissionDetail.versions[]`) under
  the current one, and the student's trials (`trials[]`) for exams; closes [O11](../open-items.md).

## Behavior

### Release and visibility (what the UI shows; the API decides)

- A lesson is **released** for a cohort on its module's release date; the outline returns `released_on` and
  `is_released` per lesson (never computed in the browser).
- A material is visible to a student when its lesson is released, it is published, and its release rule is met in
  that cohort; a locked material still appears as a muted row with its reason and date (from the API:
  `is_released: false`, `release_hint`, `releases_on`); opening it directly answers `403 material_locked`.
- Unpublished modules, lessons and materials never reach students or mentors; editors see them only in the editor.
- Finished cohort: everything released stays readable; mark complete, submit and trial are closed.

### Assignment states over time

| Mode | Before release | Open | After due / window | Cohort finished |
|---|---|---|---|---|
| Homework | Locked row in lesson; not in `/assignments` | Submit; resubmit after changes | Submit allowed, flagged late | Read-only history |
| Exam | Locked | Not open → countdown + trial; Open → statement + one submit | Submitted / Missed | Read-only |
| Practice | Locked | Unlimited submits, solution after first | Same (no due) | Read-only |

Solution states (solutions can't use `with_lesson`): `after_due` → listed locked with `releases_on`, released the
day after the cohort due date (exam: after the exam's day); `after_submit` (practice) → released to that student
after their first submission; `manual` → hidden until a course editor or cohort manager releases it in that cohort.
Any material can also be released early per cohort.

### Time and countdowns

- Every Nitro response with time-sensitive state carries `serverNow` (the assignment view's `server_time`; other
  responses: the API response `Date` header); `useCountdown` takes a skew = `serverNow - Date.now()` at fetch time.
  Countdowns tick per second only in the last hour, otherwise per minute.
- Exam window (backend rule): opens `opens_offset_days` after the lesson opens, at `opens_time` in the cohort's
  timezone, for `duration_minutes`; a per-cohort override replaces it; submissions are accepted until `closes_at` + 2
  minutes (flagged late). The API sends instants (`opens_at`, `closes_at`, UTC) and the cohort `timezone`
  (`StudentAssignment.timezone`, outline `cohort.timezone`, default `Asia/Almaty`); the UI formats them with
  `Intl.DateTimeFormat(locale, { timeZone })`, plus "your time" when the browser zone differs. Day-based due dates
  keep the current rule (UTC day) until D5's day part is decided ([O22](../open-items.md)).

### Video embeds

`shared/utils/video.ts` `toEmbed(url) → { host, embedUrl } | null` mirrors the backend table and is used only for
the editor's live preview and field check; pages always embed the API's `embed_url` (`null` → link card). The API is
the final check (`video_host_not_allowed`).

| Host | Accepted input | Embed URL |
|---|---|---|
| YouTube | `youtube.com/watch?v=ID`, `youtu.be/ID`, `youtube.com/embed/ID`, `youtube.com/shorts/ID`, `t` / `start` kept as start | `https://www.youtube-nocookie.com/embed/ID?start=S` |
| Vimeo | `vimeo.com/ID`, `vimeo.com/ID/HASH` (unlisted), `player.vimeo.com/video/ID?h=HASH` | `https://player.vimeo.com/video/ID?h=HASH` |
| Google Drive | `drive.google.com/file/d/ID/view…`, `…/preview` | `https://drive.google.com/file/d/ID/preview` |
| Loom | `loom.com/share/ID`, `loom.com/embed/ID` | `https://www.loom.com/embed/ID` |

Anything else → null. Editor hint for Drive and Loom: "The video must be shared with anyone who has the link" (can't
be checked from the browser, [O28](../open-items.md)).

### Files and viewers

Design (same in backend content.md, [Files in content](../../../backend/spec/content.md#files-in-content-p1)): the API
keeps bodies raw, returns file **metadata** only (`files: FileMeta[]` = `{id, filename, content_type, size,
viewable}`) and serves bytes through `302` redirect endpoints that check access through the owning object at click
time. No signed URL is ever stored in a page.

| File of | API redirect (`?download=1` = attachment) | Nitro route (pages link here) | Phase |
|---|---|---|---|
| Material, student/staff in a cohort | `GET /cohorts/{c}/materials/{m}/files/{f}` | `GET /api/files/cohorts/[c]/materials/[m]/[f]` | 1 |
| Material, editor preview | `GET /materials/{m}/files/{f}` | `GET /api/files/materials/[m]/[f]` | 1 |
| Submission (author, reviewers) | `GET /submissions/{s}/files/{f}` | `GET /api/files/submissions/[s]/[f]` | 1 |
| Assignment statement, in a cohort | `GET /cohorts/{c}/assignments/{a}/files/{f}` | `GET /api/files/cohorts/[c]/assignments/[a]/[f]` | 2 |
| Assignment statement, editor | `GET /assignments/{a}/files/{f}` | `GET /api/files/assignments/[a]/[f]` | 2 |

- Each Nitro route forwards `?download=1`, calls the API with the session token **without following** the redirect,
  and answers the same `302` with the API's `Location` and `Cache-Control: private, max-age=240`. API errors pass
  through `toH3Error` (404 → broken-image / "File not available" card, 403 → locked).
- Inline (`viewable` and no `download=1`): PDFs, raster images, txt / md / csv / vtt / code; everything else always
  downloads. A page left open for an hour still downloads and lazy images still load, because each click or image
  load asks the API again.
- Markdown: `renderMarkdown(src, { files, base })` rewrites `file:<id>` to `{base}/{id}` when `id` is in `files`
  (`base` = the Nitro prefix of the object being rendered, e.g. `/api/files/cohorts/12/materials/51`), else to a
  "missing file" placeholder. Closes [O21](../open-items.md).
- File cards: icon and label by extension (pdf, zip, py/js/ts/java/kt/swift/go/cpp/c/cs/sql, ipynb, docx, pptx, xlsx,
  md, txt, csv, vtt, images); size with `Intl.NumberFormat` (KB/MB, Mono); "View" when `viewable`, "Download" always.
- Program covers keep the API's `cover_url` (unchanged).

### Upload limits

`POST /api/files {filename, size, purpose}` → API `POST /files/ {filename, content_type, size, purpose}`. The
backend validates purpose, type and size (one table, backend
[Upload purposes](../../../backend/spec/content.md#upload-purposes-and-allowed-types)); Nitro and the client check the
same table first to fail fast. Today the route accepts only cover images ≤ 5 MB; that becomes the `cover` row.

| `purpose` | Who (API) | Types | Max size | Count (checked where it's attached) |
|---|---|---|---|---|
| `cover` | anyone; the cover itself is checked on save (head, lead) | png, jpeg, webp, gif | 5 MB | 1 |
| `content_image` | course editors, `course.update` | png, jpeg, webp, gif (no SVG) | 5 MB | ≤ 50 files per material |
| `content` | course editors, `course.update` | every allowed type: pdf, png/jpeg/webp/gif, zip, docx/pptx/xlsx, md, txt, csv, vtt, code as `text/plain`, ipynb | 100 MB | per material kind ([fields](#material-editor)); statements ≤ 20 |
| `submission` | anyone | every allowed type, then the assignment's `file_types` (Phase 1: all) | 25 MB | the assignment's `max_files` (Phase 1: 10) |

**Type from the extension, never from `File.type`.** Browsers send an empty type for `.md`, `.ipynb` and most code,
and a wrong one for some (`.ts` → `video/mp2t`). `shared/utils/fileTypes.ts` maps the extension (lowercased) to the
content type: `.pdf`; `.png .jpg .jpeg .gif .webp`; `.zip`; `.docx .xlsx .pptx`; `.md .markdown` → `text/markdown`;
`.csv` → `text/csv`; `.vtt` → `text/vtt`; `.ipynb` → `application/x-ipynb+json`; `.txt` and code (`.py .js .ts .jsx
.tsx .java .c .cpp .h .hpp .cs .go .rs .sql .sh .kt .swift .rb .php .r .scala .json .yaml .yml`) → `text/plain`.
Anything else (incl. `.svg`, `.html`, video, audio, executables) is refused before any request with "This file type
isn't allowed." Size is checked before upload too, so a 40 MB video gets "Files up to 25 MB. Videos go on YouTube or
Vimeo and are added as a link." without a request. The S3 `PUT` uses exactly the returned headers.

### Errors

Pages switch on `apiError(e).code`; messages under `content.err.<code>` in `en` and `ru` (via `useApiErrors('content')`,
widening its namespace union). Unlisted codes → `common.saveError`. Codes and API statuses are exactly backend
content.md's; Nitro's `toH3Error` may re-map the status (its 409 set) without changing the code.

| Code | API | Where | Message (en) | Then |
|---|---|---|---|---|
| `permission_denied` | 403 | editor pages and mutations, release, window, `content` upload | "You're not an editor of this course." (editor) / "You can't do this here." (other) | Editor: empty state with "Back to courses" |
| `course_not_found`, `lesson_not_found`, `material_not_found`, `assignment_not_found`, `course_not_in_cohort` | 404 | loads, mutations | "{Thing} not found" | Load: empty state; mutation: toast, refetch outline |
| `lesson_locked` | 403 | student lesson / material load | "This lesson opens on {date}." | Empty state + back to course |
| `material_locked` | 403 | material load (Phase 2) | "This isn't open yet." | Locked row |
| `content_has_submissions` | 422 | delete lesson / module / assignment; assignment mode change | "Students have already submitted work here. Unpublish it instead." / on Mode: "The mode can't change after students have submitted." | Toast with "Unpublish" / field error on Mode |
| `different_course` | 422 | move lesson / material / assignment, solution link | "It can only move within this course." | Refetch outline |
| `content_limit_reached` | 422 | add material / page / assignment | "This lesson is full (50 materials, 10 assignments; 20 course pages)." | Toast |
| `material_file_invalid` | 422 | material save | "This kind of material needs {details}." | Under the file input |
| `exam_window_started` | 422 | assignment save, cohort window | "The exam has already opened in a cohort; change it for that cohort only." / "Only a later end can be set now." | Field error on Window |
| `exam_window_closed`, `cohort_finished` | 422 | cohort window | "This exam's window has closed." / (existing cohort notice) | Refetch |
| `release_invalid`, `solution_needs_due` | 422 | material save (Phase 2) | "This release rule doesn't fit this material." / "The assignment has no due date; choose another rule." | Field error on Release |
| `release_not_found` | 404 | hide again | — | Refetch the section |
| `video_host_not_allowed` | 422 | material save | "Only YouTube, Vimeo, Google Drive and Loom links can be embedded." | Field error on URL |
| `no_such_file` | 404 | attach, submit, file link | "You can only attach files you uploaded." / link: "File not available." | Toast; remove the card |
| `file_too_large` | 422 | upload, attach, submit | "Files up to {details.max_bytes}." | Under the file input |
| `upload_mismatch` | 422 | upload complete, attach | "The upload didn't finish. Try again." | Retry button on the file |
| `format_not_accepted` | 422 | submit (Phase 2) | by `details.reason`: `text`/`links`/`files` "This assignment doesn't accept {format}.", `max_files` "Up to {n} files.", `file_type` "This file type isn't allowed here." | Refetch assignment (formats changed) |
| `exam_not_open` | 422 | exam submit | "The exam hasn't opened yet." | Refetch |
| `exam_closed` | 422 | exam submit | "The exam window has closed; your answer wasn't accepted. Tell your mentor." | Keep the form contents; refetch state |
| `attempt_used` | 422 (Nitro 409) | exam submit | "You've already submitted this exam." | Refetch |
| `trial_not_allowed` | 422 | trial submit | "Trial attempts are only possible before the exam opens." | Refetch |
| `trial_limit` | 422 | trial submit | "You've used all 3 trial attempts." | Refetch |
| `submission_pending` | 422 (Nitro 409) | homework submit | (existing) "Your previous submission is still waiting for review." | Refetch |
| `cohort_not_active` | 422 | submit, complete, trial | (existing cohorts notice) | Refetch; page turns read-only |
| `review_decision_not_allowed` | 422 | review | "Exams and practice can only be accepted, not sent back." | Refetch |
| `not_reviewable` | 422 (Nitro 409) | review | (existing) | |
| `course_slug_taken` | 422 (Nitro 409) | course create / settings | "Another course uses this address." | Field error on Slug |
| `student_cannot_be_staff`, `user_not_found`, `editor_not_found` | 422 / 404 | editors tab | "This person studies in a cohort of this course." / refetch | Toast |
| `validation_error` | 422 | any form, upload (`purpose`, `content_type`) | Field message via `apiError(e).field(name)` (`body`, `title`, `url`, `content_type`…) | Field error |

Nitro's `toH3Error` adds `attempt_used` to the 409 set. Load errors: 404 → not found; anything else → load error with
Retry (never "not found" for a 500).

### Cache keys

| Key | Fetched by | Holds |
|---|---|---|
| `my-courses` | `/courses` (student, mentor) | Courses per cohort with progress |
| `editor-courses` | `/courses` editing group | Editable courses |
| `course-outline:<cohortId>:<courseId>` | course home, lesson, course page, by-type | Sidebar + header (one API call); shared, so moving between lessons doesn't refetch it |
| `lesson:<cohortId>:<lessonId>` | lesson page | Materials, assignments, completion |
| `course-page:<cohortId>:<materialId>` | course-level page | One material |
| `course-materials:<cohortId>:<courseId>:<tag>` | by-type (Phase 3) | Rows |
| `calendar:<cohortId>` | `/calendar` (Phase 3) | Week rows |
| `assignment:<cohortId>:<assignmentId>` | assignment page (Phase 2) | Assignment, attempts, trial, solutions |
| `editor-outline:<courseId>` | course editor | Full outline incl. drafts |
| `editor-material:<materialId>`, `editor-assignment:<assignmentId>` | editors | Raw body, files |
| `course-editors:<courseId>` | Editors tab | Editors |
| `cohort-solutions:<cohortId>` | Solutions section (Phase 2) | Rows |

Invalidation (one helper `invalidateContent(courseId?)` in `app/utils/`, `clearNuxtData` with a predicate):

| Mutation | Refresh | Also clear |
|---|---|---|
| Mark complete / undo | `lesson:…` (optimistic) | `course-outline:<c>:<course>`, `my-courses`, `dashboard-mentee` |
| Submit / trial | `assignment:…` or today's key | `course-outline:<c>:*`, `assignments`, `dashboard-mentee` |
| Any editor mutation | `editor-outline:<course>` | every `course-outline:*:<course>`, `lesson:*`, `course-page:*`, `course-materials:*`, `calendar:*`, `my-courses`, `editor-courses` |
| Release / hide solution | `cohort-solutions:<c>` | `assignment:<c>:*`, `lesson:<c>:*` |
| Editors add / remove | `course-editors:<course>` | `editor-courses` |

On a mutation error, refetch the affected keys so the UI resets to the server value.

### Rendering stack

**Decision: `marked` (GFM) + `marked-katex-extension` + `katex` + `highlight.js` (core, selected languages) +
`dompurify`, rendered in the browser** by one function `renderMarkdown(src, { files, base })` in `app/utils/markdown.ts`,
loaded lazily by the `MarkdownView` and `MarkdownEditor` components.

| | `@nuxtjs/mdc` + Nuxt UI prose + remark-math/rehype-katex + Shiki | marked + KaTeX + highlight.js + DOMPurify (chosen) |
|---|---|---|
| Bundle | unified/remark/rehype + Shiki (grammars, themes, oniguruma WASM): large on the client for the editor preview | marked ~40 KB, DOMPurify ~22 KB, highlight.js core + ~18 languages ~60 KB (loaded only when a fence exists), KaTeX ~260 KB min (loaded only when `$` occurs) |
| SSR | Native | Rendered after hydration with a skeleton; pages are behind login, no SEO need |
| Sanitization | No built-in allowlist sanitizer; MDC syntax lets authors (and students, in submissions) call components (`::u-button`) and pass attributes | DOMPurify (the browser reference sanitizer) over the final HTML, one config |
| Math | Plugins, fine | `marked-katex-extension` (`$…$`, `$$…$$`), `throwOnError: false`, `trust: false` |
| Code | Shiki (best colours) | highlight.js with a theme from the palette tokens (dark and light) |
| Styling | Nuxt UI prose components | Hand-written `.md-body` styles in `main.css` from the design tokens (~80 lines) |
| Syntax | MDC superset (not plain GFM) | Plain GFM: what authors paste from elsewhere renders the same |

Why the browser and not Nitro: one runtime (native DOMPurify; no jsdom on Vercel serverless), the editor preview runs
the identical code, and the heavy parts (KaTeX, highlight.js) are fetched only by pages that use them.

Pipeline: `marked` (gfm, breaks off) with the KaTeX extension (output `htmlAndMathml`, so screen readers get
MathML) → renderer override for `code` (highlight.js by the fence language; unknown → plain; adds the copy button
markup) → `file:<id>` URL rewrite → **DOMPurify** with profiles html + svg + mathMl (KaTeX needs them), forbidding
`style` (tag), `iframe`, `object`, `embed`, `form`, `script` and `on*` attributes (default), `SANITIZE_NAMED_PROPS`
on (no DOM clobbering via `id`/`name`), URIs limited to `https:`, `http:`, `mailto:` and our `/api/files/` route; a
hook adds `target="_blank" rel="noopener noreferrer nofollow"` to external links and `loading="lazy"` to images →
`v-html` in `MarkdownView` only. **No `v-html` anywhere else**; a grep for `v-html` in review must find only
`MarkdownView.vue`.

New dependencies (exact): `marked`, `marked-katex-extension`, `katex`, `highlight.js`, `dompurify`. Nothing else: no
PDF.js (native viewer), no editor library (textarea), no drag-and-drop library (up / down buttons), no
`@tailwindcss/typography` (own `.md-body`).

`MarkdownView` also renders program and course descriptions, which closes [O19](../open-items.md) (Phase 1).

### i18n

- Russian primary, English second; new namespaces `courses.*`, `lesson.*`, `material.*`, `editor.*`, `exam.*`,
  `content.err.*`. Tag labels (ru / en): Конспекты лекций / Lecture notes, Слайды / Slides, Чтение / Readings,
  Видео лекций / Lecture videos, Семинары / Recitations, Код / Code, Практика / Practice, Задачи / Problem sets,
  Решения / Solutions, Экзамены / Exams, Разбор экзамена / Exam review, Программа курса / Syllabus, Другое / Other.
  Modes: Домашнее задание / Homework, Экзамен / Exam, Практика / Practice.
- Plurals with three Russian forms (уроков/урок/урока, файлов/файл/файла) as in programs.
- Course content itself is authored in one language and never translated by the UI.
- Dates, times and sizes through `Intl` with the active locale; every figure in Geist Mono (`.num`).

### Accessibility

- Contents sidebar: `<nav aria-label="Course contents">`, module disclosures are buttons with `aria-expanded`,
  current lesson `aria-current="page"`, locked lessons carry their reason as text, not only the lock icon.
- Viewers: every iframe has a `title`; KaTeX emits MathML; code blocks are focusable (`tabindex="0"`) so they scroll
  with the keyboard; images need alt (the editor warns on empty alt).
- Countdown: visible text updates per minute; an `aria-live="polite"` region announces only "The exam is open" and
  "15 minutes left".
- Reorder buttons have names ("Move {title} up"); after a move, focus stays on the same button of the moved row.
- Editor: toolbar buttons are labelled with their shortcut; Esc then Tab leaves the textarea; the preview is a
  labelled region.
- Status and lock states keep icon + word + tint (Never-Colour-Alone).

### Mobile

- Sidebar → `USlideover` from a "Contents" button; prev / next (Phase 3) in a sticky bottom bar on lesson pages.
- PDF: file card with Open / Download (no iframe). Video: full-width 16:9.
- Markdown tables, code blocks and display math scroll horizontally inside their own box; the page never scrolls
  sideways.
- Submit form: `UFileUpload` opens the system picker (camera allowed for images); upload progress per file.
- Editor works on a tablet; on phones the outline works (publish, reorder) and the material editor uses Write /
  Preview tabs.

### Dark theme

The app is dark-first. `.md-body` uses the tokens (text, muted, hairline, Graphite Raised for code and table
headers); the highlight.js theme is defined with CSS variables for dark and light; KaTeX inherits `currentColor`;
links use the toned text with underline, not yellow (One Lamp Rule). PDFs render on their own white page inside a
hairline frame.

### Performance

- One outline call per course page view, shared by sidebar, header and prev / next; lesson navigation fetches only
  the lesson.
- `/api/assignments` and the calendar make one call per cohort (`GET /cohorts/{c}/assignments`, Phase 2;
  `GET /cohorts/{c}/calendar`, Phase 3), never per lesson (closes [O7](../open-items.md) in Phase 2).
- Markdown pipeline chunks load on demand; KaTeX CSS and fonts only with math; images and iframes lazy.
- Course list rows don't load outlines: `GET /cohorts/{c}/courses` returns `released_lesson_count`,
  `completed_lesson_count` and `next_deadline`.

### Mock removal

Phase 1 removes the external-courses mock: `app/pages/courses.vue` (rewritten as the real list),
`server/api/courses/**` (mock routes), `db.courses`, `CoursesList.vue`, `CourseStatusControl.vue`, the course
status part of `useStudentDashboard`, and the "External courses" list on the student home, which becomes "My
courses" (real courses with "{done} / {released} lessons" and the next lesson). `QueueList`'s empty-state link to
`/courses` stays valid. [Mock features](mock-features.md) loses the row; DESIGN.md retires the Course Status
Control.

## API

Nitro routes; pages call only these. Backend paths, fields and codes are **exactly backend spec/content.md**
(generated types win).

### Phase 1

| UI call (Nitro) | API calls | Notes |
|---|---|---|
| `GET /api/courses` | Student: `/me/access` → per current/completed cohort `GET /cohorts/{c}/courses` (`released_lesson_count`, `completed_lesson_count`, `next_deadline`). Mentor: same over staffed cohorts. Editors: `GET /courses/`, rows with `can_edit` | → `{ cohorts: CourseGroup[], editing: EditableCourse[] }`. Replaces the mock route. `GET /courses/` answers 403 for callers who edit nothing: treat as "no editing group". |
| `GET /api/courses/[cohortId]/[courseId]` | `GET /cohorts/{c}/courses/{course}/outline` (`cohort {id, name, status, starts_on, ends_on}`, `pages`, modules with `released_on`, lessons with `released_on`, `is_released`, `completed`, `materials`, `assignments`) | → `CourseOutlineView`. One call. |
| `GET /api/courses/[cohortId]/lessons/[lessonId]` | `GET /cohorts/{c}/lessons/{l}` (`materials[]` with raw markdown `body`, `files: FileMeta[]`, `embed_url`, lock info; `assignments[]`; `completed`) | → `LessonView`. |
| `GET /api/courses/[cohortId]/pages/[materialId]` | `GET /cohorts/{c}/materials/{m}` | → `MaterialView`. |
| `PUT/DELETE /api/courses/[cohortId]/lessons/[lessonId]/complete` | `PUT/DELETE /cohorts/{c}/lessons/{l}/complete` (exists) | `cohort_not_active` → notice. |
| `GET /api/files/cohorts/[c]/materials/[m]/[f]`, `/api/files/materials/[m]/[f]`, `/api/files/submissions/[s]/[f]` (`?download=1`) | `GET /cohorts/{c}/materials/{m}/files/{f}`, `GET /materials/{m}/files/{f}`, `GET /submissions/{s}/files/{f}` | Pass the `302` through ([files](#files-and-viewers)). |
| `POST /api/files {filename, size, purpose}` (changed) | `POST /files/ {filename, content_type, size, purpose}` | `content_type` from the extension; per-purpose checks ([limits](#upload-limits)). |
| `GET /api/assignments/[id]` (student, changed) | `GET /cohorts/{c}/lessons/{l}/assignment` (as today; kept until the coordinated Phase 2 release) | `instructions` rendered as markdown; submissions with `files: FileMeta[]`, all `links`, markdown `body`. |
| `POST /api/assignments/[id]/submissions {body, links[], fileIds[]}` (changed) | `POST /cohorts/{c}/lessons/{l}/submissions {body, links, file_ids}` (as today) | Link no longer required; ≥ 1 part. |
| `GET /api/reviews/[id]` (changed) | `GET /submissions/{id}` + `GET /cohorts/{c}/lessons/{l}/assignment` (as today) | Files, all links, rendered markdown. |
| `POST /api/assignments`, `PATCH`/`DELETE /api/assignments/[id]` (modal, changed) | `GET`/`PUT`/`DELETE /lessons/{l}/assignment` (as today; kept until the coordinated Phase 2 release) | Statement markdown; `DELETE` with submissions → `content_has_submissions`. |
| `GET /api/editor/courses/[id]` | `GET /courses/{course}` (authoring outline: all publish states, `pages`, modules → lessons → `materials`, `assignments` (≤ 1 in Phase 1), `can_manage_editors`, `cohort_count`) | 403 `permission_denied` → "not an editor". |
| `POST /api/editor/courses`, `PATCH /api/editor/courses/[id]` | `POST /courses/`, `PATCH /courses/{course}` | |
| `POST /api/editor/courses/[id]/modules`; `PATCH`/`DELETE /api/editor/modules/[id]`; `PUT /api/editor/courses/[id]/modules/order` | `POST /courses/{course}/modules`; `PATCH`/`DELETE /modules/{m}`; `PUT /courses/{course}/modules/order {module_ids}` | |
| `POST /api/editor/modules/[id]/lessons`; `PATCH`/`DELETE /api/editor/lessons/[id]`; `PUT /api/editor/modules/[id]/lessons/order` | `POST /modules/{m}/lessons`; `PATCH`/`DELETE /lessons/{l}` (`module_id` + `position` to move); `PUT /modules/{m}/lessons/order {lesson_ids}` | |
| `POST /api/editor/lessons/[id]/materials`, `POST /api/editor/courses/[id]/materials` | `POST /lessons/{l}/materials`, `POST /courses/{course}/materials` | Course pages = course materials. |
| `GET`/`PATCH`/`DELETE /api/editor/materials/[id]`; `PUT /api/editor/lessons/[id]/materials/order`; `PUT /api/editor/courses/[id]/pages/order` | `GET`/`PATCH`/`DELETE /materials/{m}`; `PUT /lessons/{l}/materials/order {material_ids}`; `PUT /courses/{course}/pages/order {material_ids}` | Attach / detach files = `PATCH {file_ids}` with the full list; `404 no_such_file` for a file you didn't upload. |
| `GET /api/editor/courses/[id]/editors`; `PUT`/`DELETE …/editors/[userId]` | `GET /courses/{course}/editors`; `PUT`/`DELETE /courses/{course}/editors/{user}` | Leads come back with `source: "program_lead"`. |

### Phase 2 (deployed together with backend P2)

| UI call (Nitro) | API calls | Notes |
|---|---|---|
| `GET /api/assignments` (changed) | per current cohort `GET /cohorts/{c}/assignments` | One call per cohort (O7). |
| `GET /api/assignments/[cohortId]/[assignmentId]` | `GET /cohorts/{c}/assignments/{a}` (`mode`, `accepts`, window, `statement` only when visible, `files`, `phase`, `can_submit`, `can_trial`, `submissions`, `trials`, `solutions`, `timezone`, `server_time`) | → `AssignmentView` with `serverNow`. |
| `POST /api/assignments/[cohortId]/[assignmentId]/submissions {body, links, fileIds, isTrial}` | `POST /cohorts/{c}/assignments/{a}/submissions {body, links, file_ids, is_trial}` | |
| `GET /api/files/cohorts/[c]/assignments/[a]/[f]`, `/api/files/assignments/[a]/[f]` | `GET /cohorts/{c}/assignments/{a}/files/{f}`, `GET /assignments/{a}/files/{f}` | `302` pass-through. |
| `POST /api/editor/lessons/[id]/assignments`; `GET`/`PATCH`/`DELETE /api/editor/assignments/[id]`; `PUT /api/editor/lessons/[id]/assignments/order` | `POST /lessons/{l}/assignments`; `GET`/`PATCH`/`DELETE /assignments/{a}` (attachments = `PATCH {file_ids}`); `PUT /lessons/{l}/assignments/order {assignment_ids}` | Replaces `PUT /lessons/{l}/assignment`, which the same release removes. |
| `GET /api/cohorts/[id]/solutions`; `PUT`/`DELETE /api/cohorts/[id]/solutions/[materialId]` | `GET /cohorts/{c}/solutions`; `PUT`/`DELETE /cohorts/{c}/materials/{m}/release` | |
| `GET /api/cohorts/[id]/exams`; `PUT`/`DELETE /api/cohorts/[id]/exams/[assignmentId]/window` | `GET /cohorts/{c}/assignments?mode=exam`; `PUT`/`DELETE /cohorts/{c}/assignments/{a}/window {opens_at, closes_at}` | |
| cohort create / edit (changed) | `POST /programs/{p}/cohorts`, `PATCH /cohorts/{c}` + `timezone` | Editable while planned (`cohort_started` after). |
| `GET /api/reviews?practice=1` (changed) | `GET /cohorts/{c}/submissions?status=…&mode=homework&mode=exam[&mode=practice]` | Trials never appear. |
| `GET /api/reviews/[id]` (changed) | `GET /submissions/{id}` (+ `mode`, `is_trial`, `versions`, `trials`) + `GET /assignments/{a}` or `GET /cohorts/{c}/assignments/{a}` | No longer the singular endpoint. |
| `POST /api/reviews/[id] {verdict, feedback, score?}` (changed) | `POST /submissions/{id}/review {decision, feedback, score}` | Exam / practice: `approved` only. |
| `/assignments/[c]-[l]` page | `GET /cohorts/{c}/lessons/{l}` → first of `assignments[]` | Redirect (old links). |

### Phase 3

| UI call (Nitro) | API calls | Notes |
|---|---|---|
| `GET /api/courses/[cohortId]/[courseId]/materials?tag=` | `GET /cohorts/{c}/courses/{course}/materials?tag=&kind=` | |
| `GET /api/calendar?cohort=` | `GET /cohorts/{c}/calendar?from=&to=` | Grouped into weeks in Nitro. |
| `GET /api/courses/[cohortId]/[courseId]/search?q=` | `GET /cohorts/{c}/courses/{course}/search?q=` | ⌘K inside a course; titles, released bodies and visible statements. |
| lesson `prev` / `next` | from `GET /cohorts/{c}/lessons/{l}` | No extra call. |

## Acceptance criteria

All unchecked until built. (e2e) = covered by `scripts/e2e-smoke.py` against a local backend; the rest by typecheck,
a browser check, or the named check.

### Phase 1: student reading

- [x] Nav "Courses" opens the real course list for students, mentors and heads; the mock tracker, its routes and
  `db.courses` are gone, and the student home shows "My courses". (e2e) ✓ e2e-smoke + browser check
- [x] A student sees their cohort's course with modules and lessons; future lessons show a lock and "Opens {date}"
  and aren't links. (e2e) ✓ e2e-smoke + browser check
- [x] The course page makes one API outline call; moving between two lessons fetches only the lesson. ✓ browser check
- [x] A lesson shows its materials in order: markdown with an inline formula, a display formula, a highlighted Python
  block and a table renders correctly (screenshot); a PDF opens inline on desktop and as Open / Download on a phone
  viewport; a YouTube link plays embedded; a zip shows name, size and Download. (e2e for the data, browser check for
  rendering) ✓ e2e-smoke + browser check (desktop and iPhone 13)
- [x] A markdown image `file:<id>` loads through the Nitro file route; after leaving the page open 10 minutes, a lazy
  image further down and a Download still work; no `s3.` URL appears in the page HTML. ✓ browser check (page open 10 minutes, then a lazy image and a Download)
- [x] Markdown with `<script>`, `<img onerror>`, `javascript:` links and `<iframe>` renders inert (unit check of
  `renderMarkdown` with these inputs; `v-html` appears only in `MarkdownView.vue`). ✓ browser check of `renderMarkdown` through the editor preview; grep: one `v-html`
- [x] Mark complete flips at once, survives a reload, updates the sidebar check and the home figure; in a finished
  cohort it is disabled with "This cohort has finished". (e2e) ✓ e2e-smoke + browser check
- [x] Course pages (syllabus) appear at the top of the sidebar and open. ✓ e2e-smoke + browser check
- [x] Program and course descriptions render as markdown (O19). ✓ browser check (program page, student home, course home)

### Phase 1: homework with files

- [x] A student submits a homework with two files (pdf, zip), a markdown note and a link; the history shows all
  three parts; a mentor sees the files (pdf opens inline) and the rendered note in review. (e2e) ✓ e2e-smoke (data and the 302 file route)
- [x] A 30 MB file and a `.exe` are refused before upload with the right message; a `.md`, an `.ipynb` and a `.ts`
  (browser type `video/mp2t`) upload with the extension's type; the API refuses a `content` upload by a student. ✓ browser check (26 MB, `.exe`, `.md`, `.ts`) + e2e-smoke (Nitro refusals, student `content` → 403); `.ipynb` by the mapping check
- [x] A failed send keeps the uploaded files and text in the form. ✓ browser check

### Phase 1: editor

- [x] A course editor sees the course under "Editing" and edits it; a mentor who isn't an editor gets "You're not an
  editor of this course" on `/editor/[id]`. (e2e) ✓ e2e-smoke (a program lead, not admin, sees it under Editing and edits; a mentor gets 403)
- [x] The head adds and removes an editor; a program lead appears as an editor "via program". (e2e) ✓ e2e-smoke
- [x] Add module, lesson and each material kind; reorder with up / down and move a lesson to another module; the
  student view shows the new order. (e2e) ✓ e2e-smoke (order and move calls through Nitro; the up / down buttons weren't clicked in a browser)
- [x] The material editor previews math and code exactly as the lesson page shows them; pasting an image inserts a
  `file:` reference that renders in the preview and for students. ✓ browser check (preview HTML equals the lesson's; two images pasted at once)
- [x] Uploading a `.md` replaces the body and lists unresolved relative image paths. ✓ browser check
- [x] A non-allowlisted video URL is refused in the field; a Vimeo unlisted link previews. ✓ browser check
- [x] Deleting a lesson with submissions is refused with "Unpublish it instead"; unpublishing hides it from students.
  (e2e) ✓ e2e-smoke
- [x] Leaving the material editor with unsaved changes asks to confirm. ✓ browser check

### Phase 2: modes, exams, practice, solutions

- [x] A lesson has two assignments; both show in its assignments block and in `/assignments`. (e2e) ✓ e2e-smoke (homework, exam and practice in one lesson) + browser check
- [x] Exam before the window: countdown, no statement in the response, trial attempt accepted and shown as "Trial
  received"; a fourth trial is refused (`trial_limit`); no trial block once the window opens; the trial isn't in the
  mentor's queue. (e2e) ✓ e2e-smoke + browser check
- [x] Exam inside the window: statement visible, one submission after a confirm; a second answers "already
  submitted". After the window: "Missed" for a student who didn't submit. (e2e with a short window) ✓ e2e-smoke (25 s window, 2-minute grace) + browser check (confirm, "Submitted at")
- [x] The page opens the statement within seconds of the window opening without a manual reload. ✓ browser check
- [x] Practice: unlimited submissions; the solution appears right after the first; practice isn't in the queue
  unless "Include practice" is on. (e2e) ✓ e2e-smoke + browser check
- [x] Accepted formats and limits shape the form (files-only exam shows no text or links; 1 PDF max). (e2e) ✓ e2e-smoke (text refused) + browser check (no text or link fields, `accept=".pdf"`)
- [x] An `after_due` solution shows "Solution opens {date}" before and the material after; a `manual` one opens
  only after "Release now" in that cohort and stays hidden in another cohort. (e2e) ✓ e2e-smoke: `manual` released in one cohort, hidden in another; `after_due` open for a homework whose due day passed (cohort started 7 days ago, 1-day offset), locked for a 30-day one.
- [x] Exam review offers Accept (with score when set) and no "Request changes". ✓ browser check + e2e-smoke (`review_decision_not_allowed`, score 8 saved)
- [x] Changing an exam's window after it opened in a cohort shows the field error. ✓ browser check (assignment editor and cohort override)
- [x] Exam times show in the cohort timezone with the label, plus the viewer's time when different. ✓ browser check (viewer in Europe/Berlin)
- [x] Old `/assignments/{c}-{l}` links redirect to the new page. ✓ e2e-smoke + browser check
- [x] No Nitro route calls `/lessons/{l}/assignment`, `/cohorts/{c}/lessons/{l}/assignment` or
  `/cohorts/{c}/lessons/{l}/submissions` (grep), so the backend can drop them in the same release. ✓ grep
- [x] A head overrides one cohort's exam window; a mentor without editor rights sees Solutions read-only. ✓ e2e-smoke (override) + browser check (mentor read-only)

### Phase 3: navigation and polish

- [x] Materials by type lists, e.g., all lecture notes of released lessons, grouped by module, with locked ones
  muted. (e2e) ✓ e2e-smoke + browser check
- [x] The calendar shows each week's lessons, due dates and exam windows, current week marked. (e2e) ✓ e2e-smoke + browser check
- [x] Prev / next walk across module boundaries and skip locked lessons for students. ✓ e2e-smoke + browser check
- [x] ⌘K in a course finds lessons and materials by title and text, never an unreleased one. ✓ e2e-smoke (draft, locked solution) + browser check

### All phases

- [x] Every code in the error table has `en` and `ru` messages and shows as the table says (key check script). ✓ key check (`validation_error` shows the API's field message, as the table says)
- [ ] Keyboard only: contents sidebar, reorder buttons, editor toolbar, submit form and exam confirm are usable;
  focus is visible.
- [ ] Phone viewport (390 px): no sideways page scroll on course, lesson, assignment and editor pages.

## Known gaps

- [O22](../open-items.md) cohort timezone for exam times (backend D5): must be decided before Phase 2 starts.
- [O24](../open-items.md) exam and practice reviews: accept / score only (backend decision 19, PO to confirm).
- [O26](../open-items.md) concurrent edits: last write wins, no versioning or conflict warning.
- [O27](../open-items.md) no "download all" (backend X14).
- [O28](../open-items.md) Drive and Loom sharing can't be checked from the browser.
- No "preview as student" for editors without a cohort: they see the result in the material preview, or through a
  cohort they staff.
- No exam date preview per cohort in the assignment editor (which cohort gets which date); add if mistakes happen.
- Progress stays manual "mark complete" (no auto-complete on viewing or submitting).
- Out of scope: auto-graded quizzes, rubrics, peer review, video upload, content versioning, gradebook, plagiarism,
  offline course zip.

## Phased plan

Same phases, boundaries and dependencies as backend `../backend/spec/content.md`
([Phased implementation plan](../../../backend/spec/content.md#phased-implementation-plan)). No feature flags.

| Phase | Starts when | Release |
|---|---|---|
| 1 | Backend P1 is live and `npm run api:types` is run | After the backend (P1 is additive for the frontend: the singular assignment endpoints keep working) |
| 2 | PO decided D5's cohort timezone ([O22](../open-items.md)) **and** backend P2 is merged (not deployed) with types generated | **Coordinated**: backend P2 and frontend Phase 2 deploy together, because P2 removes `PUT/GET/DELETE /lessons/{l}/assignment`, `GET /cohorts/{c}/lessons/{l}/assignment` and `POST /cohorts/{c}/lessons/{l}/submissions`, which Phase 1 still uses |
| 3 | Backend P3 is live | After the backend |

### Phase 1: materials and reading

**Scope**
- PRODUCT.md / DESIGN.md updates (already proposed in this branch).
- Rendering stack: the five dependencies, `app/utils/markdown.ts`, `MarkdownView`, `.md-body` styles, highlight
  theme; program and course descriptions switch to it (O19).
- `shared/utils/video.ts`, `shared/utils/fileTypes.ts`; file cards; PDF / video / image / link viewers; Nitro file
  routes passing the API's `302` (inline viewing); `POST /api/files` with `purpose`.
- Student: `/courses` (real), course home, lesson page (materials, single assignment row, mark complete), course-level
  pages; home "My courses"; mock removal.
- Homework with files on the singular endpoints: submit form with files + markdown note + links; history and review
  detail show files, all links and rendered markdown.
- Editor: `/courses` editing group, create course, `/editor/[courseId]` (outline with pages, modules, lessons,
  materials, up / down, move, publish, delete guard; settings; editors tab), material editor with `MarkdownEditor`,
  image paste, `.md` upload, video preview; assignment modal with markdown statement.
- Backend in the same phase: materials, course editors, file ownership fix (H10), redirects, upload purposes.

**Done when** all Phase 1 criteria are ticked, `npm run typecheck` passes, e2e smoke extended (course read, complete,
file submission, editor CRUD, editors) passes, and O10, O17, O19, O21, O25 are closed.

### Phase 2: assignments v2

**Prerequisite**: D5's cohort timezone decided by the PO (O22). No fallback to whole-day UTC windows.

**Scope**
- New assignment routes (`/assignments/[cohortId]/[assignmentId]`, redirect from old keys), several per lesson,
  `GET /cohorts/{c}/assignments` (O7); every Nitro route moved off the singular endpoints.
- Modes: homework, exam (window, countdown, statement gating, one attempt, 2-minute grace shown as late, confirm,
  missed), practice (unlimited, solution after first); trial attempt (≤ 3, before the window); accepted formats and
  limits in the form.
- Assignment editor page (mode, statement, attachments, formats, limits, score, due / window, trial, solutions).
- Solutions: `solution_of_id` and release rules in the material editor, solution block on assignment and lesson
  pages, per-cohort "Solutions" (release / hide) and "Exam windows" (override / reset) sections.
- Cohort timezone in the cohort create / edit forms; exam times in the cohort timezone.
- Review: mode chip, exam and practice accept-only (+ score), queue mode filter, attempts and trials history.
- Notifications `exam_opens_soon`, `solution_released`, `review_completed` land on `/assignments/{c}/{a}` (with O14).

**Done when** all Phase 2 criteria are ticked, e2e smoke covers an exam with a short window, a trial, practice and a
manual solution release, the coordinated deploy is done, and O7, O11, O22, O23 are closed.

### Phase 3: navigation and polish

**Scope**
- Materials by type (tag filter), calendar per cohort from `GET /cohorts/{c}/calendar` (week rows), prev / next on
  lesson pages and among course pages, course search in ⌘K from the search endpoint, sidebar polish (remembered
  disclosures, deadline figures).
- Later, if asked: "download all" per lesson (backend X14).

**Done when** all Phase 3 criteria are ticked and the e2e smoke checks the by-type list, calendar rows and search.
