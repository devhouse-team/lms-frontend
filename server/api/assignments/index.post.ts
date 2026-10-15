import { z } from 'zod'
import type { OkResponse } from '~~/shared/types'

/** Attach an assignment to a lesson. The API checks the caller may edit that course. */
export default defineEventHandler(async (event): Promise<OkResponse> => {
  await requireUserSession(event)
  const { lessonId, ...body } = await readValidatedBody(event, assignmentBody.extend({ lessonId: z.string() }).parse)
  await apiFetch(event, `/lessons/${apiId(lessonId)}/assignment`, { method: 'PUT', body: toAssignmentWrite(body) })
  setResponseStatus(event, 201)
  return { ok: true }
})
