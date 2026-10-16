import type { components } from '~~/shared/types/api'
import type { ImportReport } from '~~/shared/types'

const MAX_BYTES = 1024 * 1024

/** CSV of emails (or an `email` column); only existing accounts are enrolled. The API caps it at 2000 rows. */
export default defineEventHandler(async (event): Promise<ImportReport> => {
  await requireRole(event, 'head')
  const cohortId = apiId(getRouterParam(event, 'id'))
  const file = (await readMultipartFormData(event))?.find(p => p.name === 'file')
  if (!file?.data.length) throw createError({ statusCode: 422, statusMessage: 'validation_error', message: 'Choose a CSV file.' })
  if (file.data.length > MAX_BYTES) throw createError({ statusCode: 422, statusMessage: 'validation_error', message: 'The file is larger than 1 MB.' })
  const form = new FormData()
  form.append('file', new Blob([file.data], { type: file.type || 'text/csv' }), file.filename || 'students.csv')
  const r = await apiFetch<components['schemas']['ImportResult']>(event, `/cohorts/${cohortId}/enrollments/import`, { method: 'POST', body: form })
  return { enrolled: r.enrolled, reactivated: r.reactivated, alreadyEnrolled: r.already_enrolled, unknown: r.unknown, skippedStaff: r.skipped_staff }
})
