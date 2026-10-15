import type { ReviewListItem } from '~~/shared/types'

/** The API keeps no review timestamp in the queue, so "reviewed" is ordered by submission time */
export default defineEventHandler(async (event): Promise<{ waiting: ReviewListItem[], reviewed: ReviewListItem[] }> => {
  await requireRole(event, 'mentor')
  const [waiting, approved, changes] = await Promise.all([
    myReviewItems(event, 'submitted'),
    myReviewItems(event, 'approved'),
    myReviewItems(event, 'changes_requested')
  ])
  return {
    waiting: waiting.sort((a, b) => a.at.localeCompare(b.at)),
    reviewed: [...approved, ...changes].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30)
  }
})
