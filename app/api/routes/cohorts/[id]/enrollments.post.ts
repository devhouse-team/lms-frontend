import { z } from 'zod'
import { defineEventHandler, getRouterParam, setApiStatus, readValidatedBody } from '~/api/utils/h3'

const body = z.object({ userId: z.string().min(1) })

/** API 201 = new enrollment, 200 = a dropped enrollment reactivated. No mentor is assigned (v2). */
export default defineEventHandler(async (event): Promise<{ result: 'enrolled' | 'reactivated' }> => {
  await requireRole(event, 'head')
  const cohortId = apiId(getRouterParam(event, 'id'))
  const userId = apiId((await readValidatedBody(event, body.parse)).userId)
  const { status } = await apiFetchStatus(event, `/cohorts/${cohortId}/enrollments`, { method: 'POST', body: { user_id: userId } })
  if (status === 201) {
    setApiStatus(event, 201)
    return { result: 'enrolled' }
  }
  return { result: 'reactivated' }
})
