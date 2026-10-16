import type { components } from '~~/shared/types/api'

/**
 * Removing a mentor unassigns their students (same transaction on the API). The API answers 204 without the
 * count PUT returns, so it's read just before the call: the mentor's current assignments in this cohort.
 */
export default defineEventHandler(async (event): Promise<{ unassignedMentees: number }> => {
  await requireRole(event, 'head')
  const cohortId = apiId(getRouterParam(event, 'id'))
  const userId = apiId(getRouterParam(event, 'userId'))
  const assignments = await apiFetch<components['schemas']['MentorAssignmentRead'][]>(event, `/cohorts/${cohortId}/mentors`)
  await apiFetch(event, `/cohorts/${cohortId}/staff/${userId}`, { method: 'DELETE' })
  return { unassignedMentees: assignments.filter(a => a.mentor.id === userId).length }
})
