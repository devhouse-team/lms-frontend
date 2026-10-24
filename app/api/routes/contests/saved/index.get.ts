import type { SavedContest } from '~~/shared/types'
import { defineEventHandler } from '~/api/utils/h3'

/** Contests the academy tracks, latest start first */
export default defineEventHandler(async (event): Promise<SavedContest[]> => {
  await requireRole(event, 'head', 'all')
  const list = await apiFetch<ApiSavedContest[]>(event, '/contest/')
  return list.map(toSavedContest)
})
