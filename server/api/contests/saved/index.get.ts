import type { SavedContest } from '~~/shared/types'

/** Contests the academy tracks, latest start first */
export default defineEventHandler(async (event): Promise<SavedContest[]> => {
  await requireRole(event, 'head', 'all')
  const list = await apiFetch<ApiSavedContest[]>(event, '/contest/')
  return list.map(toSavedContest)
})
