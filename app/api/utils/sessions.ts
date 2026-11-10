import type { ApiEvent as H3Event } from './h3'
import type { SessionItem } from '~~/shared/types'

/**
 * Mentoring session API shape (spec features/sessions-api.md, O38). Hand-written until the backend ships it in
 * openapi.json; then use `components['schemas'][...]`.
 */
export interface ApiSession {
  id: number | string
  kind: 'group' | 'one'
  cohort_id: number | string
  cohort_name: string
  mentor_id: number | string
  mentor_name: string
  student_id: number | string | null
  student_name: string | null
  starts_at: string
  duration_min: number
  link: string | null
  note: string | null
  cancelled_at: string | null
}

/** `me` is the viewer: a mentor sees the student (1:1) or the cohort (group), a student sees the mentor */
export const sessionOf = (s: ApiSession, me: string): SessionItem => ({
  id: String(s.id),
  kind: s.kind,
  at: s.starts_at,
  with: String(s.mentor_id) === me ? (s.student_name ?? s.cohort_name) : s.mentor_name,
  cohortId: String(s.cohort_id),
  cohortName: s.cohort_name,
  studentId: s.student_id === null ? undefined : String(s.student_id),
  durationMin: s.duration_min,
  link: s.link ?? undefined,
  note: s.note ?? undefined,
  cancelled: s.cancelled_at !== null,
  mine: String(s.mentor_id) === me
})

/** Own sessions from now on, in the API's order; `undefined` (not available yet) when the API has none or fails. 401 still ends the session. */
export async function mySessions(event: H3Event | undefined, me: string): Promise<SessionItem[] | undefined> {
  try {
    return (await apiFetch<ApiSession[]>(event, '/me/sessions')).map(s => sessionOf(s, me))
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode === 401) throw e
    return undefined
  }
}

/** The student's next upcoming session of their cohort that they don't run and isn't cancelled (`sessions` are ordered by start) */
export const nextSessionAt = (sessions: SessionItem[] | undefined, cohortId: string, now = Date.now()) =>
  sessions?.find(s => s.cohortId === cohortId && !s.mine && !s.cancelled && Date.parse(s.at) > now)?.at
