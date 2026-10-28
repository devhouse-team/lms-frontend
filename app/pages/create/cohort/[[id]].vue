<script setup lang="ts">
import { z } from 'zod'
import type { CalendarView, CohortDetail, CohortRosterRow, ProgramOption } from '~~/shared/types'

/**
 * Cohort wizard: program → dates → plan → team → students. The cohort is created after step 2 (the API copies the
 * program's curriculum) and every later step edits it through the same calls as the cohort page. The step is `?step=`;
 * `?program=` preselects the program. Spec: setup-flow.md, Cohort wizard.
 */
definePageMeta({ roles: ['head'] })
const route = useRoute()
const { t } = useI18n()
const toast = useToast()
const { message, toastError, code } = useCohortErrors()
const { short, long, range } = useCohortFormat()
useHead({ title: () => `${t('wizard.cohort.title')} · dev.house` })

const id = computed(() => (route.params.id ? String(route.params.id) : undefined))
const STEPS = ['program', 'dates', 'plan', 'team', 'students'] as const
const stepLabels = STEPS.map(s => t(`wizard.cohort.step.${s}`))
const base = computed(() => (id.value ? `/create/cohort/${id.value}` : '/create/cohort'))

const { data, status, error, refresh, execute } = useFetch<CohortDetail>(() => `/api/cohorts/${id.value}`, {
  key: 'cohort-wizard', immediate: false, watch: false, server: false
})
watch(id, v => v && execute(), { immediate: true })
const cohort = computed(() => (id.value && data.value?.id === id.value ? data.value : undefined))
const notFound = computed(() => !!id.value && error.value?.statusCode === 404)
const { data: roster, refresh: refreshRoster } = useLazyFetch<CohortRosterRow[]>(() => `/api/cohorts/${id.value}/roster`, {
  key: 'cohort-wizard-roster', immediate: false, watch: false, server: false, default: () => []
})
watch(id, v => v && refreshRoster(), { immediate: true })

// ---- step 1: program -----------------------------------------------------------------
const { data: options, status: optionsStatus } = useLazyFetch<ProgramOption[]>('/api/programs/options', {
  key: 'program-options', server: false, default: () => []
})
const programId = ref<string>()
const preset = route.query.program ? String(route.query.program) : undefined
watch(options, (list) => {
  if (!programId.value && preset && list.some(p => p.id === preset)) programId.value = preset
}, { immediate: true })
const chosen = computed(() => options.value.find(p => p.id === (cohort.value?.programId ?? programId.value)))

const step = computed(() => {
  const n = Math.trunc(Number(route.query.step)) || 1
  if (!id.value) return Math.min(Math.max(n, 1), programId.value ? 2 : 1)
  return Math.min(Math.max(n, 2), 6)
})
const done = computed(() => step.value === 6)
const go = (n: number) => navigateTo({ path: base.value, query: { step: n } })

// A finished cohort belongs to its page
watch(cohort, (c) => {
  if (c && c.status === 'finished' && !done.value) navigateTo(`/cohorts/${c.id}`, { replace: true })
})

// ---- step 2: dates -------------------------------------------------------------------
const today = () => new Date().toISOString().slice(0, 10)
const plusDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const nextMonday = () => {
  const d = new Date(`${today()}T00:00:00Z`)
  return plusDays(today(), ((8 - d.getUTCDay()) % 7) || 7)
}
const zones = Intl.supportedValuesOf('timeZone')
const state = reactive({ name: '', startsOn: nextMonday(), timezone: 'Asia/Almaty' })
const nameTouched = ref(false)
const form = useTemplateRef('form')
const saving = ref(false)
const schema = computed(() => z.object({
  name: z.string().trim().min(2, t('cohorts.err.name')).max(200, t('cohorts.err.name')),
  startsOn: z.string().min(1, t('cohorts.err.startsOn'))
}))
const endsOn = computed(() => (cohort.value ? cohort.value.endsOn : chosen.value && state.startsOn ? plusDays(state.startsOn, chosen.value.durationWeeks * 7) : ''))
const locked = computed(() => !!cohort.value && cohort.value.status !== 'planned')
const mondayHint = computed(() => (state.startsOn && new Date(`${state.startsOn}T00:00:00Z`).getUTCDay() === 1 ? t('wizard.cohort.dates.monday') : t('wizard.cohort.dates.notMonday')))

watch(cohort, (c) => {
  if (!c) return
  Object.assign(state, { name: c.name, startsOn: c.startsOn, timezone: c.timezone })
  nameTouched.value = true
}, { once: true })
// "‹program› · ‹start›" until the name is typed by hand
watch([chosen, () => state.startsOn], () => {
  if (!nameTouched.value && !cohort.value && chosen.value) state.name = t('wizard.cohort.dates.defaultName', { program: chosen.value.title, start: short(state.startsOn) })
}, { immediate: true })

const CODE_FIELD: Record<string, 'name' | 'startsOn'> = { cohort_name_taken: 'name', cohort_started: 'startsOn', cohort_ends_in_past: 'startsOn' }
function showError(e: unknown) {
  const c = code(e)
  if (c && CODE_FIELD[c]) form.value?.setErrors([{ name: CODE_FIELD[c], message: message(e) }])
  else toastError(e)
  if (c === 'cohort_finished' || c === 'program_not_active') refresh()
}

async function saveDates() {
  saving.value = true
  try {
    const c = cohort.value
    if (!c) {
      const created = await $fetch('/api/cohorts', {
        method: 'POST',
        body: { name: state.name.trim(), programId: chosen.value!.id, startsOn: state.startsOn, timezone: state.timezone, endsOn: endsOn.value }
      })
      invalidateCohorts()
      toast.add(created.coursesAttached
        ? { title: t('cohorts.createdCourses', created.coursesAttached), icon: 'i-lucide-check', color: 'success' }
        : { title: t('cohorts.createdNoCourses'), icon: 'i-lucide-triangle-alert', color: 'warning' })
      return await navigateTo({ path: `/create/cohort/${created.id}`, query: { step: 3 } })
    }
    const next = locked.value
      ? { name: state.name.trim() }
      : { name: state.name.trim(), startsOn: state.startsOn, timezone: state.timezone, ...(state.startsOn !== c.startsOn ? { endsOn: plusDays(state.startsOn, chosen.value!.durationWeeks * 7) } : {}) }
    const body = Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== c[k as keyof typeof c]))
    if (Object.keys(body).length) {
      await $fetch<{ ok: true }>(`/api/cohorts/${c.id}`, { method: 'PATCH', body })
      invalidateCohorts()
      await Promise.all([refresh(), refreshCalendar()])
    }
    await go(3)
  } catch (e) {
    showError(e)
  } finally {
    saving.value = false
  }
}

// ---- step 3: plan --------------------------------------------------------------------
const { data: calendar, status: calendarStatus, execute: loadCalendar } = useFetch<CalendarView>(() => `/api/calendar?cohort=${id.value}`, {
  key: 'cohort-wizard-calendar', immediate: false, watch: false, server: false
})
const refreshCalendar = () => (id.value && step.value === 3 ? loadCalendar() : Promise.resolve())
watch([step, id], ([s, i]) => {
  if (s === 3 && i) loadCalendar()
}, { immediate: true })
const weeks = computed(() => (calendar.value?.cohort?.id === id.value ? calendar.value!.weeks.filter(w => w.opens.length || w.due.length || w.exams.length) : []))
const planStats = computed(() => ({
  items: weeks.value.reduce((n, w) => n + w.opens.length + w.due.length + w.exams.length, 0),
  exams: weeks.value.reduce((n, w) => n + w.exams.length, 0)
}))
const exams = computed(() => cohort.value?.assignments.filter(a => a.mode === 'exam') ?? [])
const onExamChanged = () => Promise.all([refresh(), loadCalendar()])

// ---- step 4: team --------------------------------------------------------------------
const mentors = computed(() => cohort.value?.staff.filter(s => s.role === 'mentor') ?? [])
const onStaffChanged = () => Promise.all([refresh(), refreshRoster()])

// ---- step 5: students ----------------------------------------------------------------
const autoAssign = ref(true)
const assigned = ref<number>()
const finishing = ref(false)

async function finish() {
  finishing.value = true
  try {
    if (autoAssign.value && mentors.value.length && roster.value.length) {
      const res = await $fetch(`/api/cohorts/${id.value}/mentors/auto`, { method: 'POST' })
      assigned.value = res.assigned
    }
    invalidateCohorts()
    await go(6)
  } catch (e) {
    toastError(e)
  } finally {
    finishing.value = false
  }
}
</script>

<template>
  <AppPage :title="t('wizard.cohort.title')" back="/create">
    <UEmpty v-if="notFound" icon="i-lucide-users" :title="t('cohorts.notFound')" :actions="[{ label: t('cohorts.toList'), to: '/cohorts', color: 'neutral', variant: 'outline' }]" />
    <HomeState v-else :status="id ? status : optionsStatus" :has-data="id ? !!cohort : true" @retry="id ? refresh() : undefined">
      <WizardShell :title="t('wizard.cohort.title')" :steps="stepLabels" :current="step" :reach="id ? 5 : programId ? 2 : 1" :base="base">
        <!-- 1 · program -->
        <section v-if="step === 1" aria-labelledby="wiz-title" class="space-y-5">
          <header>
            <h1 id="wiz-title" class="text-lg font-semibold text-highlighted">{{ t('wizard.cohort.program.title') }}</h1>
            <p class="mt-1 text-sm text-muted">{{ t('wizard.cohort.program.lead') }}</p>
          </header>
          <div v-if="optionsStatus === 'pending' && !options.length" class="space-y-2" aria-busy="true">
            <USkeleton v-for="n in 3" :key="n" class="h-14 w-full rounded-lg" />
          </div>
          <div v-else-if="!options.length" class="rounded-lg px-4 py-8 text-center ring-1 ring-inset ring-default">
            <p class="mx-auto max-w-prose text-sm text-muted">{{ t('wizard.cohort.program.noActive') }}</p>
            <UButton :label="t('wizard.cohort.program.createProgram')" to="/create/program" icon="i-lucide-plus" class="mt-4" />
          </div>
          <URadioGroup v-else v-model="programId" :items="options.map(p => ({ value: p.id, label: p.title, description: t('wizard.cohort.program.meta', { weeks: p.durationWeeks }) }))" variant="card" />
          <footer class="flex items-center justify-between gap-3 border-t border-default pt-4">
            <UButton :label="t('wizard.cancel')" to="/create" color="neutral" variant="ghost" />
            <UButton :label="t('wizard.next')" trailing-icon="i-lucide-arrow-right" :disabled="!programId" @click="go(2)" />
          </footer>
        </section>

        <!-- 2 · dates -->
        <section v-else-if="step === 2 && chosen" aria-labelledby="wiz-title" class="space-y-5">
          <header>
            <h1 id="wiz-title" class="text-lg font-semibold text-highlighted">{{ t('wizard.cohort.dates.title') }}</h1>
            <p class="mt-1 text-sm text-muted">{{ chosen.title }} · {{ t('wizard.cohort.dates.lead') }}</p>
          </header>
          <UForm id="wizard-dates" ref="form" :schema="schema" :state="state" class="space-y-4" @submit="saveDates">
            <UFormField :label="t('cohorts.name')" name="name" required>
              <UInput v-model="state.name" autocomplete="off" class="w-full" @update:model-value="nameTouched = true" />
            </UFormField>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField :label="t('cohorts.startsOn')" name="startsOn" :help="locked ? t('cohorts.startLocked') : mondayHint" required>
                <UInput v-model="state.startsOn" type="date" :disabled="locked" class="w-full" />
              </UFormField>
              <UFormField :label="t('cohorts.endsOn')" :help="t('cohorts.endsOnHelp', chosen.durationWeeks)">
                <UInput :model-value="endsOn" type="date" disabled class="w-full" />
              </UFormField>
            </div>
            <UFormField :label="t('cohorts.timezone')" name="timezone" :help="locked ? t('cohorts.timezoneLocked') : t('cohorts.timezoneHelp')">
              <USelectMenu v-model="state.timezone" :items="zones" :disabled="locked" :search-input="{ placeholder: t('people.search') }" class="w-full" />
            </UFormField>
          </UForm>
          <p v-if="!cohort" class="text-sm text-muted">{{ t('wizard.cohort.dates.draftNote') }}</p>
          <footer class="flex items-center justify-between gap-3 border-t border-default pt-4">
            <UButton v-if="!cohort" :label="t('wizard.back')" icon="i-lucide-arrow-left" color="neutral" variant="ghost" @click="go(1)" />
            <UButton v-else :label="t('wizard.cancel')" :to="`/cohorts/${cohort.id}`" color="neutral" variant="ghost" />
            <UButton type="submit" form="wizard-dates" :label="t('wizard.next')" trailing-icon="i-lucide-arrow-right" :loading="saving" />
          </footer>
        </section>

        <!-- 3 · plan -->
        <section v-else-if="step === 3 && cohort" aria-labelledby="wiz-title" class="space-y-5">
          <header>
            <h1 id="wiz-title" class="text-lg font-semibold text-highlighted">{{ t('wizard.cohort.plan.title') }}</h1>
            <p class="mt-1 text-sm text-muted">{{ t('wizard.cohort.plan.lead') }}</p>
          </header>
          <UAlert color="neutral" variant="subtle" icon="i-lucide-info" :description="t('wizard.cohort.plan.snapshot')" />
          <dl class="num flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div><dt class="text-muted">{{ t('wizard.cohort.plan.stat.start') }}</dt><dd class="font-medium text-highlighted">{{ long(cohort.startsOn) }}</dd></div>
            <div><dt class="text-muted">{{ t('wizard.cohort.plan.stat.end') }}</dt><dd class="font-medium text-highlighted">{{ long(cohort.endsOn) }}</dd></div>
            <div><dt class="text-muted">{{ t('wizard.cohort.plan.stat.items') }}</dt><dd class="font-medium text-highlighted">{{ planStats.items }}</dd></div>
            <div><dt class="text-muted">{{ t('wizard.cohort.plan.stat.exams') }}</dt><dd class="font-medium text-highlighted">{{ planStats.exams }}</dd></div>
          </dl>
          <div v-if="calendarStatus === 'pending' && !calendar" class="space-y-2" aria-busy="true">
            <USkeleton v-for="n in 3" :key="n" class="h-16 w-full rounded-lg" />
          </div>
          <p v-else-if="!weeks.length" class="rounded-lg px-4 py-8 text-center text-sm text-muted ring-1 ring-inset ring-default">{{ t('wizard.cohort.plan.empty') }}</p>
          <ol v-else class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
            <li v-for="w in weeks" :key="w.n" class="px-4 py-3">
              <p class="num text-sm font-medium text-highlighted">{{ t('wizard.cohort.plan.week', { n: w.n }) }} <span class="font-normal text-muted">· {{ range(w.from, w.to) }}</span></p>
              <ul class="mt-2 space-y-1 text-sm">
                <li v-for="(e, i) in w.opens" :key="`o${i}`"><span class="text-muted">{{ t('wizard.cohort.plan.opens') }} {{ short(e.date) }}:</span> <span class="text-default">{{ e.courseTitle }} · {{ e.title }}</span></li>
                <li v-for="(e, i) in w.due" :key="`d${i}`"><span class="text-muted">{{ t('wizard.cohort.plan.due') }} {{ short(e.date) }}:</span> <span class="text-default">{{ e.title }}</span></li>
                <li v-for="(e, i) in w.exams" :key="`x${i}`"><span class="text-muted">{{ t('wizard.cohort.plan.exam') }} {{ short(e.date) }}:</span> <span class="text-default">{{ e.title }}</span></li>
              </ul>
            </li>
          </ol>
          <p class="text-xs text-muted">{{ t('wizard.cohort.plan.unpublished') }}</p>
          <CohortExamWindows v-if="exams.length" :cohort-id="cohort.id" :exams="exams" :timezone="cohort.timezone" manage @changed="onExamChanged" />
          <footer class="flex items-center justify-between gap-3 border-t border-default pt-4">
            <UButton :label="t('wizard.back')" icon="i-lucide-arrow-left" color="neutral" variant="ghost" @click="go(2)" />
            <UButton :label="t('wizard.next')" trailing-icon="i-lucide-arrow-right" @click="go(4)" />
          </footer>
        </section>

        <!-- 4 · team -->
        <section v-else-if="step === 4 && cohort" aria-labelledby="wiz-title" class="space-y-5">
          <header>
            <h1 id="wiz-title" class="text-lg font-semibold text-highlighted">{{ t('wizard.cohort.team.title') }}</h1>
            <p class="mt-1 text-sm text-muted">{{ t('wizard.cohort.team.lead') }}</p>
          </header>
          <CohortStaff :cohort-id="cohort.id" :staff="cohort.staff" :roster="roster" :readonly="false" @changed="onStaffChanged" />
          <footer class="flex items-center justify-between gap-3 border-t border-default pt-4">
            <UButton :label="t('wizard.back')" icon="i-lucide-arrow-left" color="neutral" variant="ghost" @click="go(3)" />
            <div class="flex items-center gap-3">
              <span v-if="!mentors.length" class="text-sm text-muted">{{ t('wizard.cohort.team.need') }}</span>
              <UButton :label="t('wizard.next')" trailing-icon="i-lucide-arrow-right" :disabled="!mentors.length" @click="go(5)" />
            </div>
          </footer>
        </section>

        <!-- 5 · students -->
        <section v-else-if="step === 5 && cohort" aria-labelledby="wiz-title" class="space-y-5">
          <header>
            <h1 id="wiz-title" class="text-lg font-semibold text-highlighted">{{ t('wizard.cohort.students.title') }}</h1>
            <p class="mt-1 text-sm text-muted">{{ t('wizard.cohort.students.lead') }}</p>
          </header>
          <AddStudentsPanel :cohort-id="cohort.id" :roster="roster" :staff="cohort.staff" inline @added="refreshRoster()" @stale="refresh()" />
          <UCheckbox v-model="autoAssign" :label="t('wizard.cohort.students.auto')" :description="t('wizard.cohort.students.autoHelp')" />
          <p class="text-xs text-muted">{{ t('wizard.cohort.students.skipHint') }}</p>
          <footer class="flex items-center justify-between gap-3 border-t border-default pt-4">
            <UButton :label="t('wizard.back')" icon="i-lucide-arrow-left" color="neutral" variant="ghost" @click="go(4)" />
            <UButton :label="t('wizard.cohort.students.finish')" icon="i-lucide-check" :loading="finishing" @click="finish" />
          </footer>
        </section>

        <!-- done -->
        <section v-else-if="done && cohort" aria-labelledby="wiz-title" class="space-y-4 rounded-lg px-6 py-10 text-center ring-1 ring-inset ring-default">
          <UIcon name="i-lucide-circle-check" class="mx-auto size-8 text-success" aria-hidden="true" />
          <h1 id="wiz-title" class="text-lg font-semibold text-highlighted">{{ t('wizard.cohort.done.title') }}</h1>
          <p class="text-sm text-muted">{{ t('wizard.cohort.done.text') }}</p>
          <p v-if="assigned" class="num text-sm text-muted">{{ t('wizard.cohort.done.assigned', { n: assigned }) }}</p>
          <div class="flex flex-wrap justify-center gap-2 pt-2">
            <UButton :label="t('wizard.cohort.done.open')" :to="`/cohorts/${cohort.id}`" />
            <UButton :label="t('wizard.cohort.done.another')" to="/create" color="neutral" variant="outline" />
          </div>
        </section>
      </WizardShell>
    </HomeState>
  </AppPage>
</template>
