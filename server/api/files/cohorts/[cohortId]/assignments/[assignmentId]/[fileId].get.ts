/** A statement attachment in a cohort (an exam's only once it opens) */
export default defineEventHandler(event => redirectToFile(event,
  `/cohorts/${fileParam(event, 'cohortId')}/assignments/${fileParam(event, 'assignmentId')}/files/${fileParam(event, 'fileId')}`))
