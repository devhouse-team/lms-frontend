import type { NotificationItem, NotificationsResponse } from '~~/shared/types'

/**
 * The bell's data (spec notifications.md): the latest 20 and the unread count under one key, fetched on the client only.
 * `poll()` (the bell calls it once) refreshes every 60 s while the tab is visible and at once when it comes back;
 * a failed refresh keeps the last data quietly, and a 401 (session gone) stops it.
 */
export function useNotifications() {
  const { role, user, switchRole } = useAuth()
  const { t } = useI18n()
  const toast = useToast()
  const res = useFetch<NotificationsResponse>('/api/notifications', { key: 'notifications', query: { limit: 20 }, server: false, lazy: true })

  /** Both lists after a change: the bell's and the page's */
  const refreshAll = () => Promise.all([res.refresh(), refreshNuxtData('notifications-page')])

  function poll() {
    let timer: ReturnType<typeof setInterval> | undefined
    const tick = () => {
      if (document.visibilityState === 'visible') res.refresh()
    }
    const start = () => {
      clearInterval(timer)
      timer = setInterval(tick, 60_000)
    }
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
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
      if (e?.statusCode === 401) clearInterval(timer)
    })
  }

  /** Mark read without waiting (the next refresh corrects a failure), then go, switching view first when the page needs it */
  async function open(n: NotificationItem) {
    if (!n.read) {
      n.read = true
      if (res.data.value) res.data.value = { ...res.data.value, unread: Math.max(0, res.data.value.unread - 1) }
      $fetch(`/api/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {}).finally(() => refreshNuxtData('notifications-page'))
    }
    if (!n.to) return
    if (n.view && n.view !== role.value && user.value?.roles.includes(n.view)) return switchRole(n.view, n.to)
    return navigateTo(n.to)
  }

  async function readAll() {
    if (res.data.value) res.data.value = { unread: 0, items: res.data.value.items.map(i => ({ ...i, read: true })) }
    try {
      await $fetch('/api/notifications/read-all', { method: 'POST' })
    } catch (e) {
      const code = apiError(e).code
      toast.add({ title: code === 'rate_limited' ? t('notifications.err.rate') : code === 'api_unreachable' ? t('auth.err.network') : t('common.saveError'), color: 'error', icon: 'i-lucide-circle-alert' })
    }
    await refreshAll()
  }

  return { ...res, poll, open, readAll, refreshAll }
}
