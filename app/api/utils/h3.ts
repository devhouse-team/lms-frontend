import type { ZodError } from 'zod'

/**
 * The slice of h3 the route handlers in `app/api/routes` use, so they read like the Nitro handlers they came from.
 * The handlers run in the browser (see ../router.ts); `ApiEvent` is one call of `$fetch('/api/…')`.
 */
export interface ApiEvent {
  method: string
  params: Record<string, string>
  query: Record<string, unknown>
  body?: unknown
  status?: number
}

export type H3Event = ApiEvent

export const defineEventHandler = <T>(handler: (event: ApiEvent) => T | Promise<T>) => handler

export const getRouterParam = (event: ApiEvent, name: string) => event.params[name]

export const getQuery = (event: ApiEvent) => event.query

export const readBody = <T = unknown>(event: ApiEvent) => Promise.resolve(event.body as T)

export const setApiStatus = (event: ApiEvent, status: number) => {
  event.status = status
}

/** Same answer h3 gives for a failed validator: 400 with the issues in `data` */
function validated<T>(parse: (input: unknown) => T, input: unknown): T {
  try {
    return parse(input)
  } catch (e) {
    throw createError({ statusCode: 400, statusMessage: 'Validation Error', data: (e as ZodError).issues })
  }
}

export const readValidatedBody = <T>(event: ApiEvent, parse: (input: unknown) => T) => Promise.resolve(validated(parse, event.body))
export const getValidatedRouterParams = <T>(event: ApiEvent, parse: (input: unknown) => T) => Promise.resolve(validated(parse, event.params))
export const getValidatedQuery = <T>(event: ApiEvent, parse: (input: unknown) => T) => Promise.resolve(validated(parse, event.query))
