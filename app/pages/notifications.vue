<script setup lang="ts">
import type { NotificationPreference, NotificationsResponse, NotificationType } from '~~/shared/types'

/**
 * All notifications (the latest 100: the API's maximum, no paging) with an Unread tab, "mark all read", and the email
 * switches per type my views can receive (`#email`). Spec: notifications.md.
 */
const route = useRoute()
const { t } = useI18n()
const toast = useToast()
const { user } = useAuth()
const { open, readAll } = useNotifications()
useHead({ title: () => `${t('notifications.title')} · dev.house` })

const unreadOnly = computed(() => route.query.unread === '1')
const tab = computed({
  get: () => (unreadOnly.value ? 'unread' : 'all'),
  set: (v: string) => navigateTo({ query: v === 'unread' ? { unread: '1' } : {}, hash: route.hash })
})
const tabs = computed(() => [{ value: 'all', label: t('notifications.all') }, { value: 'unread', label: t('notifications.unread') }])

const { data: fetched, status, error, refresh } = useFetch<NotificationsResponse>('/api/notifications', {
  key: 'notifications-page',
  query: computed(() => ({ limit: 100, ...(unreadOnly.value ? { unread: '1' } : {}) })),
  server: false,
  lazy: true
})

/** The last good list: a failed refresh (Nuxt resets data then) keeps it on screen */
const last = shallowRef<NotificationsResponse>()
watch(fetched, (d) => {
  if (d) last.value = d
}, { immediate: true })
watch(unreadOnly, () => (last.value = undefined))
const data = computed(() => last.value)

// ---- email switches ---------------------------------------------------------------
const STUDENT: NotificationType[] = ['review_completed', 'lesson_released', 'deadline_soon', 'enrollment_created', 'exam_opens_soon', 'solution_released']
const mine = computed<NotificationType[]>(() => [
  ...(user.value?.roles.includes('mentor') ? ['submission_created' as const] : []),
  ...(user.value?.roles.includes('mentee') ? STUDENT : [])
])
const { data: prefs, status: prefsStatus, error: prefsError, refresh: refreshPrefs } = useFetch<NotificationPreference[]>('/api/notifications/preferences', {
  key: 'notification-prefs', server: false, lazy: true, default: () => []
})
const shown = computed(() => mine.value.map(type => ({ type, email: prefs.value.find(p => p.type === type)?.email ?? true })))
const saving = ref(new Set<NotificationType>())

async function setEmail(type: NotificationType, email: boolean) {
  saving.value = new Set(saving.value).add(type)
  const set = (on: boolean) => (prefs.value = [...prefs.value.filter(p => p.type !== type), { type, email: on }])
  set(email)
  try {
    prefs.value = await $fetch('/api/notifications/preferences', { method: 'PUT', body: [{ type, email }] })
  } catch (e) {
    set(!email) // only this switch flips back; another one may be saving meanwhile
    toast.add({ title: apiError(e).code === 'rate_limited' ? t('notifications.err.rate') : t('common.saveError'), color: 'error', icon: 'i-lucide-circle-alert' })
    refreshPrefs()
  } finally {
    const next = new Set(saving.value)
    next.delete(type)
    saving.value = next
  }
}
</script>

<template>
  <AppPage :title="t('notifications.title')">
    <div class="mx-auto w-full max-w-3xl space-y-10">
      <section aria-labelledby="ntf-title" class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 id="ntf-title" class="text-[1.75rem] font-semibold leading-tight tracking-tight text-highlighted">
            {{ t('notifications.title') }}
            <span v-if="data?.unread" class="num ms-1 text-base font-normal text-muted">{{ t('notifications.unreadCount', { n: data.unread }, data.unread) }}</span>
          </h2>
          <UButton v-if="data?.unread" :label="t('notifications.readAll')" icon="i-lucide-check-check" color="neutral" variant="outline" size="sm" @click="readAll()" />
        </div>
        <UTabs v-model="tab" :items="tabs" :content="false" variant="link" color="primary" />

        <div v-if="!data && (status === 'pending' || status === 'idle')" class="space-y-3" aria-busy="true">
          <USkeleton v-for="i in 5" :key="i" class="h-14 w-full" />
        </div>
        <div v-else-if="!data && error" class="flex items-center gap-3 rounded-lg px-4 py-6 text-sm text-muted ring-1 ring-inset ring-default">
          {{ t('notifications.loadError') }}
          <UButton :label="t('common.retry')" color="neutral" variant="outline" size="xs" @click="refresh()" />
        </div>
        <template v-else-if="data">
          <UEmpty v-if="!data.items.length && unreadOnly" icon="i-lucide-check-check" :title="t('notifications.emptyUnread')" />
          <UEmpty v-else-if="!data.items.length" icon="i-lucide-bell-off" :title="t('notifications.empty.title')" :description="t('notifications.empty.text')" />
          <div v-else class="overflow-hidden rounded-lg ring-1 ring-inset ring-default">
            <NotificationList :items="data.items" @open="open" />
          </div>
          <p v-if="data.items.length >= 100" class="text-xs text-muted">{{ t('notifications.limitNote') }}</p>
        </template>
      </section>

      <section id="email" aria-labelledby="email-title" class="scroll-mt-20 space-y-3">
        <h2 id="email-title" class="text-sm font-semibold text-highlighted">{{ t('notifications.email.title') }}</h2>
        <p id="email-hint" class="text-sm text-muted">{{ t('notifications.email.hint') }}</p>
        <p v-if="!mine.length" class="text-sm text-muted">{{ t('notifications.email.none') }}</p>
        <div v-else-if="prefsError && !prefs.length" class="flex items-center gap-3 rounded-lg px-4 py-6 text-sm text-muted ring-1 ring-inset ring-default">
          {{ t('notifications.loadError') }}
          <UButton :label="t('common.retry')" color="neutral" variant="outline" size="xs" @click="refreshPrefs()" />
        </div>
        <div v-else-if="prefsStatus === 'pending' && !prefs.length" class="space-y-2" aria-busy="true"><USkeleton v-for="i in 3" :key="i" class="h-10 w-full" /></div>
        <ul v-else class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
          <li v-for="p in shown" :key="p.type" class="px-4 py-3">
            <USwitch
              :model-value="p.email"
              :label="t(`notifications.type.${p.type}`)"
              :disabled="saving.has(p.type)"
              :loading="saving.has(p.type)"
              aria-describedby="email-hint"
              :ui="{ root: 'flex-row-reverse justify-between gap-4', wrapper: 'ms-0' }"
              @update:model-value="(v: boolean) => setEmail(p.type, v)"
            />
          </li>
        </ul>
      </section>
    </div>
  </AppPage>
</template>
