import type { OkResponse } from '~~/shared/types'
import { defineEventHandler, getRouterParam, readValidatedBody } from '~/api/utils/h3'

/** Sends only the given fields; program and status can't change here */
export default defineEventHandler(async (event): Promise<OkResponse> => {
  await requireRole(event, 'head')
  const id = apiId(getRouterParam(event, 'id'))
  const { name, startsOn, endsOn, timezone } = await readValidatedBody(event, cohortUpdateBody.parse)
  const body = Object.fromEntries(Object.entries({ name, starts_on: startsOn, ends_on: endsOn, timezone }).filter(([, v]) => v !== undefined))
  if (Object.keys(body).length) await apiFetch(event, `/cohorts/${id}`, { method: 'PATCH', body })
  return { ok: true }
})
