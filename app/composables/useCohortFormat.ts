import type { CohortStatus, CohortTiming } from '~~/shared/types'

/**
 * Cohort status, week and dates for display. Everything comes from the API (status, week, total_weeks,
 * finished_at); dates are UTC calendar days (D5), so they're formatted in UTC and never shifted.
 */
export function useCohortFormat() {
  const { t, locale } = useI18n()

  const day = (d: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale.value, { timeZone: 'UTC', ...opts }).format(new Date(`${d.slice(0, 10)}T00:00:00Z`))
  const short = (d: string) => day(d, { day: 'numeric', month: 'short' })
  const long = (d: string) => day(d, { day: 'numeric', month: 'long', year: 'numeric' })
  const range = (from: string, to: string) => `${day(from, { day: 'numeric', month: 'short' })} – ${day(to, { day: 'numeric', month: 'short', year: 'numeric' })}`
  const finishedDay = (c: Pick<CohortTiming, 'finishedAt' | 'endsOn'>) => c.finishedAt ?? c.endsOn

  /** "starts 12 Jan" · "week 3 of 26" · "finished 3 Mar" */
  const weekLine = (c: CohortTiming) =>
    c.status === 'planned'
      ? t('cohortStatus.startsOn', { date: short(c.startsOn) })
      : c.status === 'finished'
        ? t('cohortStatus.finishedOn', { date: short(finishedDay(c)) })
        : t('mentor.week', { week: c.week, total: c.totalWeeks })

  const badges: Record<CohortStatus, { color: 'neutral' | 'primary', variant: 'subtle' | 'outline' }> = {
    planned: { color: 'neutral', variant: 'subtle' },
    active: { color: 'primary', variant: 'subtle' },
    finished: { color: 'neutral', variant: 'outline' }
  }
  const statusBadge = (s: CohortStatus) => ({ label: t(`cohortStatus.${s}`), ...badges[s], size: 'sm' as const })

  return { short, long, range, finishedDay, weekLine, statusBadge }
}
