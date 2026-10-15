import { z } from 'zod'

/** Staff side: an assignment is attached to a lesson and due N days after the lesson opens */
export const assignmentBody = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(1).max(5000),
  dueOffsetDays: z.number().int().min(0).max(365).nullable()
})

export const toAssignmentWrite = (a: z.infer<typeof assignmentBody>) =>
  ({ title: a.title, instructions: a.description, due_offset_days: a.dueOffsetDays })
