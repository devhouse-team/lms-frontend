<script setup lang="ts">
import type { CohortDetail, CohortRosterRow } from '~~/shared/types'

/** One cohort, head view. The API owns status; this page hides what the API would refuse (cohorts.md, state rules). */
definePageMeta({ roles: ['head'] })
const route = useRoute()
const id = computed(() => String(route.params.id))
const { t } = useI18n()
const toast = useToast()
const { long, range, finishedDay, weekLine, statusBadge } = useCohortFormat()
const { toastError, code } = useCohortErrors()

// Header (with staff and assignments) and roster load separately, so roster changes don't reload assignments
const { data, status, error, refresh } = await useFetch<CohortDetail>(() => `/api/cohorts/${id.value}`, { key: `cohort:${id.value}` })
const { data: roster, status: rosterStatus, refresh: refreshRoster } = useLazyFetch<CohortRosterRow[]>(() => `/api/cohorts/${id.value}/roster`, {
  key: `cohort-roster:${id.value}`, default: () => []
})
useHead({ title: () => `${data.value?.name ?? t('nav.cohorts')} · dev.house` })

const notFound = computed(() => error.value?.statusCode === 404)
const finished = computed(() => data.value?.status === 'finished')
const mentors = computed(() => data.value?.staff.filter(s => s.role === 'mentor') ?? [])
const current = computed(() => roster.value.filter(r => r.enrollment === 'active' || r.enrollment === 'paused'))
const waitingTotal = computed(() => roster.value.reduce((sum, r) => sum + r.waiting, 0))

const editing = ref(false)
const adding = ref(false)
const refreshAll = () => Promise.all([refresh(), refreshRoster()])

// ---- finish / cancel / delete --------------------------------------------------
const dialog = ref<'finish' | 'cancel' | 'delete'>()
const dialogOpen = computed({ get: () => !!dialog.value, set: (v) => { if (!v) dialog.value = undefined } })
const busy = ref(false)

async function confirmDialog() {
  const c = data.value
  if (!c || !dialog.value) return
  busy.value = true
  try {
    if (dialog.value === 'delete') {
      await $fetch<{ ok: true }>(`/api/cohorts/${c.id}`, { method: 'DELETE' })
      invalidateCohorts()
      clearNuxtData([`cohort:${c.id}`, `cohort-roster:${c.id}`])
      toast.add({ title: t('cohorts.deleted'), icon: 'i-lucide-check', color: 'success' })
      dialog.value = undefined
      return navigateTo('/cohorts')
    }
    await $fetch(`/api/cohorts/${c.id}/finish`, { method: 'POST' })
    toast.add({ title: t(dialog.value === 'finish' ? 'cohorts.finished' : 'cohorts.cancelled', { name: c.name }), icon: 'i-lucide-check', color: 'success' })
    invalidateCohorts()
  } catch (e) {
    toastError(e)
    if (code(e) === 'cohort_not_found') return navigateTo('/cohorts')
  } finally {
    busy.value = false
    dialog.value = undefined
  }
  await refreshAll()
}

const actions = computed(() => {
  const c = data.value
  if (!c) return []
  if (c.status === 'active') {
    return [{ label: t('cohorts.finish'), icon: 'i-lucide-flag', color: 'error' as const, variant: 'outline' as const, onClick: () => { dialog.value = 'finish' } }]
  }
  if (c.status === 'planned') {
    return [
      { label: t('cohorts.cancel'), icon: 'i-lucide-ban', color: 'neutral' as const, variant: 'outline' as const, onClick: () => { dialog.value = 'cancel' } },
      // Only with no enrollments at all, dropped included (else cohort_not_deletable)
      ...(c.status === 'planned' && !roster.value.length && rosterStatus.value === 'success'
        ? [{ label: t('common.delete'), icon: 'i-lucide-trash-2', color: 'error' as const, variant: 'ghost' as const, onClick: () => { dialog.value = 'delete' } }]
        : [])
    ]
  }
  return []
})


/** A mutation found the cohort finished or changed (nightly job, another head): refetch, the page follows the API */
const onStale = () => refreshAll()
</script>

<template>
  <AppPage :title="t('nav.cohorts')" back="/cohorts">
    <UEmpty v-if="notFound" icon="i-lucide-users" :title="t('cohorts.notFound')" :actions="[{ label: t('cohorts.toList'), to: '/cohorts', color: 'neutral', variant: 'outline' }]" />
    <HomeState v-else :status="status" :has-data="!!data" @retry="refresh()">
      <div v-if="data" class="mx-auto w-full max-w-5xl space-y-8">
        <CohortFormModal v-if="!finished" v-model:open="editing" :cohort="data" @saved="refreshAll()" @stale="onStale" />
        <AddStudentsModal v-if="!finished" v-model:open="adding" :cohort-id="data.id" :roster="roster" :staff="data.staff" @added="refreshRoster()" @stale="onStale" />

        <header class="space-y-3">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="num text-xl font-semibold tracking-tight text-balance text-highlighted">{{ data.name }}</h1>
                <UBadge v-bind="statusBadge(data.status)" />
              </div>
              <p class="mt-1 text-sm text-muted">
                {{ data.programTitle }} · <span class="num">{{ range(data.startsOn, data.endsOn) }}</span> ·
                <span class="num" :class="data.status === 'active' ? 'text-highlighted' : ''">{{ data.status === 'finished' ? t('cohortStatus.finishedOn', { date: long(finishedDay(data)) }) : weekLine(data) }}</span>
              </p>
              <p v-if="data.status === 'planned'" class="mt-1 text-xs text-muted">{{ t('cohorts.plannedNote', { date: long(data.startsOn) }) }}</p>
            </div>
            <div v-if="!finished" class="flex flex-wrap items-center gap-2">
              <UButton :label="t('cohorts.edit')" icon="i-lucide-pencil" color="neutral" variant="outline" size="sm" @click="editing = true" />
              <UButton v-for="a in actions" :key="a.label" :label="a.label" :icon="a.icon" :color="a.color" :variant="a.variant" size="sm" @click="a.onClick" />
            </div>
          </div>
          <UAlert
            v-if="finished"
            color="neutral"
            variant="subtle"
            icon="i-lucide-archive"
            :description="t('cohorts.finishedBanner', { date: long(finishedDay(data)) })"
          />
        </header>

        <CohortStaff :cohort-id="data.id" :staff="data.staff" :roster="roster" :readonly="finished" @changed="refreshAll()" />

        <div v-if="rosterStatus === 'pending' && !roster.length" class="space-y-2" aria-busy="true">
          <USkeleton v-for="i in 5" :key="i" class="h-10 w-full" />
        </div>
        <div v-else-if="rosterStatus === 'error'" class="flex items-center gap-3 rounded-lg px-4 py-6 text-sm text-muted ring-1 ring-inset ring-default">
          {{ t('roster.loadError') }}
          <UButton :label="t('common.retry')" color="neutral" variant="outline" size="xs" @click="refreshRoster()" />
        </div>
        <CohortRoster
          v-else
          :cohort-id="data.id"
          :rows="roster"
          :mentors="mentors"
          :assignments-total="data.assignments.length"
          :manage="!finished"
          @changed="refreshRoster()"
          @stale="onStale"
          @add="adding = true"
        />

        <AssignmentsManager :assignments="data.assignments" :lessons="data.lessons" :editable="data.canEditAssignments && !finished" @changed="refresh()" />
      </div>
    </HomeState>

    <UModal v-model:open="dialogOpen" :title="dialog ? t(`cohorts.${dialog}Title`, { name: data?.name ?? '' }) : ''">
      <template #body>
        <i18n-t v-if="dialog" :keypath="`cohorts.${dialog}Confirm`" tag="p" scope="global" class="text-sm text-default">
          <template #name>{{ data?.name }}</template>
          <template #n><strong class="num font-semibold text-highlighted">{{ current.length }}</strong></template>
          <template #m><strong class="num font-semibold text-highlighted">{{ waitingTotal }}</strong></template>
        </i18n-t>
      </template>
      <template #footer>
        <UButton :label="dialog === 'finish' ? t('cohorts.keepRunning') : t('common.cancel')" color="neutral" variant="ghost" @click="dialogOpen = false" />
        <UButton
          :label="dialog === 'finish' ? t('cohorts.finish') : dialog === 'cancel' ? t('cohorts.cancel') : t('common.delete')"
          color="error"
          :loading="busy"
          @click="confirmDialog"
        />
      </template>
    </UModal>
  </AppPage>
</template>
