export function useCountdown() {
  const { t, locale } = useI18n()
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

  const rtf = computed(() => new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' }))
  /** "3 days ago" / "in 2 hours" in words, for a date with the absolute value in a tooltip */
  function relative(iso: string) {
    const sec = (Date.parse(iso) - now.value) / 1000
    const steps: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31_536_000], ['month', 2_592_000], ['week', 604_800], ['day', 86_400], ['hour', 3_600], ['minute', 60]]
    const [unit, size] = steps.find(([, s]) => Math.abs(sec) >= s) ?? ['minute', 60]
    return rtf.value.format(Math.round(sec / size), unit)
  }

  return { left, ago, urgent, stale, relative }
}
