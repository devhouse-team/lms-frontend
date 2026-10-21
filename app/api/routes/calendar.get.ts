import type { components } from '~~/shared/types/api'
import type { CalendarEntry, CalendarView, CalendarWeek } from '~~/shared/types'
import { defineEventHandler, getQuery } from '~/api/utils/h3'

type S = components['schemas']

const DAY = 86_400_000
const dayNo = (d: string) => Math.floor(Date.parse(`${d.slice(0, 10)}T00:00:00Z`) / DAY)
const isoDay = (n: number) => new Date(n * DAY).toISOString().slice(0, 10)

/**
 * A cohort's calendar by week (spec course-content.md, Calendar): `?cohort=`, else my first current cohort (active,
 * then planned). Week 1 starts on the cohort's first day. Cohort-wide: no per-student status (backend decision 30).
 */
export default defineEventHandler(async (event): Promise<CalendarView> => {
  const { user } = await requireUserSession(event)
  const access = await myAccess(event)
  const mine = new Set(user.role === 'head'
    ? []
    : access.cohorts
        .filter(c => (user.role === 'mentee' ? c.relation === 'student' && c.enrollment_status !== 'dropped' : c.relation !== 'student'))
        .map(c => c.cohort_id))
  const current = mine.size
    ? (await listCohorts(event, { status: ['active', 'planned'] })).filter(c => mine.has(c.id)).sort((a, b) => (a.status === b.status ? 0 : a.status === 'active' ? -1 : 1))
    : []
  const cohorts = current.map(c => ({ id: String(c.id), name: c.name }))
  const asked = getQuery(event).cohort
  if (!asked && !current.length) return { cohort: null, cohorts, weeks: [] }
  const cohortId = asked ? apiId(String(asked)) : current[0]!.id

  const [c, items, courses] = await Promise.all([
    apiFetch<S['CohortRead']>(event, `/cohorts/${cohortId}`),
    apiFetch<S['CalendarItem'][]>(event, `/cohorts/${cohortId}/calendar`),
    apiFetch<S['CohortCourseRead'][]>(event, `/cohorts/${cohortId}/courses`)
  ])
  const staff = !access.cohorts.some(x => x.cohort_id === cohortId && x.relation === 'student')
  const titles = new Map(courses.filter(r => r.course.is_published).map(r => [r.course_id, r.course.title]))

  // Week 1 starts on the cohort's first day. The API's default range is the cohort's dates, so nothing comes before
  // it; an item after the last day (a date local to the cohort's zone) adds weeks rather than landing in the last one.
  const start = dayNo(c.starts_on)
  const weekOf = (d: string) => Math.floor((dayNo(d) - start) / 7) + 1
  const total = Math.max(1, Math.ceil((dayNo(c.ends_on) - start + 1) / 7), ...items.map(it => weekOf(it.date)))
  const lastDay = Math.max(dayNo(c.ends_on), start + total * 7 - 1)
  const weeks: CalendarWeek[] = Array.from({ length: total }, (_, i) => ({
    n: i + 1,
    from: isoDay(start + i * 7),
    to: isoDay(Math.min(start + i * 7 + 6, lastDay)),
    opens: [],
    due: [],
    exams: []
  }))

  const to = (it: S['CalendarItem']) => {
    if (it.type === 'module_opens') return coursePath(cohortId, it.course_id)
    if (it.type === 'solution_release') return materialPath(cohortId, it.course_id, it.material_id!, it.lesson_id)
    return workPath(cohortId, it.course_id, staff, it.assignment_id!, it.lesson_id)
  }
  const sorted = [...items].sort((a, b) => (a.at ?? a.date).localeCompare(b.at ?? b.date))
  for (const it of sorted) {
    const courseTitle = titles.get(it.course_id)
    if (!courseTitle) continue // an unpublished course of the cohort
    const entry: CalendarEntry = { type: it.type, title: it.title, courseTitle, date: it.date, at: it.at ?? null, endsAt: it.ends_at ?? null, to: to(it) }
    const w = weeks[Math.max(1, weekOf(it.date)) - 1]!
    ;(it.type === 'due' ? w.due : it.type === 'exam_window' ? w.exams : w.opens).push(entry)
  }

  return {
    cohort: {
      id: String(c.id),
      name: c.name,
      status: c.status,
      timezone: c.timezone,
      // Today as a day in the cohort's zone (en-CA formats as YYYY-MM-DD)
      week: c.status === 'active' ? Math.min(total, Math.max(1, weekOf(new Intl.DateTimeFormat('en-CA', { timeZone: c.timezone }).format(new Date())))) : null
    },
    cohorts,
    weeks
  }
})
