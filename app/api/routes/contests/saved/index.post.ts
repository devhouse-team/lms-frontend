import { z } from 'zod'
import type { SavedContest } from '~~/shared/types'
import { defineEventHandler, readValidatedBody, setApiStatus } from '~/api/utils/h3'

const body = z.object({ slug: contestSlug })

/** Save a LeetCode contest by slug; 422 when LeetCode doesn't know it, 503 when LeetCode is unreachable */
export default defineEventHandler(async (event): Promise<SavedContest> => {
  await requireRole(event, 'head', 'all')
  const { slug } = await readValidatedBody(event, body.parse)
  const c = await apiFetch<ApiSavedContest>(event, '/contest/', { method: 'POST', body: { title_slug: slug } })
  setApiStatus(event, 201)
  return toSavedContest(c)
})
