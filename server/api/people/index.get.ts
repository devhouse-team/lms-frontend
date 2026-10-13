import type { PeopleResponse } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<PeopleResponse> => {
  await requireRole(event, 'head')
  const order = { head: 0, mentor: 1, mentee: 2 }
  return {
    people: db.users
      .map((u) => {
        const cohort = db.cohorts.find(c => c.id === u.cohortId)
        const mentorCohorts = db.cohorts.filter(c => c.mentorId === u.id)
        return {
          id: u.id,
          name: u.name,
          avatar: u.avatar,
          email: u.email,
          role: u.role,
          cohortId: u.cohortId,
          cohortName: cohort?.name ?? (mentorCohorts.map(c => c.name).join(', ') || undefined),
          programTitle: programTitle(cohort?.program ?? mentorCohorts[0]?.program)
        }
      })
      .sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name, 'ru')),
    invites: db.invites.filter(i => !i.acceptedAt).map(toInvitePublic)
  }
})
