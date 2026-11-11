import type { MentorProfile } from '~~/shared/types'
import { defineEventHandler } from '~/api/utils/h3'
import { mySessions } from '~/api/utils/sessions'

/** Mentor and sessions from the API; no sessions until the API has them */
export default defineEventHandler(async (event): Promise<MentorProfile> => {
  const user = await requireRole(event, 'mentee')
  const cohort = (await activeStudentCohorts(event))[0]
  const mentor = cohort ? await studentMentor(event, cohort.cohort_id, user.id) : undefined
  return {
    mentor: mentor ? { ...person(mentor), title: '' } : null,
    cohortName: cohort?.cohort_name ?? '—',
    sessions: (await mySessions(event, user.id) ?? []).filter(s => !s.mine)
  }
})
