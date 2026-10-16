<script setup lang="ts">
import type { ProgramList, ProgramRow, ProgramStatus } from '~~/shared/types'

/** Programs by status tab, in API order; head reorders with up / down. Spec: programs.md, `/programs`. */
definePageMeta({ roles: ['head'] })
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { user } = useAuth()
useHead({ title: () => `${t('nav.programs')} · dev.house` })

const { data, status, refresh } = await useFetch<ProgramList>('/api/programs', { key: 'programs' })

const TABS: ProgramStatus[] = ['active', 'draft', 'archived']
const tab = computed<ProgramStatus>({
  get: () => (TABS.includes(route.query.status as ProgramStatus) ? route.query.status as ProgramStatus : 'active'),
  set: s => router.replace({ query: { ...route.query, status: s === 'active' ? undefined : s } })
})
const tabs = computed(() => TABS.map(s => ({ value: s, label: t(`programs.tab.${s}`), badge: { label: String(byStatus(s).length), color: 'neutral' as const, variant: 'soft' as const } })))
const byStatus = (s: ProgramStatus) => data.value?.programs.filter(p => p.status === s) ?? []
const shown = computed(() => byStatus(tab.value))

const creating = ref(false)
const reordering = ref(false)

/** Swap within the tab, put the tab's programs back into their own slots of the full order, send every id */
async function move(p: ProgramRow, dir: -1 | 1) {
  const list = data.value!.programs
  const inTab = shown.value
  const i = inTab.indexOf(p)
  const swapped = [...inTab]
  ;[swapped[i], swapped[i + dir]] = [swapped[i + dir]!, swapped[i]!]
  const slots = inTab.map(x => list.indexOf(x))
  const next = [...list]
  slots.forEach((slot, k) => (next[slot] = swapped[k]!))
  data.value!.programs = next
  reordering.value = true
  try {
    await $fetch('/api/programs/order', { method: 'PUT', body: { ids: next.map(x => x.id) } })
    clearNuxtData('program-options')
  } catch {
    toast.add({ title: t('programs.reorderError'), color: 'error', icon: 'i-lucide-circle-alert' })
    await refresh()
  } finally {
    reordering.value = false
  }
}

const months = (weeks: number) => Math.round(weeks / 4.345)
const facts = (p: ProgramRow) => [
  t('programs.weeks', p.durationWeeks),
  ...(months(p.durationWeeks) >= 1 ? [t('programs.months', months(p.durationWeeks))] : []),
  t('programs.courses', p.courseCount)
].join(' · ')
const cohortLine = (p: ProgramRow) => (['active', 'planned', 'finished'] as const)
  .filter(s => p.cohortCounts[s])
  .map(s => t(`programs.count.${s}`, { n: p.cohortCounts[s] }))
  .join(' · ')
const BADGE = { draft: { color: 'neutral', variant: 'outline' }, archived: { color: 'neutral', variant: 'subtle' } } as const
</script>

<template>
  <AppPage :title="t('nav.programs')">
    <HomeState :status="status" :has-data="!!data" @retry="refresh()">
      <div v-if="data" class="mx-auto w-full max-w-5xl space-y-6">
        <ProgramFormModal v-if="data.can.create" v-model:open="creating" can-manage />

        <header class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 class="text-xl font-semibold tracking-tight text-highlighted">{{ t('nav.programs') }}</h1>
            <p class="mt-1 text-sm text-muted">{{ t('programs.hint') }}</p>
          </div>
          <UButton v-if="data.can.create" :label="t('programs.create')" icon="i-lucide-plus" @click="creating = true" />
        </header>

        <UEmpty
          v-if="!data.programs.length"
          icon="i-lucide-library"
          :description="user?.headScope === 'programs' ? t('programs.emptyLead') : t('programs.empty')"
          :actions="data.can.create ? [{ label: t('programs.create'), icon: 'i-lucide-plus', onClick: () => { creating = true } }] : []"
        />
        <template v-else>
          <UTabs v-model="tab" :items="tabs" :content="false" variant="link" color="primary" />

          <p v-if="!shown.length" class="py-10 text-center text-sm text-muted">{{ t(`programs.emptyTab.${tab}`) }}</p>
          <ul v-else class="grid gap-4 md:grid-cols-2">
            <li v-for="(p, i) in shown" :key="p.id" class="flex flex-col overflow-hidden rounded-lg ring-1 ring-inset ring-default">
              <NuxtLink :to="`/programs/${p.id}`" tabindex="-1" aria-hidden="true">
                <ProgramCover :src="p.coverUrl" :title="p.title" class="aspect-video w-full" />
              </NuxtLink>
              <div class="flex flex-1 flex-col gap-3 p-4">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <NuxtLink :to="`/programs/${p.id}`" class="text-base font-semibold text-balance text-highlighted underline-offset-4 hover:underline">{{ p.title }}</NuxtLink>
                      <UBadge v-if="p.status !== 'active'" :label="t(`programs.status.${p.status}`)" v-bind="BADGE[p.status]" size="sm" />
                    </div>
                    <p class="mt-1 text-sm text-muted">{{ facts(p) }}</p>
                  </div>
                  <div v-if="data.can.reorder && shown.length > 1" class="flex shrink-0 gap-0.5">
                    <UButton icon="i-lucide-arrow-up" color="neutral" variant="ghost" size="xs" :aria-label="`${t('programs.moveUp')}: ${p.title}`" :disabled="i === 0 || reordering" @click="move(p, -1)" />
                    <UButton icon="i-lucide-arrow-down" color="neutral" variant="ghost" size="xs" :aria-label="`${t('programs.moveDown')}: ${p.title}`" :disabled="i === shown.length - 1 || reordering" @click="move(p, 1)" />
                  </div>
                </div>
                <dl class="mt-auto space-y-1.5 text-sm">
                  <div class="flex gap-2">
                    <dt class="sr-only">{{ t('programs.cohorts.title') }}</dt>
                    <UIcon name="i-lucide-users" class="mt-0.5 size-4 shrink-0 text-dimmed" aria-hidden="true" />
                    <dd :class="cohortLine(p) ? 'text-default' : 'text-muted'">
                      {{ cohortLine(p) || t('programs.noCohortsYet') }}<template v-if="p.activeStudents"> · {{ t('programs.studentsNow', p.activeStudents) }}</template>
                    </dd>
                  </div>
                  <div class="flex items-center gap-2">
                    <dt class="sr-only">{{ t('programs.fact.lead') }}</dt>
                    <dd v-if="p.lead" class="flex min-w-0 items-center gap-2">
                      <UAvatar :alt="p.lead.name" size="3xs" />
                      <span class="truncate text-default">{{ p.lead.name }}</span>
                    </dd>
                    <dd v-else class="flex items-center gap-2 text-muted">
                      <UIcon name="i-lucide-user-round" class="size-4 text-dimmed" aria-hidden="true" />{{ t('programs.noLead') }}
                    </dd>
                  </div>
                </dl>
              </div>
            </li>
          </ul>
        </template>
      </div>
    </HomeState>
  </AppPage>
</template>
