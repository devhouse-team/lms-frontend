import type { NotificationItem, NotificationsResponse } from '~~/shared/types'

/** Every row read, or one row read, as a new object (the caches are replaced, never mutated) */
const markRead = (r: NotificationsResponse, id?: string): NotificationsResponse => ({
  unread: id ? Math.max(0, r.unread - (r.items.some(i => i.id === id && !i.read) ? 1 : 0)) : 0,
  items: r.items.map(i => (!id || i.id === id ? { ...i, read: true } : i))
})

/**
 * The bell's data (spec notifications.md): the latest 20 and the unread count, fetched on the client only. `data` is the
 * last good answer: a failed refresh (Nuxt resets `data` then) keeps it, so the badge doesn't vanish and no false
 * "new" is announced. `poll()` (the bell calls it once) refreshes every 60 s while the tab is visible and at once
 * when it comes back; a 401 (session gone) stops it and goes to sign-in.
 */
export function useNotifications() {
  const { role, user, switchRole } = useAuth()
  const { t } = useI18n()
  const toast = useToast()
  const res = useFetch<NotificationsResponse>('/api/notifications', { key: 'notifications', query: { limit: 20 }, server: false, lazy: true })
  const last = useState<NotificationsResponse | null>('notifications-last', () => null)
  watch(res.data, (d) => {
    if (d) last.value = d
  }, { immediate: true })
  const data = computed(() => last.value)
  /** The page's list, updated the same way */
  const page = useNuxtData<NotificationsResponse>('notifications-page')

  /** Both lists after a change: the bell's and the page's */
  const refreshAll = () => Promise.all([res.refresh(), refreshNuxtData('notifications-page')])

  function poll() {
    let timer: ReturnType<typeof setInterval> | undefined
    let stopped = false
    let lastTick = 0
    const tick = () => {
      // focus and visibilitychange often fire together: one request
      if (stopped || document.visibilityState !== 'visible' || Date.now() - lastTick < 2000) return
      lastTick = Date.now()
      res.refresh()
    }
    const start = () => {
      clearInterval(timer)
      if (!stopped) timer = setInterval(tick, 60_000)
    }
    const onVisible = () => {
      if (stopped || document.visibilityState !== 'visible') return
      tick()
      start()
    }
    onMounted(() => {
      start()
      document.addEventListener('visibilitychange', onVisible)
      window.addEventListener('focus', tick)
    })
    onBeforeUnmount(() => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', tick)
    })
    watch(res.error, (e) => {
      if (e?.statusCode !== 401 || stopped) return
      stopped = true
      clearInterval(timer)
      navigateTo('/login')
    })
  }

  /** Mark read without waiting (the next refresh corrects a failure), then go, switching view first when the page needs it */
  async function open(n: NotificationItem) {
    if (!n.read) {
      if (last.value) last.value = markRead(last.value, n.id)
      if (page.data.value) page.data.value = markRead(page.data.value, n.id)
      $fetch(`/api/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {}).finally(() => refreshNuxtData('notifications-page'))
    }
    if (!n.to) return
    if (n.view && n.view !== role.value && user.value?.roles.includes(n.view)) return switchRole(n.view, n.to)
    return navigateTo(n.to)
  }

  async function readAll() {
    if (last.value) last.value = markRead(last.value)
    if (page.data.value) page.data.value = markRead(page.data.value)
    try {
      await $fetch('/api/notifications/read-all', { method: 'POST' })
    } catch (e) {
      const code = apiError(e).code
      toast.add({ title: code === 'rate_limited' ? t('notifications.err.rate') : code === 'api_unreachable' ? t('auth.err.network') : t('common.saveError'), color: 'error', icon: 'i-lucide-circle-alert' })
    }
    await refreshAll()
  }

  return { data, status: res.status, error: res.error, refresh: res.refresh, poll, open, readAll, refreshAll }
}
