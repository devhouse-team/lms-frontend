---
name: dev.house LMS
description: Mentor-led learning workspace for dev.house academy. Dark, dense, and quiet, with one yellow signal for what needs you now.
colors:
  signal-yellow: "#FFC700"
  signal-yellow-deep: "#E6B200"
  signal-yellow-ink: "#211900"
  graphite-night: "#1A1A1A"
  graphite-rail: "#1D1D1D"
  graphite-raised: "#232323"
  graphite-pressed: "#2C2C2C"
  hairline: "#2E2E2E"
  hairline-faint: "#262626"
  hairline-strong: "#3D3D3D"
  text-highlighted: "#F5F5F4"
  text-default: "#DCDCDF"
  text-toned: "#BCBCC0"
  text-muted: "#9C9CA0"
  text-dimmed: "#77777A"
  status-done: "#34D399"
  status-risk: "#F87171"
  status-warning: "#FBBF24"
typography:
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  section:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.43
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
  figure:
    fontFamily: "Geist Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  countdown:
    fontFamily: "Geist Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "1.875rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
rounded:
  pill: "4px"
  control: "6px"
  panel: "8px"
spacing:
  row-y: "12px"
  row-x: "16px"
  rail: "16px"
  panel: "24px"
  section: "32px"
  column-gap: "40px"
components:
  button-primary:
    backgroundColor: "{colors.signal-yellow}"
    textColor: "{colors.graphite-night}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  button-primary-hover:
    backgroundColor: "{colors.signal-yellow-deep}"
    textColor: "{colors.graphite-night}"
  button-soft:
    backgroundColor: "{colors.signal-yellow-ink}"
    textColor: "{colors.signal-yellow}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  button-outline:
    backgroundColor: "{colors.graphite-night}"
    textColor: "{colors.text-highlighted}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  list-row:
    backgroundColor: "{colors.graphite-night}"
    textColor: "{colors.text-highlighted}"
    padding: "12px 16px"
  list-row-hover:
    backgroundColor: "{colors.graphite-raised}"
  next-up-panel:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.text-highlighted}"
    rounded: "{rounded.panel}"
    padding: "24px"
  input:
    backgroundColor: "{colors.graphite-night}"
    textColor: "{colors.text-highlighted}"
    rounded: "{rounded.control}"
    height: "40px"
  status-in-progress:
    backgroundColor: "{colors.signal-yellow-ink}"
    textColor: "{colors.signal-yellow}"
    rounded: "{rounded.pill}"
    height: "28px"
---

# Design System: dev.house LMS

## Overview

**Creative North Star: "The Night Shift Desk"**

The dev.house mentors are working engineers who mentor after hours, and their students study around jobs and university. The interface is the desk they sit at in the evening: a dark graphite surface, everything in reach, nothing shouting. A single desk lamp, Signal Yellow, lights the one thing that needs you now: the next deadline, the oldest unreviewed submission, the primary action. Everything else stays in the half-light of neutral greys until it is needed.

Density is a feature. Mentors scan rosters and review queues; students scan what's next. Information sits in ruled lists and tables with hairline dividers rather than in cards, and figures (times, counts, weeks, dates) are set in Geist Mono with tabular numerals, so columns of numbers line up like a ledger. Depth comes from tone, not shadow. Motion is short and only reports state.

The world inherits the dev.house marketing site (dark ground, `#FFC700`, Geist) and the four-point star logo. It rejects the generic course-catalogue look (grids of same-size cards with stock illustrations) and gamification (streaks, XP, badges, confetti).

**Key Characteristics:**
- Dark-first graphite ground, tonal layering instead of shadows
- One yellow signal per view; status is a tint, never a heavy fill
- Ruled lists and tables over card grids
- Geist for words, Geist Mono for every figure
- Main column plus a quiet right-hand context rail
- Flat, exact controls with hairline rings and visible focus

## Colors

A near-monochrome graphite palette with one saturated signal colour and a small semantic set for status.

### Primary
- **Signal Yellow**: the dev.house brand yellow. Used for the single primary action on a view (Open, Sign in, Create account, Invite), the active navigation item, the focus ring, text selection, the caret, and time values that have become urgent (under 24h to a deadline, over 48h waiting for review).
- **Signal Yellow Deep**: hover and pressed state of the primary button.
- **Signal Yellow Ink**: the dark yellow-tinted wash behind soft buttons and the "in progress" status, so yellow can appear as a tint without becoming a second lamp.

### Neutral
- **Graphite Night**: the page ground, matching the marketing site.
- **Graphite Rail**: sidebar and muted surfaces; the second neutral layer.
- **Graphite Raised**: the one raised panel per view (Next up), row hover, dropdowns.
- **Graphite Pressed**: selected segment in segmented controls, the "not started" status.
- **Hairline / Hairline Faint / Hairline Strong**: dividers between rows, panel rings, and stronger rings on interactive controls.
- **Text Highlighted**: headings, row titles, values.
- **Text Default / Text Toned**: body copy and secondary values.
- **Text Muted**: labels, metadata, helper text.
- **Text Dimmed**: decorative-level hints only (chevrons, empty markers, dev notes). It sits at about 4:1 on Graphite Night, so it never carries information a user must read.

### Semantic
- **Status Done** (emerald): completed courses and career steps, as a subtle tint with a matching ring.
- **Status Risk** (red): "falling behind" badges, expired invites, at-risk counts, and errors.
- **Status Warning** (amber): structural gaps, such as a cohort with no mentor.

### Named Rules
**The One Lamp Rule.** Only one element per view is filled solid Signal Yellow: the next step. Every other use of yellow is text, a ring, or the Signal Yellow Ink tint.

**The Status-Is-A-Tint Rule.** Status (in progress, done, at risk, overdue) is shown as a tinted background with matching text and a 1px inset ring, never as a solid fill.

**The Never-Colour-Alone Rule.** Every coloured status also carries a word or an icon ("> 48 ч", "Отстаёт", a check), so meaning survives without colour.

## Typography

**Body Font:** Geist (fallback: ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica Neue, Arial), loaded with the Cyrillic subset.
**Figure Font:** Geist Mono (fallback: ui-monospace, SF Mono, Menlo), with tabular numerals.

**Character:** One neutral, engineered sans carries every word; its mono sibling carries every number. The pairing reads like an engineer's notebook: plain prose next to aligned figures.

### Hierarchy
- **Headline**: the Next up title, the only large type on a home screen. Balanced wrapping.
- **Title**: page greeting ("Привет, Алия", "Академия") and auth screen titles (auth titles use 1.5rem).
- **Section**: section headings above lists and rail sections. Small and bold, never uppercase, never preceded by an eyebrow label.
- **Body**: row titles, form text, descriptions. Prose blocks cap at 65ch.
- **Label**: badges, status segments, metadata lines.
- **Figure**: every time, count, week, date and percentage, in Geist Mono with tabular numerals.
- **Countdown**: the time-left figure inside Next up; turns Signal Yellow when under 24h.

### Named Rules
**The Mono-For-Figures Rule.** If it is a number, a date or a duration, it is set in Geist Mono with tabular numerals. Mono is never used for prose or for "technical" decoration.

**The Small Section Rule.** Section headings are 14px semibold. Hierarchy comes from the content's own weight (the Next up headline, the queue), not from big section titles.

## Layout

The app shell is a collapsible left sidebar (logo, ⌘K search button, role navigation, account menu in the footer) beside a scrolling dashboard panel with a slim top bar.

Home screens use a **main column plus context rail** grid: a fluid main column and a fixed 20rem rail, separated by a 40px column gap, inside a 72rem container (the head of academy's table view widens to 80rem). The rail is sticky on desktop. Below the `lg` breakpoint (1024px), or `xl` (1280px) for the head view, the grid collapses to a single column with the rail sections stacked after the main content.

Vertical rhythm is 32px between sections and 12px between a section heading and its content. Rows use 12px × 16px padding; rail sections 16px; the Next up panel 20px on mobile and 24px from `sm`. Wide tables scroll horizontally inside their ring rather than squeezing columns.

**The Main-And-Rail Rule.** The main column holds what you act on; the rail holds context about who and when (mentor, cohort, contest, career, invites, load). New role homes follow the same split.

## Elevation & Depth

The system is flat. There are no box shadows on panels, rows or cards. Depth is tonal: Graphite Night for the ground, Graphite Rail for the sidebar, Graphite Raised for the single emphasised panel and for hover, Graphite Pressed for selection. Edges are 1px inset rings in the hairline colours. Overlays (dropdowns, the ⌘K palette, toasts) use Nuxt UI's default overlay treatment.

**The Tone-Not-Shadow Rule.** To lift something, move it one step up the graphite ladder and give it a hairline ring. Never add a drop shadow or glow.

## Shapes

Corners are small and consistent: 4px for status pills and segments, 6px for controls (buttons, inputs, segmented-control frame), 8px for panels and list frames. Avatars are circles. Lists are one rounded frame with hairline dividers inside, never a stack of separately rounded cards. The brand four-point star appears only as the logo mark.

## Components

The feel is quiet and exact: hairline rings, flat surfaces, no shadows. Only the next step gets solid yellow.

### Buttons
- **Shape:** gently squared (6px).
- **Primary:** Signal Yellow fill with Graphite Night text. One per view.
- **Soft:** Signal Yellow text on the Signal Yellow Ink wash, for secondary calls to action in the rail (e.g. "Записаться").
- **Outline / Ghost (neutral):** hairline ring or no ring, highlighted text. Used for cancel, retry, "coming soon" links, and the Telegram sign-in button.
- **Hover / Focus:** background steps one shade; focus shows a 2px Signal Yellow outline with 2px offset. Transitions are 150ms ease-out on colour only.

### List Rows (signature)
- **Frame:** one 8px-rounded frame with a hairline ring, rows separated by hairline dividers.
- **Row:** leading icon or avatar, a truncating title (with an optional muted second line), trailing figures in Geist Mono, a trailing chevron that nudges 2px right on hover.
- **Hover:** row background moves to Graphite Raised in 150ms.
- **Emphasis:** the first row of a priority queue (e.g. the oldest review) gets slightly larger type and padding instead of a different colour.

### Next Up Panel (signature)
The single raised panel on the mentee home: Graphite Raised with a hairline ring, a kind badge and a date figure, the headline title, the countdown, and the one primary button.

### Course Status Control (signature)
A three-way segmented radio group (Не начат / В процессе / Пройден) in a muted frame. Selected states: Graphite Pressed for not started, Signal Yellow Ink tint with a yellow ring for in progress, and an emerald tint with an emerald ring for done. Arrow keys move the selection; labels collapse to icons below `sm` but stay available to screen readers.

### Status Badge
One vocabulary for assignment and submission state across all roles: Не сдано (neutral, dashed circle), На ревью (primary tint, hourglass), На доработку (error tint, rotate-ccw), Принято (success tint, check). Always icon + word + tint.

### Submission History
A ruled list of attempts, newest first. Each entry: status badge, sent time in Geist Mono, the work link (host + path, external arrow), the student's note, and the mentor's feedback in a Graphite Rail inset with the reviewer's avatar, name and time.

### Roster and Leaderboard Tables
Plain semantic tables inside a hairline frame: avatar + name with the email in Geist Mono beneath, right-aligned figure columns (accepted/total, done/total, waiting), and a single "Отстаёт" badge in the last column. The contest leaderboard uses competition ranking (1, 1, 3) with places 1–3 in highlighted text, and tints the viewer's own row with a 10% Signal Yellow wash plus a "вы" marker.

### Chips / Badges
Small 4px-rounded labels. Neutral subtle for kinds ("Задание"), primary subtle for counts and overdue flags ("2 новых", "> 48 ч"), error subtle for "Отстаёт", warning subtle for "Нет ментора", and a neutral outline for "Демо-данные".

### Inputs / Fields
Nuxt UI inputs at the large size (40px), 6px corners, hairline ring on Graphite Night. Labels sit above, help text below, hint text right-aligned on the label line. Focus is the Signal Yellow ring. Errors appear inline under the field in Status Risk and as a subtle error alert above the submit button.

### Navigation
Vertical sidebar menu with lucide icons at 16px; the active item gets a raised background with Signal Yellow icon and label. The sidebar collapses to icons with tooltips; on mobile it becomes a slide-over opened from the top-bar menu button. The account menu in the footer shows avatar, name and role, and holds language and sign-out.

### Tables
Nuxt UI table inside a hairline frame: muted 12px headers with ghost sort buttons, 14px cells, figure columns in Geist Mono, and empty values shown as a dimmed "—". Hover tints the row.

## Do's and Don'ts

### Do:
- **Do** keep exactly one solid Signal Yellow element per view: the next step.
- **Do** set every number, date and duration in Geist Mono with tabular numerals.
- **Do** group items in one ruled list frame with hairline dividers.
- **Do** pair every status colour with a word or icon.
- **Do** turn time figures yellow only when they cross a real threshold (under 24h to a deadline, over 48h waiting).
- **Do** use skeletons for loading and empty states that tell the user what to do next.
- **Do** theme browser surfaces from the palette: yellow selection, caret and focus ring, graphite scrollbars.

### Don't:
- **Don't** build pages from grids of same-size cards with stock illustrations; this is not a course catalogue.
- **Don't** add gamification: streaks, XP, badges, confetti.
- **Don't** add drop shadows or glows; use the graphite ladder and hairline rings.
- **Don't** put an eyebrow or kicker label above a heading.
- **Don't** fill status pills solid; status is always a tint plus a ring.
- **Don't** use Text Dimmed for anything a user must read.
- **Don't** use Geist Mono for prose or as a "techy" costume.
- **Don't** use a modal where an inline control works (course status, contest registration).
