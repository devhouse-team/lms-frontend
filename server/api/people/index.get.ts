import { toPersonRow } from '../../utils/people'
import type { PeopleResponse } from '~~/shared/types'

/** The API's user list has no roles; the UI role comes from cohort relations */
export default defineEventHandler(async (event): Promise<PeopleResponse> => {
  await requireRole(event, 'head', 'all')
  const [users, relations, invites] = await Promise.all([allUsers(event), cohortRelations(event), pendingInvites(event)])

  const people = users.filter(u => !u.is_deleted).map(u => toPersonRow(u, relations))
  people.sort((a, b) => (a.role ? roleOrder[a.role] : 3) - (b.role ? roleOrder[b.role] : 3) || a.name.localeCompare(b.name, 'ru'))
  return { people, invites }
})
