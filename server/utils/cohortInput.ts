import { z } from 'zod'

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(d => !Number.isNaN(Date.parse(d)), 'Invalid date')

/** The API checks order, past end dates, name uniqueness and the locked start; these are shape checks */
export const cohortCreateBody = z.object({
  name: z.string().trim().min(2).max(200),
  programId: z.string().min(1),
  startsOn: day,
  /** Create: optional, the API defaults it from the program's duration */
  endsOn: day.optional()
})

/** Only the fields that changed; never null (the API would 500 on null before v2, and refuses it now) */
export const cohortUpdateBody = cohortCreateBody.omit({ programId: true }).partial().strict()
