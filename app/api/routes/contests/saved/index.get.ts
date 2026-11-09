import type { SavedContest } from '~~/shared/types'
import { defineEventHandler } from '~/api/utils/h3'

/** Contests the academy tracks, latest start first; `registered` is the caller's own sign-up */
export default defineEventHandler(async (event): Promise<SavedContest[]> => {
  await requireUserSession(event)
  const list = await apiFetch<ApiSavedContest[]>(event, '/contest/')
  return list.map(toSavedContest)
})
