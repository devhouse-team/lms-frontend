/**
 * Upload rules shared by the browser and Nitro (spec course-content.md, Upload limits; backend content.md, Upload
 * purposes). The content type comes from the extension only: browsers send none for .md/.ipynb/code and a wrong one
 * for some (.ts → video/mp2t).
 */

export type UploadPurpose = 'cover' | 'content_image' | 'content' | 'submission'

const CODE = ['py', 'js', 'ts', 'jsx', 'tsx', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'sql', 'sh', 'kt', 'swift', 'rb', 'php', 'r', 'scala', 'json', 'yaml', 'yml']
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

const BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  zip: 'application/zip',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  md: 'text/markdown',
  markdown: 'text/markdown',
  csv: 'text/csv',
  vtt: 'text/vtt',
  ipynb: 'application/x-ipynb+json',
  txt: 'text/plain',
  ...Object.fromEntries(CODE.map(e => [e, 'text/plain']))
}

const MB = 1024 * 1024
export const UPLOAD_LIMITS: Record<UploadPurpose, { types?: string[], maxBytes: number }> = {
  cover: { types: IMAGE_TYPES, maxBytes: 5 * MB },
  content_image: { types: IMAGE_TYPES, maxBytes: 5 * MB },
  content: { maxBytes: 100 * MB },
  submission: { maxBytes: 25 * MB }
}

export const extensionOf = (filename: string) => /\.([a-z0-9]+)$/i.exec(filename)?.[1]?.toLowerCase() ?? ''

/** The content type the API expects for this filename, or undefined when the type isn't allowed */
export const contentTypeOf = (filename: string): string | undefined => BY_EXT[extensionOf(filename)]

/** `accept` attribute for a purpose: extensions, since browsers don't know the types of .md or code */
export const acceptFor = (purpose: UploadPurpose) => {
  const types = UPLOAD_LIMITS[purpose].types
  return Object.entries(BY_EXT).filter(([, t]) => !types || types.includes(t)).map(([e]) => `.${e}`).join(',')
}

/** Why a file can't be uploaded for this purpose, or the content type to send */
export function checkUpload(filename: string, size: number, purpose: UploadPurpose):
  { ok: true, contentType: string } | { ok: false, reason: 'type' | 'size', maxBytes: number } {
  const limits = UPLOAD_LIMITS[purpose]
  const contentType = contentTypeOf(filename)
  if (!contentType || (limits.types && !limits.types.includes(contentType))) return { ok: false, reason: 'type', maxBytes: limits.maxBytes }
  if (size > limits.maxBytes) return { ok: false, reason: 'size', maxBytes: limits.maxBytes }
  return { ok: true, contentType }
}

/** Label key and icon for file cards, by extension */
export function fileKind(filename: string): { label: string, icon: string } {
  const ext = extensionOf(filename)
  if (ext === 'pdf') return { label: 'PDF', icon: 'i-lucide-file-text' }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return { label: ext.toUpperCase(), icon: 'i-lucide-file-image' }
  if (ext === 'zip') return { label: 'ZIP', icon: 'i-lucide-file-archive' }
  if (ext === 'ipynb') return { label: 'Jupyter', icon: 'i-lucide-notebook' }
  if (['docx', 'xlsx', 'pptx'].includes(ext)) return { label: ext.toUpperCase(), icon: ext === 'xlsx' ? 'i-lucide-file-spreadsheet' : 'i-lucide-file-type' }
  if (['md', 'markdown', 'txt', 'csv', 'vtt'].includes(ext)) return { label: ext.toUpperCase(), icon: 'i-lucide-file-text' }
  if (CODE.includes(ext)) return { label: ext.toUpperCase(), icon: 'i-lucide-file-code' }
  return { label: ext.toUpperCase() || 'FILE', icon: 'i-lucide-file' }
}

/** An assignment's `file_types` groups (backend content.md, Accepted formats); empty = any allowed type */
export type FileGroup = 'pdf' | 'image' | 'archive' | 'document' | 'text' | 'notebook'
export const FILE_GROUPS: FileGroup[] = ['pdf', 'image', 'archive', 'document', 'text', 'notebook']
const GROUP_EXT: Record<FileGroup, string[]> = {
  pdf: ['pdf'],
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
  archive: ['zip'],
  document: ['docx', 'xlsx', 'pptx'],
  text: ['txt', 'md', 'markdown', 'csv', ...CODE],
  notebook: ['ipynb']
}

/** Whether a filename falls in one of the groups (no groups: any allowed type) */
export const inGroups = (filename: string, groups: FileGroup[]) =>
  !groups.length || groups.some(g => GROUP_EXT[g].includes(extensionOf(filename)))

/** `accept` attribute for a submission limited to groups */
export const acceptForGroups = (groups: FileGroup[]) =>
  groups.length ? groups.flatMap(g => GROUP_EXT[g]).map(e => `.${e}`).join(',') : acceptFor('submission')
