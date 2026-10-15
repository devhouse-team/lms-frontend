import type { components } from '~~/shared/types/api'
import type { PeopleResponse, PersonRow, Role } from '~~/shared/types'

type S = components['schemas']

async function allUsers(event: Parameters<typeof apiFetch>[0]) {
  const users: S['UserRead'][] = []
  for (let page = 1; ; page++) {
    const res = await apiFetch<S['PaginatedListResponse_UserRead_']>(event, '/users/', { query: { page, items_per_page: 100 } })
    users.push(...res.data)
    if (!res.has_more || !res.data.length) return users
  }
}

/** The API's user list has no roles; the UI role comes from cohort relations */
export default defineEventHandler(async (event): Promise<PeopleResponse> => {
  await requireRole(event, 'head')
  const [users, cohorts, invites] = await Promise.all([allUsers(event), listCohorts(event), pendingInvites(event)])
  const relations = await Promise.all(cohorts.map(async (c) => {
    const [staff, roster] = await Promise.all([listStaff(event, c.id), apiFetch<S['RosterEntry'][]>(event, `/cohorts/${c.id}/enrollments`)])
    return { cohort: c, staff, roster }
  }))

  const order: Record<Role, number> = { head: 0, mentor: 1, mentee: 2 }
  const people = users.filter(u => !u.is_deleted).map((u): PersonRow => {
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
  })
  people.sort((a, b) => (a.role ? order[a.role] : 3) - (b.role ? order[b.role] : 3) || a.name.localeCompare(b.name, 'ru'))
  return { people, invites }
})
