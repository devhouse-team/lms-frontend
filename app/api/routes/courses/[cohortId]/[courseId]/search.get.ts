import type { components } from '~~/shared/types/api'
import type { CourseSearchHit } from '~~/shared/types'
import { defineEventHandler, getRouterParam, getQuery } from '~/api/utils/h3'

/** ⌘K inside a course: what the caller could open, by title and text (the API takes 2–100 characters, ≤ 50 hits) */
export default defineEventHandler(async (event): Promise<CourseSearchHit[]> => {
  await requireUserSession(event)
  const cohortId = apiId(getRouterParam(event, 'cohortId'))
  const courseId = apiId(getRouterParam(event, 'courseId'))
  const q = String(getQuery(event).q ?? '').trim().slice(0, 100)
  if (q.length < 2) return []
  const hits = await apiFetch<components['schemas']['SearchHit'][]>(event, `/cohorts/${cohortId}/courses/${courseId}/search`, { query: { q } })
  // Who I am here only matters for assignment links
  const staff = hits.some(h => h.type === 'assignment') && (await cohortRelation(event, cohortId)).staff
  return hits.map(h => ({
    type: h.type,
    title: h.title,
    snippet: h.snippet,
    lessonTitle: h.type === 'lesson' ? null : h.lesson?.title ?? null,
    to: h.type === 'assignment' ? workPath(cohortId, courseId, staff, h.assignment_id!, h.lesson?.id)
      : h.type === 'material' ? materialPath(cohortId, courseId, h.material_id!, h.lesson?.id)
        : `${coursePath(cohortId, courseId)}/lessons/${h.lesson!.id}`
  }))
})
