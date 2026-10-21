import { z } from 'zod'
import type { components } from '~~/shared/types/api'
import type { NotificationsResponse, Role } from '~~/shared/types'
import { fixLink } from '~~/shared/utils/notificationLink'
import { defineEventHandler, getValidatedQuery } from '~/api/utils/h3'

const query = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unread: z.enum(['0', '1']).optional()
})

/** The view a link needs: reviews are the mentor's, assignment pages the student's */
const viewOf = (to: string | null): Role | undefined => (to?.startsWith('/reviews/') ? 'mentor' : to?.startsWith('/assignments/') ? 'mentee' : undefined)

/** My latest notifications and the unread count (spec notifications.md). The API's English `body` is left out */
export default defineEventHandler(async (event): Promise<NotificationsResponse> => {
  await requireUserSession(event)
  const { limit, unread } = await getValidatedQuery(event, query.parse)
  const r = await apiFetch<components['schemas']['NotificationList']>(event, '/notifications/', { query: { limit, unread_only: unread === '1' } })
  return {
    unread: r.unread,
    items: r.items.map((n) => {
      const to = fixLink(n.link)
      return { id: String(n.id), type: n.type, title: n.title, read: n.read_at !== null, createdAt: n.created_at, to, view: viewOf(to) }
    })
  }
})
