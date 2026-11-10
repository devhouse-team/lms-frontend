import type { SessionItem } from '~~/shared/types'
import { defineEventHandler } from '~/api/utils/h3'
import { mySessions } from '~/api/utils/sessions'

/** Own sessions (mentor: the ones they run; student: their cohort's group sessions and own 1:1s); `available` is false until the API has them */
export default defineEventHandler(async (event): Promise<{ items: SessionItem[], available: boolean }> => {
  const { user } = await requireUserSession(event)
  const items = await mySessions(event, user.id)
  return { items: items ?? [], available: !!items }
})
