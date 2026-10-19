<script setup lang="ts">
/**
 * The bell in every app page's navbar (spec notifications.md): unread count, a panel with the latest 20. Only an
 * increase of the count is announced, not every poll.
 */
const { t } = useI18n()
const { data, status, error, refresh, poll, open: openItem, readAll } = useNotifications()
poll()

const open = ref(false)
watch(open, (o) => {
  if (o) refresh()
})
const unread = computed(() => data.value?.unread ?? 0)
const badge = computed(() => (unread.value > 99 ? '99+' : String(unread.value)))

/** Only a rise between two known counts is announced (not the first load, not a failed refresh) */
const announce = ref('')
watch(() => data.value?.unread, (n, before) => {
  if (n != null && before != null && n > before) announce.value = t('notifications.new', { n: n - before }, n - before)
})

function go(item: Parameters<typeof openItem>[0]) {
  open.value = false
  openItem(item)
}
</script>

<template>
  <USlideover v-model:open="open" side="right" :title="t('notifications.title')" :ui="{ content: 'max-sm:max-w-none' }">
    <UChip :show="unread > 0" size="2xl" color="primary" inset :ui="{ base: 'num' }">
      <!-- The button's label carries the number -->
      <template #content><span aria-hidden="true">{{ badge }}</span></template>
      <UButton
        icon="i-lucide-bell"
        color="neutral"
        variant="ghost"
        class="size-10 justify-center"
        :aria-label="unread ? t('notifications.open', { n: unread }, unread) : t('notifications.openNone')"
        aria-haspopup="dialog"
      />
    </UChip>

    <template #actions>
      <UButton v-if="unread" :label="t('notifications.readAll')" color="neutral" variant="ghost" size="xs" @click="readAll()" />
    </template>

    <template #body>
      <div class="-mx-4 -my-4 sm:-mx-6 sm:-my-6">
        <div v-if="!data && (status === 'pending' || status === 'idle')" class="space-y-3 p-4" aria-busy="true">
          <USkeleton v-for="i in 3" :key="i" class="h-12 w-full" />
        </div>
        <div v-else-if="!data && error" class="flex items-center gap-3 p-4 text-sm text-muted">
          {{ t('notifications.loadError') }}
          <UButton :label="t('common.retry')" color="neutral" variant="outline" size="xs" @click="refresh()" />
        </div>
        <UEmpty v-else-if="!data?.items.length" icon="i-lucide-bell-off" :title="t('notifications.empty.title')" :description="t('notifications.empty.text')" class="py-12" />
        <NotificationList v-else :items="data.items" @open="go" />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-wrap justify-between gap-2">
        <UButton to="/notifications" :label="t('notifications.seeAll')" color="neutral" variant="outline" size="sm" @click="open = false" />
        <UButton to="/notifications#email" :label="t('notifications.emailSettings')" color="neutral" variant="ghost" size="sm" @click="open = false" />
      </div>
    </template>
  </USlideover>
  <span class="sr-only" aria-live="polite">{{ announce }}</span>
</template>
