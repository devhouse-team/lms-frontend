import type { components } from '~~/shared/types/api'
import type { CohortSolution } from '~~/shared/types'

/** The cohort's solutions with their release state; `canRelease` says whether this user may release or hide them */
export default defineEventHandler(async (event): Promise<CohortSolution[]> => {
  await requireUserSession(event)
  const list = await apiFetch<components['schemas']['CohortSolutionRead'][]>(event, `/cohorts/${apiId(getRouterParam(event, 'id'))}/solutions`)
  return list.map(s => ({
    materialId: String(s.material.id),
    title: s.material.title,
    kind: s.material.kind,
    assignment: { id: String(s.assignment.id), title: s.assignment.title, mode: s.assignment.mode },
    lessonTitle: s.lesson?.title ?? null,
    release: s.release,
    isReleased: s.is_released,
    releasesOn: s.releases_on,
    releasedAt: s.released_at,
    releasedBy: s.released_by?.name ?? null,
    canRelease: s.can_release
  }))
})
