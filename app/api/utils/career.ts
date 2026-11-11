import type { ApiEvent as H3Event } from './h3'
import type { CareerStep, CareerStepId } from '~~/shared/types'

/**
 * Career API shape (spec features/career-api.md, O37). Hand-written until the backend ships it in openapi.json;
 * then use `components['schemas'][...]`.
 */
export interface ApiCareerStep {
  step: CareerStepId
  done: boolean
  done_at: string | null
}

export const careerOf = (s: ApiCareerStep): CareerStep => ({ id: s.step, done: s.done })

/** Own career steps; `undefined` (not available yet) when the API has none or fails. 401 still ends the session. */
export async function myCareer(event?: H3Event): Promise<CareerStep[] | undefined> {
  try {
    return (await apiFetch<ApiCareerStep[]>(event, '/me/career')).map(careerOf)
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode === 401) throw e
    return undefined
  }
}
