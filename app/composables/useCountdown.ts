export function useCountdown() {
  const { t } = useI18n()
  const now = useNow()

  /** Time until `iso`: "2д 4ч" / "3h 12m" / "5m" */
  function left(iso: string) {
    return span(new Date(iso).getTime() - now.value)
  }

  /** Time since `iso`, same format */
  function ago(iso: string) {
    return span(now.value - new Date(iso).getTime())
  }

  function span(ms: number) {
    if (ms <= 0) return t('time.now')
    const mins = Math.floor(ms / 60_000)
    const d = Math.floor(mins / 1440)
    const h = Math.floor((mins % 1440) / 60)
    const m = mins % 60
    if (d > 0) return t('time.dh', { d, h })
    if (h > 0) return t('time.hm', { h, m })
    return t('time.m', { m: Math.max(m, 1) })
  }

  /** Less than `hours` until `iso` */
  function urgent(iso: string, hours = 24) {
    return new Date(iso).getTime() - now.value < hours * 3_600_000
  }

  /** More than `hours` since `iso` */
  function stale(iso: string, hours = 48) {
    return now.value - new Date(iso).getTime() > hours * 3_600_000
  }

  return { left, ago, urgent, stale }
}
