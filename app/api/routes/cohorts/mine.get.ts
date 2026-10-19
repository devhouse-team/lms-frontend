import type { MentorCohort } from '~~/shared/types'
import { defineEventHandler } from '~/api/utils/h3'

/** Every cohort the mentor or reviewer staffs, with its roster; finished ones included (the page collapses them) */
export default defineEventHandler(async (event): Promise<MentorCohort[]> => {
  await requireRole(event, 'mentor')
  const cohorts = await Promise.all((await staffedCohortIds(event)).map(async (id) => {
    const [detail, roster] = await Promise.all([cohortDetail(event, id), cohortRoster(event, id)])
    return { ...detail, roster }
  }))
  const programs = await programSummaries(event, cohorts.map(c => Number(c.programId)))
  return cohorts.map(c => ({ ...c, program: programs.get(Number(c.programId))! }))
})
