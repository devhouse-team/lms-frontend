import type { BillingStatus } from '~~/shared/types'

/** Payment dates and badges for display. Due dates are calendar days (`YYYY-MM-DD`): formatted in UTC, never shifted. */
export function usePaymentFormat() {
  const { t, locale } = useI18n()

  const date = (d: string) =>
    new Intl.DateTimeFormat(locale.value, { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${d.slice(0, 10)}T00:00:00Z`))

  /** "5 days left" · "Due tomorrow" · "Due today" · "3 days late" */
  const left = (days: number | null) => {
    if (days === null) return '—'
    if (days < 0) return t('payment.late', -days)
    if (days === 0) return t('payment.today')
    if (days === 1) return t('payment.tomorrow')
    return t('payment.left', days)
  }

  // Status is a tint plus a word (DESIGN.md: Status-Is-A-Tint, Never-Colour-Alone)
  const badges: Record<BillingStatus, { color: 'neutral' | 'primary' | 'success' | 'warning' | 'error', icon: string }> = {
    exempt: { color: 'neutral', icon: 'i-lucide-minus' },
    paid: { color: 'success', icon: 'i-lucide-check' },
    due_soon: { color: 'warning', icon: 'i-lucide-clock' },
    overdue: { color: 'error', icon: 'i-lucide-circle-alert' }
  }
  const badge = (s: BillingStatus) => ({ label: t(`payment.status.${s}`), ...badges[s], variant: 'subtle' as const, size: 'sm' as const })

  return { date, left, badge }
}
