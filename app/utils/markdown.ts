import type { FileMeta } from '~~/shared/types'

/**
 * The one markdown renderer (spec course-content.md, Rendering stack): marked (GFM) + KaTeX + highlight.js, then
 * DOMPurify over the final HTML. Browser only; heavy parts load on demand (KaTeX with `$`, highlight.js with a fence).
 * Raw HTML is shown as text, `file:<id>` resolves only to files attached to the rendered object.
 */

export interface RenderOptions {
  /** Files attached to the object being rendered */
  files?: FileMeta[]
  /** Nitro file route prefix for that object, e.g. `/api/files/cohorts/12/materials/51` */
  base?: string
  /** Labels in the active locale */
  labels?: { copy: string, missingFile: (id: string) => string }
}

const ALIAS: Record<string, string> = { py: 'python', js: 'javascript', ts: 'typescript', sh: 'bash', shell: 'bash', html: 'xml', kt: 'kotlin', cs: 'csharp', 'c++': 'cpp', rs: 'rust', yml: 'yaml', md: 'markdown', text: 'plaintext', txt: 'plaintext' }
const LANGS = {
  python: () => import('highlight.js/lib/languages/python'),
  javascript: () => import('highlight.js/lib/languages/javascript'),
  typescript: () => import('highlight.js/lib/languages/typescript'),
  java: () => import('highlight.js/lib/languages/java'),
  c: () => import('highlight.js/lib/languages/c'),
  cpp: () => import('highlight.js/lib/languages/cpp'),
  csharp: () => import('highlight.js/lib/languages/csharp'),
  go: () => import('highlight.js/lib/languages/go'),
  rust: () => import('highlight.js/lib/languages/rust'),
  sql: () => import('highlight.js/lib/languages/sql'),
  bash: () => import('highlight.js/lib/languages/bash'),
  kotlin: () => import('highlight.js/lib/languages/kotlin'),
  swift: () => import('highlight.js/lib/languages/swift'),
  ruby: () => import('highlight.js/lib/languages/ruby'),
  php: () => import('highlight.js/lib/languages/php'),
  json: () => import('highlight.js/lib/languages/json'),
  yaml: () => import('highlight.js/lib/languages/yaml'),
  xml: () => import('highlight.js/lib/languages/xml'),
  css: () => import('highlight.js/lib/languages/css'),
  markdown: () => import('highlight.js/lib/languages/markdown'),
  plaintext: () => import('highlight.js/lib/languages/plaintext')
}

type Hljs = typeof import('highlight.js/lib/core').default
let hljsP: Promise<Hljs> | undefined
const loadHljs = () => (hljsP ??= (async () => {
  const hljs = (await import('highlight.js/lib/core')).default
  const mods = await Promise.all(Object.values(LANGS).map(load => load()))
  Object.keys(LANGS).forEach((name, i) => hljs.registerLanguage(name, mods[i]!.default))
  return hljs
})())

let katexP: Promise<unknown> | undefined
const loadKatex = () => (katexP ??= Promise.all([
  import('marked-katex-extension').then(m => m.default),
  import('katex/dist/katex.min.css')
]).then(([ext]) => ext))

let purifyP: Promise<typeof import('dompurify').default> | undefined
const loadPurify = () => (purifyP ??= import('dompurify').then(({ default: purify }) => {
  // External links open in a new tab without referrer; images load lazily
  purify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') ?? ''
      if (/^https?:/i.test(href)) {
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noopener noreferrer nofollow')
      }
    }
    if (node.tagName === 'IMG') node.setAttribute('loading', 'lazy')
  })
  return purify
}))

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function renderMarkdown(src: string, opts: RenderOptions = {}) {
  const hasMath = src.includes('$')
  const hasCode = /^ {0,3}(`{3,}|~{3,})/m.test(src)
  const [{ Marked }, purify, hljs, katexExt] = await Promise.all([
    import('marked'),
    loadPurify(),
    hasCode ? loadHljs() : undefined,
    hasMath ? loadKatex() : undefined
  ])
  const files = new Map((opts.files ?? []).map(f => [String(f.id), f]))
  const labels = opts.labels ?? { copy: 'Copy', missingFile: (id: string) => `File ${id} isn't attached` }
  /** `file:<id>` → the object's Nitro file route; undefined when the file isn't attached to this object */
  const resolve = (href: string) => {
    const id = /^file:(\d+)$/.exec(href)?.[1]
    if (!id) return href
    return files.has(id) && opts.base ? `${opts.base}/${id}` : undefined
  }
  const missing = (href: string) => `<span class="md-missing">${escape(labels.missingFile(href.slice(5)))}</span>`

  const marked = new Marked({ gfm: true, breaks: false })
  if (katexExt) marked.use((katexExt as (o: object) => Parameters<typeof marked.use>[0])({ throwOnError: false, output: 'htmlAndMathml', trust: false, maxExpand: 1000 }))
  marked.use({
    renderer: {
      // Raw HTML is shown as text (markdown contract: html off)
      html: ({ text }) => escape(text),
      code({ text, lang }) {
        const name = ALIAS[(lang ?? '').toLowerCase()] ?? (lang ?? '').toLowerCase()
        const body = hljs && name && hljs.getLanguage(name) ? hljs.highlight(text, { language: name }).value : escape(text)
        return `<div class="md-code"><button type="button" class="md-copy" data-copy>${escape(labels.copy)}</button><pre tabindex="0"><code class="hljs">${body}</code></pre></div>`
      },
      image({ href, title, text }) {
        const url = resolve(href)
        if (url === undefined) return missing(href)
        return `<img src="${escape(url)}" alt="${escape(text)}"${title ? ` title="${escape(title)}"` : ''}>`
      },
      link({ href, title, tokens }) {
        const url = resolve(href)
        const inner = this.parser.parseInline(tokens)
        if (url === undefined) return missing(href)
        return `<a href="${escape(url)}"${title ? ` title="${escape(title)}"` : ''}>${inner}</a>`
      }
    }
  })
  const html = await marked.parse(src)
  return purify.sanitize(html, {
    USE_PROFILES: { html: true, svg: true, mathMl: true },
    FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'form', 'textarea', 'select'],
    SANITIZE_NAMED_PROPS: true,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|\/api\/files\/|#)/i
  })
}
