import type { components } from '~~/shared/types/api'
import type { ProgramList } from '~~/shared/types'

type S = components['schemas']

/** Every program the caller sees, in API order; a lead without admin rights gets only the programs they lead */
export default defineEventHandler(async (event): Promise<ProgramList> => {
  await requireRole(event, 'head')
  const [list, access] = await Promise.all([apiFetch<S['ProgramListItem'][]>(event, '/programs/'), myAccess(event)])
  const rules = programRules(access)
  const visible = rules.manage ? list : list.filter(rules.leads)
  // ponytail: one GET /programs/{p} per program for the course count; drop once ProgramListItem carries it
  const courseCounts = await Promise.all(visible.map(p => apiFetch<S['ProgramRead']>(event, `/programs/${p.id}`).then(d => d.courses.length)))
  return {
    programs: visible.map((p, i) => programRow(p, courseCounts[i]!)),
    can: { create: rules.create, reorder: rules.manage }
  }
})
