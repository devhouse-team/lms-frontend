import { toPersonRow } from '../../utils/people'
import type { PersonDetail, PersonEnrollment, PersonStaffing } from '~~/shared/types'

/** One person with their whole cohort history; resolved from the user list because the API has no lookup by id */
export default defineEventHandler(async (event): Promise<PersonDetail> => {
  await requireRole(event, 'head', 'all')
  const id = apiId(getRouterParam(event, 'id'))
  const [users, relations] = await Promise.all([allUsers(event), cohortRelations(event)])
  const user = users.find(u => u.id === id && !u.is_deleted)
  if (!user) throw createError({ statusCode: 404, statusMessage: 'user_not_found' })

  const enrollments: PersonEnrollment[] = await Promise.all(relations
    .flatMap(r => r.roster.filter(e => e.user_id === id).map(e => ({ r, e })))
    .sort((a, b) => Number(isCurrent(b.e.status)) - Number(isCurrent(a.e.status)) || b.e.status_changed_at.localeCompare(a.e.status_changed_at))
    .map(async ({ r, e }) => {
      const mentor = isCurrent(e.status) ? await studentMentor(event, r.cohort.id, String(id)) : undefined
      return {
        cohortId: String(r.cohort.id),
        cohortName: r.cohort.name,
        programTitle: r.cohort.program_title,
        status: e.status,
        since: e.status_changed_at,
        mentor: mentor ? person(mentor) : undefined
      }
    }))

  const staffIn: PersonStaffing[] = relations
    .flatMap(r => r.staff.filter(s => s.user_id === id).map(s => ({
      cohortId: String(r.cohort.id),
      cohortName: r.cohort.name,
      programTitle: r.cohort.program_title,
      role: s.role
    })))

  return {
    ...toPersonRow(user, relations),
    emailVerified: user.email_verified,
    isSuperuser: user.is_superuser,
    enrollments,
    staffIn
  }
})
