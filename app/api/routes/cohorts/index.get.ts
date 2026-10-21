import { z } from 'zod'
import type { CohortRow } from '~~/shared/types'
import { defineEventHandler, getValidatedQuery } from '~/api/utils/h3'

const statuses = z.enum(['planned', 'active', 'finished'])
/** `?status=active&status=planned`; none means every status */
const query = z.object({ status: z.union([statuses, z.array(statuses)]).optional() })

/** 1 + N API calls: the list (with mentors), then each cohort's roster */
export default defineEventHandler(async (event): Promise<CohortRow[]> => {
  await requireRole(event, 'head')
  const { status } = await getValidatedQuery(event, query.parse)
  const list = await listCohorts(event, { status: status === undefined ? undefined : [status].flat() })
  return Promise.all(list.map(async c => (await cohortStats(event, c)).row))
})
