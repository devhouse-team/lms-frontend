import { z } from 'zod'
import type { components } from '~~/shared/types/api'
import type { NotificationPreference } from '~~/shared/types'
import { defineEventHandler, readValidatedBody } from '~/api/utils/h3'

const TYPES = ['submission_created', 'review_completed', 'lesson_released', 'deadline_soon', 'enrollment_created', 'exam_opens_soon', 'solution_released'] as const satisfies readonly components['schemas']['NotificationType'][]
const body = z.array(z.object({ type: z.enum(TYPES), email: z.boolean() })).min(1).max(10)

/** Save some types; the API answers with the full list */
export default defineEventHandler(async (event): Promise<NotificationPreference[]> => {
  await requireUserSession(event)
  const prefs = await readValidatedBody(event, body.parse)
  return apiFetch<components['schemas']['Preference'][]>(event, '/notifications/preferences', { method: 'PUT', body: prefs })
})
