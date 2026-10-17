/**
 * Video URL → embed URL, mirroring the backend allowlist (backend content.md, Video embeds). Used only for the editor's
 * live preview and field check; pages always embed the API's `embed_url`.
 */
export function toEmbed(raw: string): { host: 'youtube' | 'vimeo' | 'drive' | 'loom', embedUrl: string } | null {
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return null
  }
  if (u.protocol !== 'https:') return null
  const host = u.hostname.toLowerCase()
  const parts = u.pathname.split('/').filter(Boolean)

  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'].includes(host)) {
    const id = host === 'youtu.be'
      ? parts[0]
      : parts[0] === 'watch' ? u.searchParams.get('v') ?? undefined
        : ['embed', 'shorts'].includes(parts[0] ?? '') ? parts[1] : undefined
    if (!id || !/^[\w-]{6,}$/.test(id)) return null
    const start = seconds(u.searchParams.get('t') ?? u.searchParams.get('start'))
    return { host: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}${start ? `?start=${start}` : ''}` }
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const [id, hash] = host === 'vimeo.com' ? [parts[0], parts[1]] : parts[0] === 'video' ? [parts[1], u.searchParams.get('h') ?? undefined] : []
    if (!id || !/^\d+$/.test(id)) return null
    return { host: 'vimeo', embedUrl: `https://player.vimeo.com/video/${id}${hash ? `?h=${encodeURIComponent(hash)}` : ''}` }
  }
  if (host === 'drive.google.com' && parts[0] === 'file' && parts[1] === 'd' && parts[2]) {
    return { host: 'drive', embedUrl: `https://drive.google.com/file/d/${parts[2]}/preview` }
  }
  if ((host === 'loom.com' || host === 'www.loom.com') && ['share', 'embed'].includes(parts[0] ?? '') && parts[1]) {
    return { host: 'loom', embedUrl: `https://www.loom.com/embed/${parts[1]}` }
  }
  return null
}

/** "90", "1m30s", "1h2m3s" → seconds */
function seconds(t: string | null) {
  if (!t) return 0
  if (/^\d+$/.test(t)) return Number(t)
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t)
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0
}

/** Hosts an embed URL may point at (the API's `embed_url` and `toEmbed()` both produce only these) */
const EMBED_HOSTS = ['www.youtube-nocookie.com', 'player.vimeo.com', 'drive.google.com', 'www.loom.com']
export function isEmbedUrl(url: string) {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && EMBED_HOSTS.includes(u.hostname)
  } catch {
    return false
  }
}
