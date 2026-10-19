<script setup lang="ts">
import type { CohortSolution } from '~~/shared/types'

/**
 * Solutions in one cohort, collapsed by default: rule, state, and (when the API allows, `canRelease`) "Release now"
 * and, for a manual release, "Hide again". Works in finished cohorts too. Mentors without the right see it read-only.
 */
const props = defineProps<{ cohortId: string, cohortName: string }>()
const { t, locale } = useI18n()
const toast = useToast()
const { toastError } = useApiErrors('content')
const { long } = useCohortFormat()

const open = ref(false)
const { data, status, refresh, execute } = useLazyFetch<CohortSolution[]>(() => `/api/cohorts/${props.cohortId}/solutions`, {
  key: `cohort-solutions:${props.cohortId}`, immediate: false, server: false, default: () => []
})
watch(open, (o) => {
  if (o && status.value === 'idle') execute()
})
const { page, items, total, size } = usePaged(data, 10)
const fmt = (iso: string) => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
function state(s: CohortSolution) {
  if (s.releasedAt) return t('solution.releasedBy', { date: fmt(s.releasedAt), name: s.releasedBy ?? '—' })
  if (s.isReleased) return t('solution.released')
  if (s.release === 'after_due' && s.releasesOn) return t('solution.opensOn', { date: long(s.releasesOn) })
  if (s.release === 'after_submit') return t('solution.afterSubmit')
  return t('solution.hidden')
}

const releasing = ref<CohortSolution>()
const confirmOpen = computed({ get: () => !!releasing.value, set: (v) => { if (!v) releasing.value = undefined } })
const busy = ref(false)
async function call(s: CohortSolution, method: 'PUT' | 'DELETE') {
  busy.value = true
  try {
    await $fetch(`/api/cohorts/${props.cohortId}/solutions/${s.materialId}`, { method })
    toast.add({ title: method === 'PUT' ? t('solution.releasedToast') : t('solution.hiddenToast'), icon: 'i-lucide-check', color: 'success' })
    clearNuxtData(k => k.startsWith(`assignment:${props.cohortId}:`) || k.startsWith(`lesson:${props.cohortId}:`) || k.startsWith(`course-materials:${props.cohortId}:`))
  } catch (e) {
    toastError(e)
  } finally {
    busy.value = false
    releasing.value = undefined
    refresh()
  }
}
</script>

<template>
  <UCollapsible v-model:open="open" class="rounded-lg ring-1 ring-inset ring-default">
    <UButton :label="t('solution.cohortTitle')" color="neutral" variant="ghost" block trailing-icon="i-lucide-chevron-down" class="justify-between px-4 py-3" :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform' }" />
    <template #content>
      <div v-if="status === 'pending'" class="space-y-2 border-t border-default p-4"><USkeleton v-for="i in 2" :key="i" class="h-8 w-full" /></div>
      <p v-else-if="status === 'error'" class="border-t border-default px-4 py-4 text-sm text-muted">{{ t('home.loadError') }}</p>
      <p v-else-if="!data.length" class="border-t border-default px-4 py-4 text-sm text-muted">{{ t('solution.none') }}</p>
      <ul v-else class="divide-y divide-default border-t border-default">
        <li v-for="s in items" :key="s.materialId" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
          <div class="min-w-0 flex-1 basis-48">
            <p class="truncate text-sm text-highlighted">{{ s.title }}</p>
            <p class="truncate text-xs text-muted">{{ s.assignment.title }}<template v-if="s.lessonTitle"> · {{ s.lessonTitle }}</template></p>
          </div>
          <span class="num text-xs" :class="s.isReleased || s.releasedAt ? 'text-success' : 'text-muted'">{{ state(s) }}</span>
          <template v-if="s.canRelease">
            <UButton v-if="!s.isReleased && !s.releasedAt" :label="t('solution.releaseNow')" color="neutral" variant="outline" size="xs" @click="releasing = s" />
            <UButton v-if="s.releasedAt" :label="t('solution.hideAgain')" color="neutral" variant="ghost" size="xs" :loading="busy" @click="call(s, 'DELETE')" />
          </template>
        </li>
      </ul>
      <ListPager v-model:page="page" :total="total" :size="size" class="border-t border-default px-4 py-2" />
    </template>
  </UCollapsible>
  <UModal v-model:open="confirmOpen" :title="t('solution.releaseTitle')">
    <template #body>
      <p class="text-sm">{{ t('solution.releaseConfirm', { title: releasing?.title ?? '', cohort: cohortName }) }}</p>
    </template>
    <template #footer>
      <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="confirmOpen = false" />
      <UButton :label="t('solution.releaseNow')" color="primary" :loading="busy" @click="call(releasing!, 'PUT')" />
    </template>
  </UModal>
</template>
