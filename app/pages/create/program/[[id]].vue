<script setup lang="ts">
import { z } from 'zod'
import type { CourseOption, ProgramCourse, ProgramDetail, ProgramInput } from '~~/shared/types'

/**
 * Program wizard: basics → courses → schedule → activation. The program is created as a draft after step 1 and
 * every later step edits it through the same calls as the program page. The step is `?step=`.
 * Spec: setup-flow.md, Program wizard.
 */
definePageMeta({ roles: ['head'] })
const route = useRoute()
const { t } = useI18n()
const toast = useToast()
const { message, toastError, code } = useProgramErrors()
useHead({ title: () => `${t('wizard.program.title')} · dev.house` })

const id = computed(() => (route.params.id ? String(route.params.id) : undefined))
const STEPS = ['basics', 'courses', 'schedule', 'activation'] as const
const stepLabels = STEPS.map(s => t(`wizard.program.step.${s}`))
const base = computed(() => (id.value ? `/create/program/${id.value}` : '/create/program'))

const { data, status, error, refresh, execute } = useFetch<ProgramDetail>(() => `/api/programs/${id.value}`, {
  key: 'program-wizard', immediate: false, watch: false, server: false
})
watch(id, v => v && execute(), { immediate: true })
const program = computed(() => (id.value && data.value?.id === id.value ? data.value : undefined))
const notFound = computed(() => !!id.value && error.value?.statusCode === 404)

const step = computed(() => {
  const n = Math.trunc(Number(route.query.step)) || 1
  if (!id.value) return 1
  return Math.min(Math.max(n, 1), program.value?.status === 'active' ? 5 : 4)
})
const done = computed(() => step.value === 5)
const go = (n: number) => navigateTo({ path: base.value, query: { step: n } })

// Only drafts are wizard material: anything else belongs to the program page
watch(program, (p) => {
  if (p && p.status !== 'draft' && !done.value) navigateTo(`/programs/${p.id}`, { replace: true })
})

// ---- step 1: basics -----------------------------------------------------------------
const schema = computed(() => z.object({
  title: z.string().trim().min(2, t('programs.err.title')).max(200, t('programs.err.title')),
  slug: z.string().min(2, t('programs.err.slug')).max(100, t('programs.err.slug')).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, t('programs.err.slug')),
  description: z.string().max(5000, t('programs.err.description')),
  durationWeeks: z.number({ message: t('programs.err.duration') }).int(t('programs.err.duration')).min(1, t('programs.err.duration')).max(104, t('programs.err.duration'))
}))
const state = reactive<{ title: string, slug: string, description: string, durationWeeks?: number }>({ title: '', slug: '', description: '', durationWeeks: 26 })
const slugTouched = ref(false)
const form = useTemplateRef('form')
const saving = ref(false)
const months = (weeks: number) => Math.round(weeks / 4.345)

watch(program, (p) => {
  if (!p) return
  Object.assign(state, { title: p.title, slug: p.slug, description: p.description, durationWeeks: p.durationWeeks })
  slugTouched.value = true
}, { once: true })

// The slug follows the title until it is typed by hand; clearing it resumes following
watch(() => state.title, (title) => {
  if (!slugTouched.value) state.slug = slugify(title)
})
function onSlug(v: string | number) {
  slugTouched.value = !!program.value || v !== ''
  if (v === '' && !program.value) state.slug = slugify(state.title)
}

async function saveBasics() {
  const next: ProgramInput = { title: state.title.trim(), slug: state.slug, description: state.description, durationWeeks: state.durationWeeks! }
  saving.value = true
  try {
    const p = program.value
    if (!p) {
      const created = await $fetch('/api/programs', { method: 'POST', body: next })
      invalidatePrograms('program-wizard')
      return await navigateTo({ path: `/create/program/${created.id}`, query: { step: 2 } })
    }
    const body = Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== p[k as keyof typeof p]))
    if (Object.keys(body).length) {
      await $fetch(`/api/programs/${p.id}`, { method: 'PATCH', body })
      invalidatePrograms('program-wizard')
      await refresh()
    }
    await go(2)
  } catch (e) {
    if (code(e) === 'slug_taken') form.value?.setErrors([{ name: 'slug', message: message(e) }])
    else toastError(e)
  } finally {
    saving.value = false
  }
}

// ---- step 2: courses ----------------------------------------------------------------
const { data: options, status: optionsStatus, execute: loadOptions } = useLazyFetch<CourseOption[]>('/api/programs/course-options', {
  key: 'program-course-options', immediate: false, server: false, default: () => []
})
watch(step, (s) => {
  if (s === 2 && !options.value.length) loadOptions()
}, { immediate: true })
const search = ref('')
const shown = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? options.value.filter(c => c.title.toLowerCase().includes(q)) : options.value
})
const taken = computed(() => new Set(program.value?.courses.map(c => c.courseId)))
const busyCourse = ref<string>()

async function toggle(c: CourseOption, on: boolean) {
  const p = program.value!
  busyCourse.value = c.id
  try {
    if (on) {
      // After the last content, like the curriculum's "Add course"
      const week = p.courses.length ? Math.min(103, p.weeksOfContent) : 0
      await $fetch(`/api/programs/${p.id}/courses/${c.id}`, { method: 'PUT', body: { startOffsetDays: week * 7 } })
    } else {
      const url: string = `/api/programs/${p.id}/courses/${c.id}`
      await $fetch(url, { method: 'DELETE' })
    }
  } catch (e) {
    toastError(e)
    if (code(e) === 'course_not_found') loadOptions()
  } finally {
    invalidatePrograms('program-wizard')
    await refresh()
    busyCourse.value = undefined
  }
}

// ---- step 3: schedule ---------------------------------------------------------------
const lenOf = (c: ProgramCourse) => Math.max(1, c.modules)
const weekOf = (c: ProgramCourse) => Math.floor(c.startOffsetDays / 7) + 1
const timeline = computed(() => (program.value?.courses ?? []).map(c => ({ id: c.courseId, title: c.title, start: weekOf(c), len: lenOf(c) })))
const packing = ref(false)

/** One course after another, a week per module */
async function pack() {
  const p = program.value!
  packing.value = true
  try {
    let week = 1
    for (const c of p.courses) {
      const offset = (Math.min(week, 104) - 1) * 7
      if (offset !== c.startOffsetDays) await $fetch(`/api/programs/${p.id}/courses/${c.courseId}`, { method: 'PUT', body: { startOffsetDays: offset } })
      week += lenOf(c)
    }
    toast.add({ title: t('wizard.program.schedule.packed'), icon: 'i-lucide-check', color: 'success' })
  } catch (e) {
    toastError(e)
  } finally {
    invalidatePrograms('program-wizard')
    await refresh()
    packing.value = false
  }
}

// ---- step 4: activation -------------------------------------------------------------
const checks = computed(() => {
  const p = program.value
  if (!p) return []
  const list: { kind: 'warn', text: string }[] = []
  if (!p.courses.length) list.push({ kind: 'warn', text: t('wizard.program.activation.noCourses') })
  for (const c of p.courses) {
    if (!c.published) list.push({ kind: 'warn', text: t('wizard.program.activation.draftCourse', { course: c.title }) })
    if (!c.modules) list.push({ kind: 'warn', text: t('wizard.program.activation.noModules', { course: c.title }) })
  }
  if (p.courses.length && p.weeksOfContent > p.durationWeeks) list.push({ kind: 'warn', text: t('programs.curriculum.longer', { x: p.weeksOfContent, d: p.durationWeeks }) })
  return list
})
const activating = ref(false)
async function activate() {
  activating.value = true
  try {
    await $fetch(`/api/programs/${id.value}/activate`, { method: 'POST' })
    invalidatePrograms('program-wizard')
    await refresh()
    await go(5)
  } catch (e) {
    toastError(e)
  } finally {
    activating.value = false
  }
}
</script>

<template>
  <AppPage :title="t('wizard.program.title')" back="/create">
    <UEmpty v-if="notFound" icon="i-lucide-library" :title="t('programs.notFound')" :actions="[{ label: t('programs.toList'), to: '/programs', color: 'neutral', variant: 'outline' }]" />
    <HomeState v-else :status="status" :has-data="!id || !!program" @retry="refresh()">
      <WizardShell :title="t('wizard.program.title')" :steps="stepLabels" :current="step" :reach="id ? 4 : 1" :base="base">
        <!-- 1 · basics -->
        <section v-if="step === 1" aria-labelledby="wiz-title" class="space-y-5">
          <header>
            <h1 id="wiz-title" class="text-lg font-semibold text-highlighted">{{ t('wizard.program.basics.title') }}</h1>
            <p class="mt-1 text-sm text-muted">{{ t('wizard.program.basics.lead') }}</p>
          </header>
          <UForm id="wizard-basics" ref="form" :schema="schema" :state="state" class="space-y-4" @submit="saveBasics">
            <UFormField :label="t('programs.form.title')" name="title" required>
              <UInput v-model="state.title" autocomplete="off" class="w-full" autofocus />
            </UFormField>
            <UFormField :label="t('programs.form.slug')" name="slug" :help="t('programs.form.slugHelp')" required>
              <UInput v-model="state.slug" autocomplete="off" spellcheck="false" class="w-full font-mono" @update:model-value="onSlug" />
            </UFormField>
            <UFormField
              :label="t('programs.form.duration')"
              name="durationWeeks"
              :help="state.durationWeeks && months(state.durationWeeks) >= 1 ? t('programs.months', months(state.durationWeeks)) : undefined"
              required
            >
              <UInputNumber v-model="state.durationWeeks" :min="1" :max="104" :step="1" class="w-36" />
            </UFormField>
            <UFormField :label="t('programs.form.description')" name="description" :help="t('programs.form.descriptionHelp')">
              <MarkdownEditor v-model="state.description" mode="compact" :max-length="5000" />
            </UFormField>
          </UForm>
          <p v-if="!program" class="text-sm text-muted">{{ t('wizard.program.draftNote') }}</p>
          <footer class="flex items-center justify-between gap-3 border-t border-default pt-4">
            <UButton :label="t('wizard.cancel')" :to="program ? `/programs/${program.id}` : '/create'" color="neutral" variant="ghost" />
            <UButton type="submit" form="wizard-basics" :label="t('wizard.next')" trailing-icon="i-lucide-arrow-right" :loading="saving" />
          </footer>
        </section>

        <!-- 2 · courses -->
        <section v-else-if="step === 2 && program" aria-labelledby="wiz-title" class="space-y-5">
          <header>
            <h1 id="wiz-title" class="text-lg font-semibold text-highlighted">{{ t('wizard.program.courses.title') }}</h1>
            <p class="mt-1 text-sm text-muted">{{ t('wizard.program.courses.lead') }}</p>
          </header>
          <div v-if="optionsStatus === 'pending' && !options.length" class="space-y-2" aria-busy="true">
            <USkeleton v-for="n in 3" :key="n" class="h-12 w-full rounded-lg" />
          </div>
          <div v-else-if="!options.length" class="rounded-lg px-4 py-8 text-center ring-1 ring-inset ring-default">
            <p class="mx-auto max-w-prose text-sm text-muted">{{ t('wizard.program.courses.empty') }}</p>
            <UButton :label="t('wizard.program.courses.create')" to="/courses" icon="i-lucide-plus" class="mt-4" />
          </div>
          <template v-else>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <UInput v-model="search" icon="i-lucide-search" :placeholder="t('wizard.program.courses.search')" :aria-label="t('wizard.program.courses.search')" class="w-full sm:w-72" />
              <span class="num text-sm text-muted">{{ t('wizard.program.courses.selected', { n: program.courses.length }) }}</span>
            </div>
            <p v-if="!shown.length" class="py-6 text-center text-sm text-muted">{{ t('wizard.program.courses.noMatch') }}</p>
            <ul v-else class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
              <li v-for="c in shown" :key="c.id" class="px-4 py-3">
                <UCheckbox
                  :model-value="taken.has(c.id)"
                  :label="c.title"
                  :description="c.published ? undefined : t('programs.curriculum.unpublished')"
                  :disabled="!!busyCourse"
                  :loading="busyCourse === c.id"
                  @update:model-value="(v: boolean | 'indeterminate') => toggle(c, v === true)"
                />
              </li>
            </ul>
            <UButton :label="t('wizard.program.courses.create')" to="/courses" icon="i-lucide-plus" color="neutral" variant="link" size="sm" />
          </template>
          <footer class="flex items-center justify-between gap-3 border-t border-default pt-4">
            <UButton :label="t('wizard.back')" icon="i-lucide-arrow-left" color="neutral" variant="ghost" @click="go(1)" />
            <UButton :label="t('wizard.next')" trailing-icon="i-lucide-arrow-right" :disabled="!!busyCourse" @click="go(3)" />
          </footer>
        </section>

        <!-- 3 · schedule -->
        <section v-else-if="step === 3 && program" aria-labelledby="wiz-title" class="space-y-5">
          <header>
            <h1 id="wiz-title" class="text-lg font-semibold text-highlighted">{{ t('wizard.program.schedule.title') }}</h1>
            <p class="mt-1 text-sm text-muted">{{ t('wizard.program.schedule.lead') }}</p>
          </header>
          <p v-if="!program.courses.length" class="rounded-lg px-4 py-8 text-center text-sm text-muted ring-1 ring-inset ring-default">{{ t('wizard.program.schedule.empty') }}</p>
          <template v-else>
            <CurriculumTimeline :weeks="program.durationWeeks" :rows="timeline" />
            <UButton :label="t('wizard.program.schedule.pack')" icon="i-lucide-align-start-vertical" color="neutral" variant="outline" size="sm" :loading="packing" @click="pack" />
            <ProgramCurriculum
              :program-id="program.id"
              :courses="program.courses"
              :weeks-of-content="program.weeksOfContent"
              :duration-weeks="program.durationWeeks"
              :cohorts-total="0"
              editable
              @changed="refresh()"
            />
          </template>
          <footer class="flex items-center justify-between gap-3 border-t border-default pt-4">
            <UButton :label="t('wizard.back')" icon="i-lucide-arrow-left" color="neutral" variant="ghost" @click="go(2)" />
            <UButton :label="t('wizard.next')" trailing-icon="i-lucide-arrow-right" :disabled="packing" @click="go(4)" />
          </footer>
        </section>

        <!-- 4 · activation -->
        <section v-else-if="step === 4 && program" aria-labelledby="wiz-title" class="space-y-5">
          <header>
            <h1 id="wiz-title" class="text-lg font-semibold text-highlighted">{{ t('wizard.program.activation.title') }}</h1>
            <p class="mt-1 text-sm text-muted">{{ t('wizard.program.activation.lead') }}</p>
          </header>
          <ul v-if="checks.length" class="space-y-2">
            <li v-for="c in checks" :key="c.text">
              <UAlert color="warning" variant="subtle" icon="i-lucide-triangle-alert" :description="c.text" />
            </li>
          </ul>
          <UAlert v-else color="success" variant="subtle" icon="i-lucide-check" :description="t('wizard.program.activation.ok')" />
          <footer class="flex flex-wrap items-center justify-between gap-3 border-t border-default pt-4">
            <UButton :label="t('wizard.back')" icon="i-lucide-arrow-left" color="neutral" variant="ghost" @click="go(3)" />
            <div class="flex flex-wrap gap-2">
              <UButton :label="t('wizard.program.activation.keepDraft')" :to="`/programs/${program.id}`" color="neutral" variant="outline" />
              <UButton :label="t('wizard.program.activation.activate')" icon="i-lucide-rocket" :loading="activating" @click="activate" />
            </div>
          </footer>
        </section>

        <!-- done -->
        <section v-else-if="done && program" aria-labelledby="wiz-title" class="space-y-4 rounded-lg px-6 py-10 text-center ring-1 ring-inset ring-default">
          <UIcon name="i-lucide-circle-check" class="mx-auto size-8 text-success" aria-hidden="true" />
          <h1 id="wiz-title" class="text-lg font-semibold text-highlighted">{{ t('wizard.program.done.title') }}</h1>
          <p class="text-sm text-muted">{{ t('wizard.program.done.text') }}</p>
          <div class="flex flex-wrap justify-center gap-2 pt-2">
            <UButton :label="t('wizard.program.done.open')" :to="`/programs/${program.id}`" />
            <UButton :label="t('wizard.program.done.another')" to="/create" color="neutral" variant="outline" />
          </div>
        </section>
      </WizardShell>
    </HomeState>
  </AppPage>
</template>
