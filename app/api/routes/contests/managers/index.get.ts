import type { ContestManager } from '~~/shared/types'
import { defineEventHandler } from '~/api/utils/h3'

/** The LeetCode mentors; only the superuser sees and changes them */
export default defineEventHandler(async (event): Promise<ContestManager[]> => {
  await requireSuperuser(event)
  const list = await apiFetch<ApiManager[]>(event, '/contest/managers')
  return list.map(toManager).sort((a, b) => a.name.localeCompare(b.name, 'ru'))
})
