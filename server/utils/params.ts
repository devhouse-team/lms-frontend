import type { H3Event } from 'h3'
import { z } from 'zod'

const key = z.string().min(1).max(100)
const idParams = z.object({ id: key })
const tokenParams = z.object({ token: key })

/** `[id]` route param; 400 when missing or malformed. */
export async function requireIdParam(event: H3Event) {
  return (await getValidatedRouterParams(event, idParams.parse)).id
}

/** `[token]` route param; 400 when missing or malformed. */
export async function requireTokenParam(event: H3Event) {
  return (await getValidatedRouterParams(event, tokenParams.parse)).token
}
