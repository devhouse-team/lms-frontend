import { fixLink, isLegacyLink } from '~~/shared/utils/notificationLink'

/**
 * Notification emails sent before 2026-10-19 link to the API's old paths (`FRONTEND_URL + link`): send those to the
 * page this app serves. Only GETs of the known old patterns; everything else passes.
 */
export default defineEventHandler((event) => {
  const path = event.path.split('?')[0]!
  return event.method === 'GET' && isLegacyLink(path) ? sendRedirect(event, fixLink(path)!, 302) : undefined
})
