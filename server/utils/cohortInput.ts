import { z } from 'zod'
import { addDays } from './lms'

export const cohortBody = z.object({
  name: z.string().trim().min(2).max(40),
  programId: z.string().min(1),
  startAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(d => !Number.isNaN(Date.parse(d)), 'Invalid date'),
  totalWeeks: z.number().int().min(1).max(104),
  mentorId: z.string().nullish()
})

/** Cohort length in weeks ↔ the API's start and end dates */
export function cohortDates(startAt: string, totalWeeks: number) {
  return { starts_on: startAt, ends_on: addDays(startAt, totalWeeks * 7) }
}

export const cohortStatus = (startAt: string) => (Date.parse(startAt) > Date.now() ? 'planned' : 'active') as 'planned' | 'active'
