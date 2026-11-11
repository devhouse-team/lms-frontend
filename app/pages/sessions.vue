<script setup lang="ts">
import type { SessionItem } from '~~/shared/types'

definePageMeta({ roles: ['mentor'] })

const { t, locale } = useI18n()
const { left } = useCountdown()
const toast = useToast()
const { toastError } = useSessionErrors()
useHead({ title: () => `${t('nav.sessions')} · dev.house` })

const { data, status, refresh } = await useFetch('/api/sessions', { key: 'sessions' })
const dayKey = (iso: string) => new Intl.DateTimeFormat(locale.value, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso))
const time = (iso: string) => new Intl.DateTimeFormat(locale.value, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

const days = computed(() => {
  const map = new Map<string, SessionItem[]>()
  for (const s of data.value?.items ?? []) {
    if (!s.mine) continue
    const k = dayKey(s.at)
    map.set(k, [...(map.get(k) ?? []), s])
  }
  return [...map.entries()]
})

const formOpen = ref(false)
const editing = ref<SessionItem>()
const cancelling = ref<SessionItem>()
const cancelOpen = computed({ get: () => !!cancelling.value, set: (v) => { if (!v) cancelling.value = undefined } })
const busy = ref(false)

function openForm(s?: SessionItem) {
  editing.value = s
  formOpen.value = true
}

/** The home rail shows these too */
function saved() {
  clearNuxtData('dashboard-mentor')
  refresh()
}

async function cancel() {
  const s = cancelling.value
  if (!s || busy.value) return
  busy.value = true
  try {
    await $fetch(`/api/sessions/${s.id}/cancel`, { method: 'POST' })
    toast.add({ title: t('sessions.cancelled'), icon: 'i-lucide-check', color: 'success' })
  } catch (e) {
    toastError(e)
  } finally {
    busy.value = false
    cancelling.value = undefined
    saved()
  }
}
</script>

<template>
  <AppPage :title="t('nav.sessions')">
    <HomeState :status="status" :has-data="!!data" @retry="refresh()">
      <UEmpty v-if="data && !data.available" icon="i-lucide-calendar" :title="t('common.soon')" :description="t('common.soonText')" class="py-12" />
      <div v-else-if="data" class="mx-auto w-full max-w-3xl space-y-8">
        <header class="flex items-center justify-between gap-4">
          <h1 class="text-xl font-semibold tracking-tight text-highlighted">{{ t('mentor.sessions') }}</h1>
          <UButton icon="i-lucide-plus" :label="t('sessions.new')" color="primary" @click="openForm()" />
        </header>
        <section v-for="[day, items] in days" :key="day" :aria-label="day">
          <h2 class="mb-3 text-sm font-semibold capitalize text-highlighted">{{ day }}</h2>
          <ul class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
            <li v-for="s in items" :key="s.id" class="flex items-center gap-3 px-4 py-3">
              <span class="num w-12 shrink-0 text-sm text-highlighted" :class="{ 'line-through decoration-dimmed': s.cancelled }">{{ time(s.at) }}</span>
              <UIcon :name="s.kind === 'group' ? 'i-lucide-users' : 'i-lucide-user'" class="size-4 shrink-0 text-muted" />
              <span class="min-w-0 flex-1 truncate text-sm text-highlighted" :class="{ 'line-through decoration-dimmed': s.cancelled }">{{ t(`sessions.kind.${s.kind}`) }} · <span class="text-muted">{{ s.with }}</span></span>
              <UBadge v-if="s.cancelled" :label="t('sessions.cancelledBadge')" color="neutral" variant="subtle" size="sm" />
              <template v-else>
                <span class="num shrink-0 text-xs text-muted">{{ left(s.at) }}</span>
                <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" :aria-label="t('sessions.edit')" @click="openForm(s)" />
                <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" :aria-label="t('sessions.cancel')" @click="cancelling = s" />
              </template>
            </li>
          </ul>
        </section>
        <UEmpty v-if="!days.length" icon="i-lucide-calendar" :description="t('mentor.noSessions')" />
      </div>
    </HomeState>
    <SessionFormModal v-model:open="formOpen" :session="editing" @saved="saved" @stale="saved" />
    <UModal v-model:open="cancelOpen" :title="t('sessions.cancelTitle')">
      <template #body>
        <p class="text-sm text-default">{{ t('sessions.cancelConfirm') }}</p>
      </template>
      <template #footer>
        <UButton :label="t('sessions.keep')" color="neutral" variant="ghost" @click="cancelling = undefined" />
        <UButton :label="t('sessions.cancel')" color="error" :loading="busy" @click="cancel()" />
      </template>
    </UModal>
  </AppPage>
</template>
