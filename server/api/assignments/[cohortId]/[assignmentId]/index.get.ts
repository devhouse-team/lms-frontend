import type { components } from '~~/shared/types/api'
import type { AssignmentDetail } from '~~/shared/types'

type S = components['schemas']

/**
 * One assignment for the student in one cohort: mode, formats, window or due day, phase and what may be sent now
 * (`can_submit`, `can_trial`), attempts, trials, solutions. The API hides an exam's statement until it opens.
 */
export default defineEventHandler(async (event): Promise<AssignmentDetail> => {
  const user = await requireRole(event, 'mentee')
  const cohortId = apiId(getRouterParam(event, 'cohortId'))
  const assignmentId = apiId(getRouterParam(event, 'assignmentId'))
  const [a, cohort, staff, mentor] = await Promise.all([
    apiFetch<S['StudentAssignment']>(event, `/cohorts/${cohortId}/assignments/${assignmentId}`),
    apiFetch<S['CohortRead']>(event, `/cohorts/${cohortId}`),
    listStaff(event, cohortId),
    studentMentor(event, cohortId, user.id)
  ])
  const submissions = [...a.submissions].sort(byVersionDesc)
  return {
    id: String(a.id),
    cohortId: String(cohortId),
    title: a.title,
    mode: a.mode,
    statement: a.statement,
    files: a.files.map(fileMeta),
    accepts: { text: a.accepts.text, links: a.accepts.links, files: a.accepts.files, maxFiles: a.accepts.max_files, fileTypes: a.accepts.file_types },
    maxScore: a.max_score,
    trialEnabled: a.trial_enabled,
    dueOn: a.due_on,
    dueAt: a.mode === 'homework' ? dueAt(a.due_on) : undefined,
    opensAt: a.opens_at,
    closesAt: a.closes_at,
    timezone: a.timezone,
    serverNow: a.server_time,
    phase: a.phase,
    canSubmit: a.can_submit,
    canTrial: a.can_trial,
    cohortName: cohort.name,
    cohort: { status: cohort.status, startsOn: cohort.starts_on, endsOn: cohort.ends_on, finishedAt: cohort.finished_at },
    mentor: mentor ? person(mentor) : null,
    status: submissions[0] ? toUiStatus(submissions[0].status) : 'not_submitted',
    submissions: submissions.map(s => submissionView(s, staff)),
    trials: a.trials.map(s => submissionView(s, staff)),
    solutions: a.solutions.map(materialView)
  }
})
