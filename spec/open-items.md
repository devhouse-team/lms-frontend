# Open items

Known gaps and undecided questions. Backend items are mirrored in `../backend/spec/open-items.md`.

| # | Item | Owner | Blocks | Notes |
|---|---|---|---|---|
| O1 | Production role ids for `admin` and `mentor` | BE | Invites in prod | No roles endpoint; ids are per database (local had 3/4). Set `NUXT_PUBLIC_ROLE_IDS_*`, or BE adds `GET /roles`. |
| O2 | ~~No student role to invite with~~ | PO + BE | | Decided 2026-10-18: students are invited into a cohort (cohort invites; backend domain.md "Invites", closes D4). Built 2026-10-18: [invites](features/invites.md). Closed. |
| O3 | Login lockout and registration limits per IP see Vercel's IP | BE + Ops | Pilot at scale | Nitro sends `X-Forwarded-For`; the API must trust it (`TRUSTED_PROXY_HOPS`) and be reachable only via trusted proxies. Backend D1. |
| O4 | Deleting an assignment deletes its submissions | BE | | The frontend refuses while submissions exist; the API should too. |
| O5 | ~~Invites: no preview, copy-link or revoke~~ | BE + FE | | Backend adds `GET /invites/preview`, `DELETE /invites/{id}`, `POST /invites/{id}/resend`. Built 2026-10-18: [invites](features/invites.md). No copy-link (by design). Closed. |
| O6 | `GET /users/` has no roles | BE | | People roles are derived from cohort relations; non-superuser admins can't be shown as head. |
| O7 | One API call per lesson to find assignments | BE | Large cohorts | Roster fan-out is done by `GET /cohorts/{c}/roster`; assignments per lesson are still open. `GET /cohorts/{c}/assignments` is in backend content.md and [course content](features/course-content.md) Phase 2. |
| O8 | ~~`/verify-email` and `/reset-password` pages~~ | FE | | Done: [account-recovery](features/account-recovery.md). |
| O9 | At-risk rule is a placeholder | PO | | Active, 3+ lessons opened, under half completed. |
| O10 | No course authoring UI | FE + PO | Assignments | Courses, modules, lessons and attaching courses to cohorts are API-only for now. Specced: [course content](features/course-content.md) Phase 1 (course editor, editors per course). |
| O11 | Staff can't see earlier submission attempts | BE | | Review detail shows no history. Course content Phase 2: `SubmissionDetail.versions[]` and `trials[]` (backend content.md). |
| O12 | Mock features lose state on Vercel | FE | | See [mock features](features/mock-features.md). |
| O13 | ~~One mentor per cohort in the UI~~ | PO | | Decided 2026-10-16: several mentors and reviewers, a mentor per student. See [cohorts](features/cohorts.md). |
| O14 | ~~Notification links point at paths that don't exist~~ | FE + BE | | Built 2026-10-19, closed: [notifications](features/notifications.md) (bell, panel, `/notifications`, email switches). `fixLink()` rewrites `/mentor/submissions/{id}` → `/reviews/{id}`, `/app/cohorts/{c}/courses/{course}` → `/courses/{c}/{course}`, `/app/cohorts/{c}/lessons/{l}` → `/assignments/{c}-{l}` in the list, and a server middleware 302s the same paths for links in emails. BE should still send the real paths and add `assignment_id` to `deadline.soon` (O29). Close when built. |
| O15 | No cohort capacity, timezone or reopening finished cohorts | PO | | Deliberately out of v2 (backend D5 for timezone). |
| O16 | ~~`/programs` shows one mentor per cohort~~ | FE | | Programs v2 spec lists all mentors (from the cohort list item's `mentors`). |
| O17 | No student lesson screen | FE | | "Mark complete" in a finished cohort has no UI to disable yet. Specced: [course content](features/course-content.md) Phase 1. |
| O18 | ~~Program leads picking people~~ | PO + BE | | Decided 2026-10-16 (backend D11): leads may call `GET /users/`; built in the API. |
| O19 | Program description is markdown but shown as plain text | FE | | Specced: `MarkdownView` in [course content](features/course-content.md#rendering-stack) Phase 1. |
| O20 | Orphan cover uploads | BE | | A cover uploaded then cancelled stays in storage (backend H2). |
| O21 | ~~Markdown images need unresolved `file:<id>` references~~ | BE + FE | | Decided 2026-10-16 with the backend: bodies stay raw, reads carry file metadata, bytes come from `302` redirect endpoints (e.g. `GET /cohorts/{c}/materials/{m}/files/{f}`) proxied by Nitro; no signed URL in a page. [Files and viewers](features/course-content.md#files-and-viewers). |
| O22 | Cohort timezone for exam times | PO + BE | **Start of** course content Phase 2 | Backend D5 is UTC; backend content.md adds `cohorts.timezone` (IANA, default `Asia/Almaty`, editable while planned) for exam times. PO must confirm before Phase 2 starts (both specs); no whole-day fallback. Day-based dates stay UTC until D5's day part is decided. |
| O23 | Exam window grace for uploads in progress | PO + BE | | Specced in backend content.md: the API accepts until `closes_at` + 2 minutes, flagged `is_late`; the UI hides the form at `closes_at`. Closes with Phase 2. |
| O24 | Exam review decisions | PO | | Both specs (backend decision 19): exams and practice accept only (`approved` with score / feedback), never sent back (`review_decision_not_allowed`). PO to confirm. |
| O25 | `.ipynb` and code files | BE | Course content Phase 1 | Specced: backend content.md adds `application/x-ipynb+json` and `text/vtt`; code uploads as `text/plain`; the client derives types from extensions. Closes with Phase 1. |
| O26 | Concurrent edits of the same material | PO | | Last write wins; no versioning or "changed by someone else" warning (out of scope). |
| O27 | "Download all" | FE + BE | | Phase 3 search uses the backend's course search (titles and released text). A zip of a lesson's files is later (backend X14). |
| O28 | Drive and Loom videos need link sharing | PO | | Can't be checked from the browser; the editor shows a hint. |
| O29 | Notification texts from the API | BE + PO | | Links fixed in the backend on 2026-10-19 (real app paths; `deadline.soon` carries `assignment_id`); `fixLink` stays for rows created before. Still open: titles/bodies are English-only without parameters to translate (backend D8). |
| O30 | OAuth-only accounts and email change | BE | | Changing email needs the current password; `UserRead` has no `has_password`, so the profile can't hide the form for accounts without one. |
| O31 | Server-side paging for large cohorts | BE + FE | Cohorts over a few hundred students | The roster, assignments and solutions come in one call each and page on the client (`usePaged`); fine for cohort sizes today. If a cohort grows to hundreds, the API needs `limit` / `offset` on `GET /cohorts/{c}/roster` and the UI moves the page into the query. |
| O32 | Bulk course plan import | BE + FE | Course wizard import (stage 4) | No endpoint takes a parsed plan. Backend to build `POST /courses/{c}/import`: contract in [plan-import-api](features/plan-import-api.md). The frontend import tab is built and waits for it; until then it checks syntax only and Apply is off. See [setup-flow](features/setup-flow.md#plan-import-course-wizard-structure-step). |
| O33 | Per-course length in the program curriculum | BE + FE | Program wizard schedule | `ProgramCourseRead` has no length, so the schedule step reads every course's outline to draw its bar. Backend to add `content_weeks`: [program-course-weeks-api](features/program-course-weeks-api.md). The frontend then drops those requests. |
