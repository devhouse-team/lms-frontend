import type { components } from '~~/shared/types/api'
import type { ImportReport } from '~~/shared/types'
import { defineEventHandler, getRouterParam } from '~/api/utils/h3'

const MAX_BYTES = 1024 * 1024

/** CSV of emails (or an `email` column): accounts are enrolled, other addresses invited. The API caps it at 2000 rows. */
export default defineEventHandler(async (event): Promise<ImportReport> => {
  await requireRole(event, 'head')
  const cohortId = apiId(getRouterParam(event, 'id'))
  const file = (event.body as FormData | undefined)?.get('file')
  if (!(file instanceof File) || !file.size) throw createError({ statusCode: 422, statusMessage: 'import_empty' })
  if (file.size > MAX_BYTES) throw createError({ statusCode: 422, statusMessage: 'import_file_too_big' })
  const form = new FormData()
  form.append('file', file, file.name || 'students.csv')
  const r = await apiFetch<components['schemas']['ImportResult']>(event, `/cohorts/${cohortId}/enrollments/import`, { method: 'POST', body: form })
  return { enrolled: r.enrolled, reactivated: r.reactivated, alreadyEnrolled: r.already_enrolled, invited: r.invited, resent: r.resent, unknown: r.unknown, skippedStaff: r.skipped_staff }
})
