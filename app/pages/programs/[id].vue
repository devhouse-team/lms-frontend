<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ProgramDetail } from '~~/shared/types'

/** One program: header with status actions, overview, curriculum, cohorts. Spec: programs.md, `/programs/[id]`. */
definePageMeta({ roles: ['head'] })
const route = useRoute()
const id = computed(() => String(route.params.id))
const { t, locale } = useI18n()
const toast = useToast()
const { toastError } = useProgramErrors()

const key = computed(() => `program:${id.value}`)
const { data, status, error, refresh } = await useFetch<ProgramDetail>(() => `/api/programs/${id.value}`, { key: key.value })
useHead({ title: () => `${data.value?.title ?? t('nav.programs')} · dev.house` })

const notFound = computed(() => error.value?.statusCode === 404)
const months = (weeks: number) => Math.round(weeks / 4.345)
const facts = computed(() => {
  const p = data.value!
  return [
    t('programs.weeks', p.durationWeeks),
    ...(months(p.durationWeeks) >= 1 ? [t('programs.months', months(p.durationWeeks))] : []),
    t('programs.courses', p.courseCount)
  ].join(' · ')
})
const cohortsTotal = computed(() => data.value ? data.value.cohortCounts.planned + data.value.cohortCounts.active + data.value.cohortCounts.finished : 0)
const running = computed(() => data.value ? data.value.cohortCounts.planned + data.value.cohortCounts.active : 0)
const BADGE = { draft: { color: 'neutral', variant: 'outline' }, active: { color: 'primary', variant: 'subtle' }, archived: { color: 'neutral', variant: 'subtle' } } as const

const updated = computed(() => {
  const at = data.value?.updatedAt
  if (!at) return undefined
  const days = Math.round((Date.parse(at) - Date.now()) / 86_400_000)
  return {
    relative: new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' }).format(days, 'day'),
    absolute: new Intl.DateTimeFormat(locale.value, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(at))
  }
})

const editing = ref(false)
const creatingCohort = ref(false)

// ---- status actions and delete (head only) --------------------------------------
type Kind = 'activate' | 'archive' | 'restore' | 'draft' | 'delete'
const dialog = ref<Kind>()
const dialogOpen = computed({ get: () => !!dialog.value, set: (v) => { if (!v) dialog.value = undefined } })
const busy = ref(false)
const open = (k: Kind) => () => { dialog.value = k }

const primary = computed(() => {
  const p = data.value
  if (!p?.can.manage) return p?.can.edit ? { label: t('programs.action.edit'), icon: 'i-lucide-pencil', onClick: () => { editing.value = true } } : undefined
  if (p.status === 'draft') return { label: t('programs.action.activate'), icon: 'i-lucide-rocket', onClick: open('activate') }
  if (p.status === 'archived') return { label: t('programs.action.restore'), icon: 'i-lucide-archive-restore', onClick: open('restore') }
  return { label: t('programs.action.edit'), icon: 'i-lucide-pencil', onClick: () => { editing.value = true } }
})
const menu = computed<DropdownMenuItem[]>(() => {
  const p = data.value
  if (!p?.can.manage) return []
  const edit = { label: t('programs.action.edit'), icon: 'i-lucide-pencil', onSelect: () => { editing.value = true } }
  const archive = { label: t('programs.action.archive'), icon: 'i-lucide-archive', onSelect: open('archive') }
  if (p.status === 'draft') {
    return [edit, archive, ...(cohortsTotal.value ? [] : [{ label: t('programs.action.delete'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: open('delete') }])]
  }
  if (p.status === 'active') return [archive, ...(cohortsTotal.value ? [] : [{ label: t('programs.action.draft'), icon: 'i-lucide-file-pen', onSelect: open('draft') }])]
  return [edit]
})

const confirmText = computed(() => {
  const p = data.value
  if (!p || !dialog.value) return ''
  if (dialog.value === 'archive' && running.value) return t('programs.confirm.archiveRunning', { title: p.title, n: running.value })
  return t(`programs.confirm.${dialog.value}`, { title: p.title })
})
const confirmColor = computed(() => (dialog.value === 'delete' ? 'error' : dialog.value === 'archive' || dialog.value === 'draft' ? 'neutral' : 'primary'))

async function confirmDialog() {
  const p = data.value
  const kind = dialog.value
  if (!p || !kind) return
  busy.value = true
  try {
    if (kind === 'delete') {
      await $fetch(`/api/programs/${p.id}`, { method: 'DELETE' })
      dialog.value = undefined
      toast.add({ title: t('programs.done.delete'), icon: 'i-lucide-check', color: 'success' })
      await navigateTo('/programs')
      return invalidatePrograms('programs')
    }
    await $fetch(`/api/programs/${p.id}/${kind === 'restore' ? 'activate' : kind}`, { method: 'POST' })
    toast.add({ title: t(`programs.done.${kind}`), icon: 'i-lucide-check', color: 'success' })
  } catch (e) {
    toastError(e)
  } finally {
    busy.value = false
    dialog.value = undefined
  }
  invalidatePrograms(key.value)
  await refresh()
}

const onSaved = () => refresh()
</script>

<template>
  <AppPage :title="t('nav.programs')" back="/programs">
    <UEmpty v-if="notFound" icon="i-lucide-library" :title="t('programs.notFound')" :actions="[{ label: t('programs.toList'), to: '/programs', color: 'neutral', variant: 'outline' }]" />
    <HomeState v-else :status="status" :has-data="!!data" @retry="refresh()">
      <div v-if="data" class="mx-auto w-full max-w-5xl space-y-10">
        <ProgramFormModal v-if="data.can.edit" v-model:open="editing" :program="data" :can-manage="data.can.manage" @saved="onSaved" />
        <CohortFormModal
          v-if="data.can.edit"
          v-model:open="creatingCohort"
          :program="{ id: data.id, title: data.title, durationWeeks: data.durationWeeks }"
          @saved="cid => navigateTo(`/cohorts/${cid}`)"
          @stale="refresh()"
        />

        <header class="space-y-4">
          <ProgramCover :src="data.coverUrl" :title="data.title" class="aspect-video max-h-56 w-full rounded-lg" />
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-xl font-semibold tracking-tight text-balance text-highlighted">{{ data.title }}</h1>
                <UBadge :label="t(`programs.status.${data.status}`)" v-bind="BADGE[data.status]" size="sm" />
              </div>
              <p class="mt-1 text-sm text-muted">{{ facts }} · {{ data.lead?.name ?? t('programs.noLead') }}</p>
            </div>
            <div class="flex items-center gap-2">
              <UButton v-if="primary" :label="primary.label" :icon="primary.icon" size="sm" :color="data.can.manage && data.status !== 'active' ? 'primary' : 'neutral'" :variant="data.can.manage && data.status !== 'active' ? 'solid' : 'outline'" @click="primary.onClick" />
              <UDropdownMenu v-if="menu.length" :items="menu" :content="{ align: 'end' }">
                <UButton icon="i-lucide-ellipsis" color="neutral" variant="outline" size="sm" :aria-label="t('programs.action.more')" />
              </UDropdownMenu>
            </div>
          </div>
          <UAlert v-if="data.status !== 'active'" color="neutral" variant="subtle" :icon="data.status === 'draft' ? 'i-lucide-file-pen' : 'i-lucide-archive'" :description="t(`programs.note.${data.status}`)" />
        </header>

        <section class="space-y-4" aria-labelledby="overview-title">
          <h2 id="overview-title" class="text-base font-semibold text-highlighted">{{ t('programs.overview') }}</h2>
          <div class="grid gap-8 md:grid-cols-[minmax(0,1fr)_18rem]">
            <ClampText v-if="data.description" :text="data.description" :lines="6" class="text-sm text-default" />
            <div v-else class="text-sm text-muted">
              {{ t('programs.noDescription') }}
              <UButton v-if="data.can.edit" :label="t('programs.addDescription')" color="neutral" variant="link" size="sm" class="ms-1" @click="editing = true" />
            </div>
            <dl class="space-y-2 text-sm">
              <div class="flex justify-between gap-3">
                <dt class="text-muted">{{ t('programs.fact.slug') }}</dt>
                <dd class="truncate font-mono text-highlighted">{{ data.slug }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">{{ t('programs.fact.duration') }}</dt>
                <dd class="text-end text-highlighted">{{ months(data.durationWeeks) >= 1 ? t('programs.durationValue', { weeks: t('programs.weeks', data.durationWeeks), months: t('programs.months', months(data.durationWeeks)) }) : t('programs.weeks', data.durationWeeks) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">{{ t('programs.fact.lead') }}</dt>
                <dd class="truncate" :class="data.lead ? 'text-highlighted' : 'text-muted'">{{ data.lead?.name ?? t('programs.noLead') }}</dd>
              </div>
              <div v-if="updated" class="flex justify-between gap-3">
                <dt class="text-muted">{{ t('programs.fact.updated') }}</dt>
                <dd class="text-highlighted">
                  <UTooltip :text="updated.absolute"><span tabindex="0">{{ updated.relative }}</span></UTooltip>
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <ProgramCurriculum
          :program-id="data.id"
          :courses="data.courses"
          :weeks-of-content="data.weeksOfContent"
          :duration-weeks="data.durationWeeks"
          :cohorts-total="cohortsTotal"
          :editable="data.can.edit"
          @changed="refresh()"
        />

        <section class="space-y-4" aria-labelledby="cohorts-title">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 id="cohorts-title" class="text-base font-semibold text-highlighted">
              {{ t('programs.cohorts.title') }} <span class="num font-normal text-muted">{{ data.cohorts.length }}</span>
            </h2>
            <UButton v-if="data.can.createCohort" :label="t('programs.cohorts.create')" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" @click="creatingCohort = true" />
          </div>
          <p v-if="data.status !== 'active'" class="text-sm text-muted">{{ t(data.status === 'draft' ? 'programs.cohorts.noteDraft' : 'programs.cohorts.noteArchived') }}</p>
          <ProgramCohorts v-if="data.cohorts.length" :cohorts="data.cohorts" />
          <p v-else-if="data.status === 'active'" class="text-sm text-muted">{{ t('programs.cohorts.empty') }}</p>
        </section>
      </div>
    </HomeState>

    <UModal v-model:open="dialogOpen" :title="dialog ? t(`programs.confirm.${dialog}Title`) : ''">
      <template #body>
        <p class="text-sm text-default">{{ confirmText }}</p>
        <UAlert
          v-if="dialog === 'activate' && !data?.courses.length"
          class="mt-3"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :description="t('programs.confirm.emptyCurriculum')"
        />
      </template>
      <template #footer>
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="dialogOpen = false" />
        <UButton v-if="dialog" :label="t(`programs.action.${dialog}`)" :color="confirmColor" :loading="busy" @click="confirmDialog" />
      </template>
    </UModal>
  </AppPage>
</template>
