/** A material's file in a cohort (students, staff) */
export default defineEventHandler(event => redirectToFile(event,
  `/cohorts/${fileParam(event, 'cohortId')}/materials/${fileParam(event, 'materialId')}/files/${fileParam(event, 'fileId')}`))
