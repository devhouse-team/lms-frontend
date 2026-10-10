import type { AssignmentListItem } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<AssignmentListItem[]> => {
  const user = await requireRole(event, 'mentee')
  return db.assignments
    .filter(a => a.cohortId === user.cohortId)
    .sort((a, b) => a.dueAt - b.dueAt)
    .map((a) => {
      const last = attempts(user.id, a.id)[0]
      return {
        id: a.id,
        title: a.title,
        dueAt: new Date(a.dueAt).toISOString(),
        status: last?.status ?? 'not_submitted',
        lastSubmittedAt: last ? new Date(last.submittedAt).toISOString() : undefined
      }
    })
})
