import type { MeCohort, MeProfile } from '~~/shared/types'
import type { components } from '~~/shared/types/api'
import { defineEventHandler } from '~/api/utils/h3'

/** The signed-in user's own account: profile from `/users/me`, roles and cohorts from `/me/access` */
export default defineEventHandler(async (event): Promise<MeProfile> => {
  const { user } = await requireUserSession(event)
  const [me, access] = await Promise.all([apiFetch<components['schemas']['UserRead']>(event, '/users/me'), myAccess(event)])
  const cohorts = access.cohorts
    .filter((c): c is typeof c & { relation: MeCohort['relation'] } => ['student', 'mentor', 'reviewer'].includes(c.relation))
    .map((c): MeCohort => ({
      cohortId: String(c.cohort_id),
      cohortName: c.cohort_name,
      relation: c.relation,
      enrollment: c.relation === 'student' ? (c.enrollment_status as MeCohort['enrollment']) ?? undefined : undefined
    }))
  return {
    id: String(me.id),
    name: me.name,
    avatar: avatarUrl(me.profile_image_url),
    email: me.email,
    username: me.username,
    emailVerified: me.email_verified,
    roles: user.roles,
    cohorts,
    ledPrograms: access.programs.filter(p => p.relation === 'lead').map(p => ({ id: String(p.program_id), title: p.title }))
  }
})
