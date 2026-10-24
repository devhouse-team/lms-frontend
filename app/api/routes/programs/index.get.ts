import type { components } from '~~/shared/types/api'
import type { ProgramList } from '~~/shared/types'
import { defineEventHandler } from '~/api/utils/h3'

type S = components['schemas']

/** Every program the caller sees, in API order (one API call plus /me/access); a lead without admin rights gets only the programs they lead */
export default defineEventHandler(async (event): Promise<ProgramList> => {
  await requireRole(event, 'head')
  const [list, access] = await Promise.all([apiFetch<S['ProgramListItem'][]>(event, '/programs/'), myAccess(event)])
  const rules = programRules(access)
  const visible = rules.manage ? list : list.filter(rules.leads)
  return {
    programs: visible.map(programRow),
    can: { create: rules.create, reorder: rules.manage }
  }
})
