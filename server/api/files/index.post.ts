import { z } from 'zod'
import type { components } from '~~/shared/types/api'
import type { FileTicket } from '~~/shared/types'

const body = z.object({
  filename: z.string().min(1).max(255),
  size: z.number().int().min(1),
  purpose: z.enum(['cover', 'content_image', 'content', 'submission'])
})

/**
 * Step 1 of an upload: the API signs a URL the browser PUTs the bytes to (no Authorization header there). The type
 * comes from the extension and the purpose's limits are checked here first; the API checks them again.
 */
export default defineEventHandler(async (event): Promise<FileTicket> => {
  await requireUserSession(event)
  const { filename, size, purpose } = await readValidatedBody(event, body.parse)
  const check = checkUpload(filename, size, purpose)
  if (!check.ok) {
    // Same shape as the API's 422: `details.fields` lets apiError().field() point at the input
    const field = check.reason === 'size' ? 'size' : 'filename'
    throw createError({
      statusCode: 422,
      statusMessage: check.reason === 'size' ? 'file_too_large' : 'validation_error',
      data: { details: { max_bytes: check.maxBytes, fields: [{ loc: ['body', field], msg: check.reason === 'size' ? `File over ${check.maxBytes} bytes` : 'File type not allowed' }] } }
    })
  }
  const t = await apiFetch<components['schemas']['UploadTicket']>(event, '/files/', { method: 'POST', body: { filename, content_type: check.contentType, size, purpose } })
  return { fileId: String(t.file.id), uploadUrl: t.upload_url, headers: t.headers }
})
