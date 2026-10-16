import type { MentorCohort } from '~~/shared/types'

/** Every cohort the mentor or reviewer staffs, with its roster; finished ones included (the page collapses them) */
export default defineEventHandler(async (event): Promise<MentorCohort[]> => {
  await requireRole(event, 'mentor')
  return Promise.all((await staffedCohortIds(event)).map(async (id) => {
    const [detail, roster] = await Promise.all([cohortDetail(event, id), cohortRoster(event, id)])
    return { ...detail, roster }
  }))
})
