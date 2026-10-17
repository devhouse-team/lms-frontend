/** A material's file for its editors (any publish state) */
export default defineEventHandler(event => redirectToFile(event, `/materials/${fileParam(event, 'materialId')}/files/${fileParam(event, 'fileId')}`))
