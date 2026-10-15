import type { components } from '~~/shared/types/api'
import type { ProgramView } from '~~/shared/types'
import { programs as syllabus } from '../../data/programs'

export default defineEventHandler(async (event): Promise<ProgramView[]> => {
  await requireRole(event, 'head')
  const [list, cohorts] = await Promise.all([
    apiFetch<components['schemas']['ProgramRead'][]>(event, '/programs/'),
    listCohorts(event)
  ])
  const mentors = new Map(await Promise.all(cohorts.map(async c => [c.id, cohortMentor(await listStaff(event, c.id))?.name] as const)))
  return list.map((p) => {
    const known = syllabus.find(s => s.slug === p.slug)
    return {
      id: String(p.id),
      slug: p.slug,
      title: p.title,
      months: known?.months ?? 0,
      modules: known?.modules ?? [],
      cohorts: cohorts.filter(c => c.program_id === p.id).map(c => ({ id: String(c.id), name: c.name, mentees: c.active_students, mentor: mentors.get(c.id) }))
    }
  })
})
