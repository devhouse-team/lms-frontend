import { z } from 'zod'
import type { components } from '~~/shared/types/api'
import type { FileTicket } from '~~/shared/types'

/** Only program covers upload for now: images up to 5 MB (the API allows more types and 25 MB) */
const body = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  size: z.number().int().min(1).max(5 * 1024 * 1024)
})

/** Step 1 of an upload: the API signs a URL the browser PUTs the bytes to (no Authorization header there) */
export default defineEventHandler(async (event): Promise<FileTicket> => {
  await requireUserSession(event)
  const { filename, contentType, size } = await readValidatedBody(event, body.parse)
  const t = await apiFetch<components['schemas']['UploadTicket']>(event, '/files/', { method: 'POST', body: { filename, content_type: contentType, size } })
  return { fileId: String(t.file.id), uploadUrl: t.upload_url, headers: t.headers }
})
