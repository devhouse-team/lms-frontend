import type { ProgramView } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<ProgramView[]> => {
  await requireRole(event, 'head')
  return db.programs.map(p => ({
    ...p,
    cohorts: db.cohorts.filter(c => c.program === p.slug).map(c => ({
      id: c.id,
      name: c.name,
      mentees: db.users.filter(u => u.cohortId === c.id).length,
      mentor: db.users.find(u => u.id === c.mentorId)?.name
    }))
  }))
})
