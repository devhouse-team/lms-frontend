# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Nuxt + Vue 3 + Nuxt UI + Tailwind CSS (user decision). Backend undecided: build against typed mock data first, keep the data layer swappable for a real API later.

## Users

Three roles, one role per account, one app with role-based views (mentee and mentor carry equal weight; head of academy oversees):

- **Students / mentees** in dev.house academy programs (mostly young specialists entering IT or growing in it). Job: follow their program, submit graded work, track progress on external courses, compete in contests, prepare for jobs.
- **Mentors**: working engineers from leading IT companies who run cohorts. Job: guide their cohort, review and grade submissions, see each student's progress at a glance.

- **Head of academy**: oversees all cohorts (progress, at-risk students, mentor load), manages people (invites mentees and mentors, assigns them to cohorts), manages programs and cohorts, and runs LeetCode contests (schedule, results).

## Product Purpose

The LMS for dev.house academy (devhouse.kz), a mentorship academy in Astana, Kazakhstan. It is the working space where mentor-led cohorts happen: students learn, practice, and get reviewed, and mentors guide them. Success means students move through programs into real IT jobs, and mentors spend their time on mentoring rather than admin.

## Positioning

Mentorship-first, not content-first. The core unit is a cohort with an assigned mentor who works at a real IT company. Course content can live anywhere on the web. dev.house adds structure, review, accountability, and career outcomes on top of it.

## Operating Context

- Programs: Frontend Development, Backend Development, Mobile Development, Machine Learning (ML), Algorithms & Data Structures.
- Cohorts (batches) per program, each led by a mentor; 1:1 and/or group sessions.
- Graded practice: assignments, mentor code review, quizzes, coding exercises.
- External courses: a course can be a link to another website. The student tracks status per course as **not started / in progress / done**. There is no hosted video or lesson player for these.
- LeetCode Contest: algorithms and data structures contests every two weeks, with student registration and competition between students.
- Career track: job and interview preparation progress.
- Feature references seen (not visual references): Frappe LMS home, courses list with Published/Upcoming/Created/Unpublished filters, ⌘K jump-to search.

## Capabilities and Constraints

- i18n: Russian primary, English secondary (toggle). Kazakh is not required for now.
- Role-based views for mentee, mentor and head of academy in one app; one role per account.
- Registration is **invite only**: the head sends an invite link; the invitee sets name and password. No public sign-up.
- Login: email + password, and Telegram (Telegram Login Widget once a backend exists).
- Mock-first data layer. The real API shape is undecided.
- Undecided: auth backend, payments/enrollment flow, notifications channel, whether self-paced hosted lessons will ever exist, how contest results are sourced (manual vs LeetCode integration).

## Brand Commitments

- Name: **dev.house** / **dev.house academy**. Domain devhouse.kz.
- Existing tagline on the marketing site: "Making stars out of you on the way to …"
- Existing marketing site is a separate Next.js app. Its visual language is not yet confirmed as binding for the LMS.

## Evidence on Hand

From the dev.house marketing site (claims the business already makes publicly): 5 programs, 100+ students trained, 50+ graduates working at major companies in KZ and abroad, 14 mentors. One real graduate testimonial (Amirzhan Armandiyev, SWE @Meta, ex-@Yandex). Logo: `/images/logos/devhouse-logo2.png` in the marketing site project (not in this repo).
Mentors with real names, credentials and photos (from devhouse-client `src/data/<program>/mentors.ts`, photos in `public/mentors/`): Нұржан Изимбетов, Ерасыл Болат (frontend), Едиге Аширбек (mobile), Даулет Дандыкулов (ML), Абдуррошид Жаңаберген, Алишер Казтаев, Альмансур Максым (algorithms). Backend mentors are not confirmed. Program module titles come from devhouse-client `syllabusItems.ts`. Next mentorship cohort runs 19 Oct 2026 – 19 Apr 2027 (6 months); Algorithms runs 20 Oct 2026 – 1 Jan 2027. Academy contacts: Telegram https://t.me/dev_house_academy, dev.house.academy@gmail.com.
Absent: real course content, student data, contest results. Do not fabricate them; use clearly fake mock data.

## Product Principles

1. **Mentor relationship is the center.** Every student surface should show who their mentor is and what the mentor expects next.
2. **Progress is explicit and honest.** Not started / in progress / done, graded, reviewed. No vanity metrics.
3. **Link out, track in.** External content is welcome. dev.house owns the structure and accountability, not the hosting.
4. **Built for working engineers' time.** Mentors review and grade fast. Dense, scannable views beat decoration.
5. **Outcomes over completion.** Contests and career prep are first-class, not add-ons.
