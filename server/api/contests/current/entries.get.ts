import type { ContestEntry } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<ContestEntry[]> => {
  await requireRole(event, 'head')
  const c = db.contest
  return [...db.contestRegistrations]
    .map(id => db.users.find(u => u.id === id))
    .filter(u => !!u)
    .map(u => ({
      mentee: { id: u.id, name: u.name, avatar: u.avatar },
      cohortName: db.cohorts.find(x => x.id === u.cohortId)?.name ?? '—',
      solved: c.results?.find(r => r.menteeId === u.id)?.solved ?? null
    }))
    .sort((a, b) => a.cohortName.localeCompare(b.cohortName) || a.mentee.name.localeCompare(b.mentee.name, 'ru'))
})
