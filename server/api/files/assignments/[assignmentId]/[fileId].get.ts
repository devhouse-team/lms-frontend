/** A statement attachment for the course's editors (any state) */
export default defineEventHandler(event => redirectToFile(event, `/assignments/${fileParam(event, 'assignmentId')}/files/${fileParam(event, 'fileId')}`))
