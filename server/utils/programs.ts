import type { H3Event } from 'h3'
import { z } from 'zod'
import type { components } from '~~/shared/types/api'
import type { ProgramCohort, ProgramCourse, ProgramRow, ProgramSummary } from '~~/shared/types'

/** Programs v2 mapping and rules (spec programs.md). The API checks every call; `can` only hides what it would refuse. */

type S = components['schemas']

/** What the caller may do with programs, from /me/access */
export function programRules(a: S['MyAccess']) {
  const has = (p: string) => a.is_superuser || a.permissions.includes(p)
  const leads = (p: { lead: S['PersonRef'] | null }) => p.lead?.id === a.user_id
  return {
    create: has('program.create'),
    /** Status actions, delete, lead, order */
    manage: has('program.update'),
    leads,
    edit: (p: { lead: S['PersonRef'] | null }) => has('program.update') || leads(p),
    createCohort: (p: S['ProgramListItem']) => p.status === 'active' && (has('cohort.create') || leads(p))
  }
}

export const programRow = (p: S['ProgramListItem']): ProgramRow => ({
  id: String(p.id),
  slug: p.slug,
  title: p.title,
  status: p.status,
  durationWeeks: p.duration_weeks,
  position: p.position,
  coverUrl: p.cover_url,
  lead: p.lead ? person(p.lead) : null,
  courseCount: p.course_count,
  cohortCounts: p.cohorts,
  activeStudents: p.active_students,
  updatedAt: p.updated_at
})

export const programCourse = (c: S['ProgramCourseRead']): ProgramCourse => ({
  courseId: String(c.course_id),
  title: c.title,
  published: c.is_published,
  position: c.position,
  startOffsetDays: c.start_offset_days,
  modules: c.modules,
  lessons: c.lessons
})

const STATUS_RANK = { active: 0, planned: 1, finished: 2 } as const

/** Active, planned, finished; newest start first within each */
export const programCohorts = (list: S['CohortListItem'][]): ProgramCohort[] => [...list]
  .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.starts_on.localeCompare(a.starts_on))
  .map(c => ({ id: String(c.id), name: c.name, ...cohortTiming(c), activeStudents: c.active_students, mentors: c.mentors.map(person) }))

/** Programs of the given ids, for read-only blocks (students, mentors); one call per distinct program */
export async function programSummaries(event: H3Event, ids: number[]) {
  const unique = [...new Set(ids)]
  const read = await Promise.all(unique.map(id => apiFetch<S['ProgramRead']>(event, `/programs/${id}`)))
  return new Map(read.map((p): [number, ProgramSummary] => [p.id, { id: String(p.id), title: p.title, description: p.description, coverUrl: p.cover_url }]))
}

const id = z.string().regex(/^\d+$/)
const fields = {
  title: z.string().trim().min(2).max(200),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  description: z.string().max(5000),
  durationWeeks: z.number().int().min(1).max(104),
  coverFileId: id.nullable(),
  leadId: id.nullable()
}

export const programCreateBody = z.object({
  ...fields,
  description: fields.description.default(''),
  coverFileId: id.optional(),
  leadId: id.optional()
}).strict()

/** Only the fields that changed; `null` only clears the cover and the lead */
export const programUpdateBody = z.object(fields).partial().strict()

/** camelCase body → the API's snake_case, skipping absent fields */
export const programApiBody = (b: z.infer<typeof programUpdateBody>) => Object.fromEntries(Object.entries({
  title: b.title,
  slug: b.slug,
  description: b.description,
  duration_weeks: b.durationWeeks,
  cover_file_id: b.coverFileId === undefined ? undefined : b.coverFileId && Number(b.coverFileId),
  lead_id: b.leadId === undefined ? undefined : b.leadId && Number(b.leadId)
}).filter(([, v]) => v !== undefined))
