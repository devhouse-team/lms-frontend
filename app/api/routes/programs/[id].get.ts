import type { components } from '~~/shared/types/api'
import type { ProgramDetail } from '~~/shared/types'
import { defineEventHandler, getRouterParam } from '~/api/utils/h3'

type S = components['schemas']

/** Detail, curriculum and cohorts (mentors come with each cohort list item) */
export default defineEventHandler(async (event): Promise<ProgramDetail> => {
  await requireRole(event, 'head')
  const id = apiId(getRouterParam(event, 'id'))
  const [p, cohorts, access] = await Promise.all([
    apiFetch<S['ProgramRead']>(event, `/programs/${id}`),
    listCohorts(event, { program_id: id }),
    myAccess(event)
  ])
  const rules = programRules(access)
  // A lead without admin rights manages only their own programs; the rest reads as missing, like the API's drafts
  if (!rules.edit(p)) throw createError({ statusCode: 404, statusMessage: 'program_not_found' })
  return {
    ...programRow(p),
    description: p.description,
    weeksOfContent: p.weeks_of_content,
    courses: p.courses.map(programCourse).sort((a, b) => a.position - b.position),
    cohorts: programCohorts(cohorts),
    can: { edit: true, manage: rules.manage, createCohort: rules.createCohort(p) }
  }
})
