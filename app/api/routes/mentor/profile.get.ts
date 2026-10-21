import type { MentorProfile, SessionItem } from '~~/shared/types'
import { defineEventHandler } from '~/api/utils/h3'

/** Mentor from the API; sessions have no API yet and stay on the mock */
export default defineEventHandler(async (event): Promise<MentorProfile> => {
  const user = await requireRole(event, 'mentee')
  const cohort = (await activeStudentCohorts(event))[0]
  const mentor = cohort ? await studentMentor(event, cohort.cohort_id, user.id) : undefined
  return {
    mentor: mentor ? { ...person(mentor), title: '' } : null,
    cohortName: cohort?.cohort_name ?? '—',
    sessions: await $fetch<SessionItem[]>('/api/sessions')
  }
})
