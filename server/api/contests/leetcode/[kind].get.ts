import { z } from 'zod'
import type { LeetcodeContest } from '~~/shared/types'

const params = z.object({ kind: z.enum(['past', 'upcoming']) })
const query = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  skip: z.coerce.number().int().min(0).default(0)
})

/** LeetCode's contest list, to pick one to save; paging applies to past contests only */
export default defineEventHandler(async (event): Promise<LeetcodeContest[]> => {
  await requireRole(event, 'head', 'all')
  const { kind } = await getValidatedRouterParams(event, params.parse)
  const list = kind === 'past'
    ? await apiFetch<ApiLeetcodeContest[]>(event, '/contest/fetch_past', { query: await getValidatedQuery(event, query.parse) })
    : await apiFetch<ApiLeetcodeContest[]>(event, '/contest/fetch_upcoming')
  return list.map(toLeetcodeContest)
})
