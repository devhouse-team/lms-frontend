/** A submission's file (its author, reviewers) */
export default defineEventHandler(event => redirectToFile(event, `/submissions/${fileParam(event, 'submissionId')}/files/${fileParam(event, 'fileId')}`))
