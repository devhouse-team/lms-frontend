import type { components } from '~~/shared/types/api'
import type { NotificationPreference } from '~~/shared/types'

/** Email on/off per type, all seven (default on); the page shows the ones my views can receive */
export default defineEventHandler(async (event): Promise<NotificationPreference[]> => {
  await requireUserSession(event)
  return apiFetch<components['schemas']['Preference'][]>(event, '/notifications/preferences')
})
