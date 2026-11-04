import type { AssignmentMode } from '~~/shared/types'

/** Starting points for a new assignment (course wizard, add dialog): mode, timing and limits; the title is typed or localized by the caller */
export const ASSIGNMENT_TEMPLATES = {
  weekly: { mode: 'homework', max_files: 3, timing: { due_offset_days: 7 } },
  exam: { mode: 'exam', max_files: 1, timing: { opens_offset_days: 4, opens_time: '14:00', duration_minutes: 120, trial_enabled: true } },
  practice: { mode: 'practice', max_files: 3, timing: {} }
} as const satisfies Record<string, { mode: AssignmentMode, max_files: number, timing: object }>

export type AssignmentTemplate = keyof typeof ASSIGNMENT_TEMPLATES
