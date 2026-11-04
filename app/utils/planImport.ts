/**
 * Course plan import: Markdown, CSV or JSON → one tree, then the request for `POST /courses/{id}/import`. Contract:
 * spec/features/plan-import-api.md. Syntax problems are found here; content problems (URLs, limits) come back from the
 * API as issues, so the rules live in one place.
 */
export type PlanFormat = 'md' | 'csv' | 'json'

export interface PlanItem { type: string, title: string, url: string, line: number }
export interface PlanLesson { title: string, items: PlanItem[], line: number }
export interface PlanModule { title: string, lessons: PlanLesson[], line: number }
export interface PlanTree { modules: PlanModule[], stray: { line: number, text: string }[] }

export interface ImportIssue { path: string, severity: 'error' | 'warning', code: string, message: string }
export interface ImportResult {
  applied: boolean
  counts: { modules: number, lessons: number, materials: number, assignments: number }
  issues: ImportIssue[]
}
export interface ImportRequest {
  mode: 'append' | 'replace'
  dry_run: boolean
  modules: { title: string, lessons: { title: string, items: { type: string, title: string, url?: string }[] }[] }[]
}

export const IMPORT_TYPES = ['video', 'pdf', 'link', 'task']

/** `code` is a key under wizard.course.import.err */
export class PlanParseError extends Error {
  code: 'json_invalid' | 'json_shape'
  constructor(code: 'json_invalid' | 'json_shape') {
    super(code)
    this.code = code
  }
}

const module = (title: string, line: number): PlanModule => ({ title, lessons: [], line })
const lesson = (title: string, line: number): PlanLesson => ({ title, items: [], line })

/** `# Module`, `## Lesson`, `- [video](url) Title`, `> task: Title` */
function parseMd(text: string): PlanTree {
  const modules: PlanModule[] = []
  const stray: PlanTree['stray'] = []
  let m: PlanModule | undefined
  let l: PlanLesson | undefined
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim()
    const n = i + 1
    if (!line) return
    let x: RegExpMatchArray | null
    if ((x = line.match(/^#\s+(.*)$/))) {
      m = module(x[1]!.trim(), n)
      modules.push(m)
      l = undefined
    } else if ((x = line.match(/^##\s+(.*)$/))) {
      if (!m) modules.push(m = module('', n))
      l = lesson(x[1]!.trim(), n)
      m.lessons.push(l)
    } else if ((x = line.match(/^[-*]\s*\[(\w+)\]\(([^)]*)\)\s*(.*)$/))) {
      if (!l) stray.push({ line: n, text: line })
      else l.items.push({ type: x[1]!.toLowerCase(), url: x[2]!.trim(), title: x[3]!.trim(), line: n })
    } else if ((x = line.match(/^>\s*task:\s*(.*)$/i))) {
      if (!l) stray.push({ line: n, text: line })
      else l.items.push({ type: 'task', url: '', title: x[1]!.trim(), line: n })
    } else stray.push({ line: n, text: line })
  })
  return { modules, stray }
}

function splitCsv(row: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (const ch of row) {
    if (ch === '"') quoted = !quoted
    else if (ch === ',' && !quoted) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map(v => v.trim())
}

/** Header row, then `module,lesson,type,title,url`; a module or lesson is created the first time its title appears */
function parseCsv(text: string): PlanTree {
  const modules: PlanModule[] = []
  const rows = text.split('\n').map((r, i) => ({ r: r.trim(), line: i + 1 })).filter(x => x.r)
  for (const { r, line } of rows.slice(1)) {
    const [mt = '', lt = '', type = '', title = '', url = ''] = splitCsv(r)
    let m = modules.find(x => x.title === mt)
    if (!m) modules.push(m = module(mt, line))
    if (!lt) continue
    let l = m.lessons.find(x => x.title === lt)
    if (!l) m.lessons.push(l = lesson(lt, line))
    if (type) l.items.push({ type: type.toLowerCase(), url, title, line })
  }
  return { modules, stray: [] }
}

/** `{ "modules": [{ "title", "lessons": [{ "title", "items": [{ "type", "title", "url" }] }] }] }` */
function parseJson(text: string): PlanTree {
  let data: { modules?: unknown }
  try {
    data = JSON.parse(text)
  } catch {
    throw new PlanParseError('json_invalid')
  }
  if (!data || !Array.isArray(data.modules)) throw new PlanParseError('json_shape')
  type Raw = { title?: string, lessons?: Raw[], items?: { type?: string, title?: string, url?: string }[] }
  return {
    stray: [],
    modules: (data.modules as Raw[]).map((m, mi) => ({
      ...module(m.title ?? '', mi + 1),
      lessons: (m.lessons ?? []).map((l, li) => ({
        ...lesson(l.title ?? '', li + 1),
        items: (l.items ?? []).map((it, k) => ({ type: String(it.type ?? '').toLowerCase(), url: it.url ?? '', title: it.title ?? '', line: k + 1 }))
      }))
    }))
  }
}

export function parsePlan(format: PlanFormat, text: string): PlanTree {
  return { md: parseMd, csv: parseCsv, json: parseJson }[format](text)
}

/** Problems the browser can see without asking the API: unknown types, missing titles, lines that belong nowhere */
export function localIssues(tree: PlanTree): ImportIssue[] {
  const issues: ImportIssue[] = []
  const add = (severity: ImportIssue['severity'], path: string, code: string) => issues.push({ path, severity, code, message: code })
  tree.stray.forEach(s => add('warning', `line[${s.line}]`, 'stray_line'))
  tree.modules.forEach((m, mi) => {
    if (!m.title.trim()) add('error', `modules[${mi}]`, 'title_required')
    m.lessons.forEach((l, li) => {
      if (!l.title.trim()) add('error', `modules[${mi}].lessons[${li}]`, 'title_required')
      l.items.forEach((it, k) => {
        const path = `modules[${mi}].lessons[${li}].items[${k}]`
        if (!IMPORT_TYPES.includes(it.type)) add('error', path, 'unknown_type')
        else if (it.type === 'task' && !it.title.trim()) add('error', path, 'title_required')
      })
    })
  })
  return issues
}

/** Modules without lessons are left out (the API would report them as empty) */
export function toRequest(tree: PlanTree, mode: ImportRequest['mode'], dryRun: boolean): ImportRequest {
  return {
    mode,
    dry_run: dryRun,
    modules: tree.modules.filter(m => m.lessons.length).map(m => ({
      title: m.title,
      lessons: m.lessons.map(l => ({
        title: l.title,
        items: l.items.map(it => ({ type: it.type, title: it.title, ...(it.type === 'task' ? {} : { url: it.url }) }))
      }))
    }))
  }
}

export function planCounts(tree: PlanTree) {
  const lessons = tree.modules.flatMap(m => m.lessons)
  const items = lessons.flatMap(l => l.items)
  return {
    modules: tree.modules.filter(m => m.lessons.length).length,
    lessons: lessons.length,
    materials: items.filter(i => i.type !== 'task').length,
    assignments: items.filter(i => i.type === 'task').length
  }
}
