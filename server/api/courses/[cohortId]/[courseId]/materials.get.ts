import type { components } from '~~/shared/types/api'
import type { MaterialIndexRow } from '~~/shared/types'

/** Materials by type: released ones in outline order, course pages first (staff also get locked ones); the page filters by tag */
export default defineEventHandler(async (event): Promise<MaterialIndexRow[]> => {
  await requireUserSession(event)
  const cohortId = apiId(getRouterParam(event, 'cohortId'))
  const courseId = apiId(getRouterParam(event, 'courseId'))
  const rows = await apiFetch<components['schemas']['MaterialByType'][]>(event, `/cohorts/${cohortId}/courses/${courseId}/materials`)
  return rows.map(m => ({
    id: String(m.id),
    title: m.title,
    kind: m.kind,
    tags: m.tags,
    isReleased: m.is_released,
    releasesOn: m.releases_on ?? null,
    releaseHint: m.release_hint ?? null,
    lesson: m.lesson && { id: String(m.lesson.id), title: m.lesson.title },
    module: m.module && { id: String(m.module.id), title: m.module.title }
  }))
})
