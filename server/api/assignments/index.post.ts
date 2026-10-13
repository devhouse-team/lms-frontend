import { z } from 'zod'
import type { ManagedAssignment } from '~~/shared/types'

export default defineEventHandler(async (event): Promise<ManagedAssignment> => {
  const { cohortId, ...body } = await readValidatedBody(event, assignmentBody.extend({ cohortId: z.string() }).parse)
  await requireAssignmentAccess(event, cohortId)
  const a = { id: `a-${crypto.randomUUID().slice(0, 8)}`, cohortId, ...body, dueAt: Date.parse(body.dueAt) }
  db.assignments.push(a)
  setResponseStatus(event, 201)
  return { ...body, id: a.id, submissions: 0 }
})
