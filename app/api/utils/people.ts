import type { H3Event } from '~/api/utils/h3'
import type { components } from '~~/shared/types/api'
import type { PersonRow, Role } from '~~/shared/types'

type S = components['schemas']
type ApiUser = S['UserRead']

export async function allUsers(event: H3Event) {
  const users: S['UserRead'][] = []
  for (let page = 1; ; page++) {
    const res = await apiFetch<S['PaginatedListResponse_UserRead_']>(event, '/users/', { query: { page, items_per_page: 100 } })
    users.push(...res.data)
    if (!res.has_more || !res.data.length) return users
  }
}

/** Every cohort with its staff and roster: the API's user list has no roles, so these relations are the source */
export async function cohortRelations(event: H3Event) {
  const cohorts = await listCohorts(event)
  return Promise.all(cohorts.map(async (c) => {
    const [staff, roster] = await Promise.all([listStaff(event, c.id), apiFetch<S['RosterEntry'][]>(event, `/cohorts/${c.id}/enrollments`)])
    return { cohort: c, staff, roster }
  }))
}

export type CohortRelations = Awaited<ReturnType<typeof cohortRelations>>

export const roleOrder: Record<Role, number> = { head: 0, mentor: 1, mentee: 2 }

export function toPersonRow(u: ApiUser, relations: CohortRelations): PersonRow {
  const staffed = relations.filter(r => r.staff.some(s => s.user_id === u.id)).map(r => r.cohort)
  // Current enrollment first: an active one beats a finished or dropped one
  const enrolled = relations
    .flatMap(r => r.roster.filter(e => e.user_id === u.id).map(e => ({ cohort: r.cohort, status: e.status })))
    .sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active'))
  const role: Role | undefined = u.is_superuser ? 'head' : staffed.length ? 'mentor' : enrolled.length ? 'mentee' : undefined
  const cohort = role === 'mentee' ? enrolled[0]!.cohort : undefined
  return {
    id: String(u.id),
    name: u.name,
    avatar: avatarUrl(u.profile_image_url),
    email: u.email,
    username: u.username,
    role,
    cohortId: cohort ? String(cohort.id) : undefined,
    cohortName: cohort?.name ?? (staffed.map(c => c.name).join(', ') || undefined),
    programTitle: cohort?.program_title ?? staffed[0]?.program_title
  }
}
