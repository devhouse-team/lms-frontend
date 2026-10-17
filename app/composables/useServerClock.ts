/**
 * A ticking clock aligned with the API's (spec course-content.md, Time and countdowns): skew = serverNow − Date.now()
 * at fetch time. Ticks every second; callers show seconds only in the last hour.
 */
export function useServerClock(serverNow: MaybeRefOrGetter<string | undefined>) {
  const skew = ref(0)
  watch(() => toValue(serverNow), (s) => {
    if (s) skew.value = Date.parse(s) - Date.now()
  }, { immediate: true })
  const now = ref(Date.now() + skew.value)
  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    timer = setInterval(() => (now.value = Date.now() + skew.value), 1000)
  })
  onBeforeUnmount(() => clearInterval(timer))
  watch(skew, () => (now.value = Date.now() + skew.value))

  const { t } = useI18n()
  /** "1 d 4 h" · "3 h 12 m" · "14:05" (under an hour) */
  function countdown(toIso: string) {
    const ms = Math.max(0, Date.parse(toIso) - now.value)
    const s = Math.floor(ms / 1000)
    const d = Math.floor(s / 86_400)
    const h = Math.floor((s % 86_400) / 3600)
    const m = Math.floor((s % 3600) / 60)
    if (d) return t('time.dh', { d, h })
    if (h) return t('time.hm', { h, m })
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }
  const until = (iso: string) => Date.parse(iso) - now.value
  return { now, countdown, until }
}
