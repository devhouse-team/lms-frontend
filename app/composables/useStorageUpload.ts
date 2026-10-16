import type { FileTicket } from '~~/shared/types'

/**
 * Browser → storage upload (backend frontend.md, File uploads): Nitro signs, the browser PUTs the bytes straight to
 * the signed URL with exactly the returned headers and no credentials, Nitro confirms. Resolves to the file id.
 * Not `useFileUpload`: Nuxt UI already auto-imports a composable with that name.
 */
export function useStorageUpload() {
  const uploading = ref(false)

  async function upload(file: File) {
    uploading.value = true
    try {
      const ticket = await $fetch<FileTicket>('/api/files', { method: 'POST', body: { filename: file.name, contentType: file.type, size: file.size } })
      const res = await fetch(ticket.uploadUrl, { method: 'PUT', body: file, headers: ticket.headers, credentials: 'omit' })
      if (!res.ok) throw new Error(`upload ${res.status}`)
      return (await $fetch<{ fileId: string }>(`/api/files/${ticket.fileId}/complete`, { method: 'POST' })).fileId
    } finally {
      uploading.value = false
    }
  }

  return { uploading, upload }
}
