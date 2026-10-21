import type { ApiEvent } from './utils/h3'

/**
 * The in-browser replacement for the Nitro BFF. `$fetch('/api/…')` and `useFetch('/api/…')` keep their call sites:
 * a URL that matches a file under `./routes` runs that handler here, which calls the LMS API directly. Anything
 * else (the mock features) still goes to Nitro, tagged with who is asking.
 *
 * File names follow Nitro's: `[id]` is a param, `[...path]` a catch-all, a `.get`/`.post`/… suffix a method.
 */

type Handler = (event: ApiEvent) => unknown
type Kind = 0 | 1 | 2 // static, param, catch-all

interface Route {
  method: string | undefined
  parts: { kind: Kind, name: string }[]
  load: () => Promise<{ default: Handler }>
}

const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete'])
const modules = import.meta.glob<{ default: Handler }>('./routes/**/*.ts')

const routes: Route[] = Object.entries(modules).map(([file, load]) => {
  const segments = file.replace(/^\.\/routes\//, '').replace(/\.ts$/, '').split('/')
  const last = segments.pop()!
  const dot = last.lastIndexOf('.')
  const method = dot > 0 && METHODS.has(last.slice(dot + 1)) ? last.slice(dot + 1).toUpperCase() : undefined
  const leaf = method ? last.slice(0, dot) : last
  if (leaf !== 'index') segments.push(leaf)
  return {
    method,
    load,
    parts: segments.map((s) => {
      const catchAll = /^\[\.\.\.(.+)\]$/.exec(s)
      if (catchAll) return { kind: 2 as Kind, name: catchAll[1]! }
      const param = /^\[(.+)\]$/.exec(s)
      return param ? { kind: 1 as Kind, name: param[1]! } : { kind: 0 as Kind, name: s }
    })
  }
}).sort((a, b) => {
  for (let i = 0; i < Math.max(a.parts.length, b.parts.length); i++) {
    const x = a.parts[i]?.kind ?? 3
    const y = b.parts[i]?.kind ?? 3
    if (x !== y) return x - y
  }
  return 0
})

function match(method: string, path: string[]) {
  for (const r of routes) {
    if (r.method && r.method !== method) continue
    const params: Record<string, string> = {}
    let ok = true
    for (let i = 0; i < r.parts.length && ok; i++) {
      const part = r.parts[i]!
      if (part.kind === 2) {
        params[part.name] = path.slice(i).join('/')
        return { route: r, params }
      }
      ok = i < path.length && (part.kind === 1 ? !!(params[part.name] = path[i]!) : part.name === path[i])
    }
    if (ok && r.parts.length === path.length) return { route: r, params }
  }
  return undefined
}

type Options = { method?: string, query?: Record<string, unknown>, params?: Record<string, unknown>, body?: unknown, headers?: HeadersInit }

/** The error shape `$fetch` gave for a Nitro failure: `statusCode` on it, the response body in `data` */
function fetchError(e: unknown, method: string, url: string) {
  const err = e as { statusCode?: number, statusMessage?: string, message?: string, data?: unknown }
  const statusCode = err.statusCode ?? 500
  const out = new Error(`[${method}] "${url}": ${statusCode} ${err.statusMessage ?? ''}`.trim())
  return Object.assign(out, {
    statusCode,
    statusMessage: err.statusMessage,
    status: statusCode,
    data: { statusCode, statusMessage: err.statusMessage, message: err.message, data: err.data },
    response: { status: statusCode }
  })
}

/** Mock routes in Nitro have no session: they trust who the browser says it is (mock data only) */
function mockHeaders(headers: HeadersInit | undefined) {
  const user = sessionUser.value
  const out = new Headers(headers)
  if (user) {
    out.set('x-mock-user', user.id)
    out.set('x-mock-role', user.role)
    if (user.headScope) out.set('x-mock-scope', user.headScope)
  }
  return out
}

export function installApiRouter() {
  const router = useRouter()
  const real = globalThis.$fetch

  const routed = (async (request: unknown, options: Options = {}) => {
    if (typeof request !== 'string' || !request.startsWith('/api/')) return (real as (r: unknown, o?: unknown) => unknown)(request, options)

    const [pathname = '', search = ''] = request.slice('/api/'.length).split('?')
    const method = (options.method ?? 'GET').toUpperCase()
    const hit = match(method, pathname.split('/').filter(Boolean).map(decodeURIComponent))
    if (!hit) return (real as (r: unknown, o?: unknown) => unknown)(request, { ...options, headers: mockHeaders(options.headers) })

    const query: Record<string, unknown> = {}
    for (const [k, v] of new URLSearchParams(search)) query[k] = v
    Object.assign(query, options.query ?? options.params)
    const event: ApiEvent = { method, params: hit.params, query, body: options.body }
    try {
      const handler = (await hit.route.load()).default
      return await handler(event)
    } catch (e) {
      const error = fetchError(e, method, request)
      // The API session can't be renewed: back to sign in (auth calls report their own 401)
      if (error.statusCode === 401 && !request.startsWith('/api/auth/')) {
        const route = router.currentRoute.value
        if (!route.meta.public) await navigateTo({ path: '/login', query: { next: route.fullPath, expired: '1' } })
      }
      throw error
    }
  }) as unknown as typeof $fetch

  Object.assign(routed, real)
  globalThis.$fetch = routed
}
