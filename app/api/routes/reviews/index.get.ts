import { z } from 'zod'
import type { ReviewListItem } from '~~/shared/types'
import { defineEventHandler, getValidatedQuery } from '~/api/utils/h3'

const query = z.object({ practice: z.literal('1').optional() })

/**
 * Homework and exams by default; `?practice=1` adds practice attempts (they need no review, a mentor may comment).
 * The API keeps no review timestamp in the queue, so "reviewed" is ordered by submission time.
 */
export default defineEventHandler(async (event): Promise<{ waiting: ReviewListItem[], reviewed: ReviewListItem[] }> => {
  await requireRole(event, 'mentor')
  const { practice } = await getValidatedQuery(event, query.parse)
  const modes: ('homework' | 'exam' | 'practice')[] | undefined = practice ? ['homework', 'exam', 'practice'] : undefined
  const [waiting, approved, changes] = await Promise.all([
    myReviewItems(event, 'submitted', modes),
    myReviewItems(event, 'approved', modes),
    myReviewItems(event, 'changes_requested', modes)
  ])
  return {
    waiting: waiting.sort((a, b) => a.at.localeCompare(b.at)),
    reviewed: [...approved, ...changes].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30)
  }
})
