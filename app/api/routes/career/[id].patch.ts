import { z } from 'zod'
import type { CareerStep, CareerStepId } from '~~/shared/types'
import { defineEventHandler, getValidatedRouterParams, readValidatedBody } from '~/api/utils/h3'
import { careerOf, type ApiCareerStep } from '~/api/utils/career'

const STEPS = ['cv', 'github', 'linkedin', 'mock', 'apply'] as const satisfies readonly CareerStepId[]
const params = z.object({ id: z.enum(STEPS) })
const body = z.object({ done: z.boolean() })

/** Tick or untick one of the own career steps */
export default defineEventHandler(async (event): Promise<CareerStep> => {
  await requireRole(event, 'mentee')
  const { id: step } = await getValidatedRouterParams(event, params.parse)
  return careerOf(await apiFetch<ApiCareerStep>(event, `/me/career/${step}`, { method: 'PUT', body: await readValidatedBody(event, body.parse) }))
})
