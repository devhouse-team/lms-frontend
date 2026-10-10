import { z } from 'zod'

const body = z.object({ registered: z.boolean() })

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'mentee')
  const { registered } = await readValidatedBody(event, body.parse)
  if (registered) db.contestRegistrations.add(user.id)
  else db.contestRegistrations.delete(user.id)
  return { registered }
})
