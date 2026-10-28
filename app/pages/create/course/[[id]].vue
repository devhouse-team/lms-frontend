<script setup lang="ts">
import { z } from 'zod'
import type { components } from '~~/shared/types/api'
import type { ProgramDetail } from '~~/shared/types'
import type { CourseOutlineApi } from '~/composables/useCourseEditor'

/**
 * Course wizard: basics → structure → materials → assignments → review and publish. The course is created as a draft
 * after step 1; steps 2-4 are the course editor's outline, one part at a time, so every call goes through the editor
 * allowlist. `?return=/create/program/:id` adds the finished course to that program. The step is `?step=`.
 * Spec: setup-flow.md, Course wizard.
 */
// One instance per course, so the editor context below is provided with a fixed id
definePageMeta({ key: route => `create-course-${route.params.id ?? 'new'}` })
const route = useRoute()
const { t } = useI18n()
const toast = useToast()
const { toastError } = useApiErrors('content')
useHead({ title: () => `${t('wizard.course.title')} · dev.house` })

const id = route.params.id ? String(route.params.id) : undefined
const STEPS = ['basics', 'structure', 'materials', 'assignments', 'publish'] as const
const stepLabels = STEPS.map(s => t(`wizard.course.step.${s}`))
const base = id ? `/create/course/${id}` : '/create/course'
/** Only a program wizard page is a valid way back */
const returnTo = computed(() => {
  const r = String(route.query.return ?? '')
  return /^\/create\/program\/[\w-]+$/.test(r) ? r : undefined
})
const withReturn = (query: Record<string, unknown>) => ({ ...query, ...(returnTo.value ? { return: returnTo.value } : {}) })

const { data: outline, status, error, refresh } = await useFetch<CourseOutlineApi>(`/api/editor/courses/${id}`, {
  key: `editor-outline:${id}`, immediate: !!id, watch: false, server: false
})
// Provided here and used by steps 2-4 (EditorOutline); `call` is the editor's authoring call for the steps' own edits
const editorCall = id ? provideCourseEditor(id, outline, async () => { await refresh() }).call : undefined
const course = computed(() => (id && outline.value && String(outline.value.id) === id ? outline.value : undefined))
const denied = computed(() => !!id && [403, 404].includes(error.value?.statusCode ?? 0))

const step = computed(() => {
  const n = Math.trunc(Number(route.query.step)) || 1
  return id ? Math.min(Math.max(n, 1), 6) : 1
})
const done = computed(() => step.value === 6)
const go = (n: number) => navigateTo({ path: base, query: withReturn({ step: n }) })

const structureTab = ref<'manual' | 'import'>('manual')
const structureTabs = computed(() => [
  { value: 'manual', label: t('wizard.course.structure.manual') },
  { value: 'import', label: t('wizard.course.structure.import') }
])
const lessonCount = computed(() => course.value?.modules.reduce((n, m) => n + m.lessons.length, 0) ?? 0)

// ---- step 1: basics -----------------------------------------------------------------
const schema = computed(() => z.object({
  title: z.string().trim().min(2, t('editor.err.title')).max(200, t('editor.err.title')),
  slug: z.string().min(2, t('programs.err.slug')).max(100, t('programs.err.slug')).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, t('programs.err.slug')),
  description: z.string().max(20000)
}))
const state = reactive({ title: '', slug: '', description: '' })
const slugTouched = ref(false)
const form = useTemplateRef('form')
const saving = ref(false)

watch(course, (c) => {
  if (!c) return
  Object.assign(state, { title: c.title, slug: c.slug, description: c.description })
  slugTouched.value = true
}, { once: true, immediate: true })
// The slug follows the title until it is typed by hand
watch(() => state.title, (v) => {
  if (!slugTouched.value) state.slug = slugify(v)
})
const onSlug = (v: string | number) => { slugTouched.value = !!course.value || v !== '' }

const slugTaken = () => form.value?.setErrors([{ name: 'slug', message: t('content.err.course_slug_taken') }])

async function saveBasics() {
  const next = { title: state.title.trim(), slug: state.slug, description: state.description }
  saving.value = true
  try {
    const c = course.value
    if (!c) {
      const created = await $fetch<components['schemas']['CourseRead']>('/api/editor/courses', { method: 'POST', body: { ...next, is_published: false } })
      clearNuxtData(['editor-courses', 'my-courses'])
      return await navigateTo({ path: `/create/course/${created.id}`, query: withReturn({ step: 2 }) })
    }
    const body = Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== c[k as keyof typeof next]))
    if (Object.keys(body).length) {
      const res = await editorCall!('PATCH', `courses/${c.id}`, body, undefined, (e) => {
        if (apiError(e).code !== 'course_slug_taken') return false
        slugTaken()
        return true
      })
      if (!res) return
    }
    await go(2)
  } catch (e) {
    if (apiError(e).code === 'course_slug_taken') slugTaken()
    else toastError(e)
  } finally {
    saving.value = false
  }
}

// ---- step 5: review and publish -----------------------------------------------------
const issues = computed(() => (course.value ? reviewCourse(course.value) : []))
const blocked = computed(() => issues.value.some(i => i.severity === 'error'))
const stats = computed(() => {
  const lessons = course.value?.modules.flatMap(m => m.lessons) ?? []
  return {
    modules: course.value?.modules.length ?? 0,
    lessons: lessons.length,
    materials: lessons.reduce((n, l) => n + l.materials.length, 0),
    assignments: lessons.reduce((n, l) => n + l.assignments.length, 0)
  }
})
const sorted = <T extends { position: number }>(list: T[]) => [...list].sort((a, b) => a.position - b.position)
/** The first lesson that has something a student could open */
const sample = computed(() => {
  for (const m of sorted(course.value?.modules ?? [])) {
    for (const l of sorted(m.lessons)) {
      const materials = sorted(l.materials).filter(x => x.is_published)
      const assignments = sorted(l.assignments).filter(x => x.is_published)
      if (materials.length || assignments.length) return { module: m.title, lesson: l.title, materials, assignments }
    }
  }
  return undefined
})
const unpublishedCount = computed(() => {
  const lessons = course.value?.modules.flatMap(m => m.lessons) ?? []
  return lessons.filter(l => !l.is_published).length
    + lessons.reduce((n, l) => n + l.materials.filter(x => !x.is_published).length + l.assignments.filter(x => !x.is_published).length, 0)
})

const publish = ref(false)
watch(course, (c) => { if (c) publish.value = c.is_published }, { once: true, immediate: true })
const publishingAll = ref(false)

async function publishAll() {
  const lessons = course.value!.modules.flatMap(m => m.lessons)
  const calls: [string, number][] = [
    ...lessons.filter(l => !l.is_published).map(l => ['lessons', l.id] as [string, number]),
    ...lessons.flatMap(l => l.materials.filter(x => !x.is_published).map(x => ['materials', x.id] as [string, number])),
    ...lessons.flatMap(l => l.assignments.filter(x => !x.is_published).map(x => ['assignments', x.id] as [string, number]))
  ]
  publishingAll.value = true
  try {
    for (const [kind, itemId] of calls) await $fetch(`/api/editor/${kind}/${itemId}`, { method: 'PATCH', body: { is_published: true } })
    toast.add({ title: t('editor.published'), icon: 'i-lucide-check', color: 'success' })
  } catch (e) {
    toastError(e)
  } finally {
    invalidateContent(`editor-outline:${id}`)
    await refresh()
    publishingAll.value = false
  }
}

const finishing = ref(false)
async function finish() {
  const c = course.value!
  finishing.value = true
  try {
    if (publish.value !== c.is_published) {
      const res = await editorCall!('PATCH', `courses/${c.id}`, { is_published: publish.value })
      if (!res) return
    }
    clearNuxtData(['editor-courses', 'my-courses'])
    await go(6)
  } finally {
    finishing.value = false
  }
}

// ---- done: back to the program ------------------------------------------------------
const addingToProgram = ref(false)
async function backToProgram() {
  const to = returnTo.value!
  addingToProgram.value = true
  try {
    const pid = to.split('/').pop()
    const p = await $fetch<ProgramDetail>(`/api/programs/${pid}`)
    // After the last content, like the program wizard's course list
    const week = p.courses.length ? Math.min(103, p.weeksOfContent) : 0
    if (!p.courses.some(c => c.courseId === id)) await $fetch(`/api/programs/${pid}/courses/${id}`, { method: 'PUT', body: { startOffsetDays: week * 7 } })
    invalidatePrograms('program-wizard')
    toast.add({ title: t('wizard.course.done.added'), icon: 'i-lucide-check', color: 'success' })
    await navigateTo({ path: to, query: { step: 2 } })
  } catch (e) {
    toastError(e)
  } finally {
    addingToProgram.value = false
  }
}
</script>

<template>
  <AppPage :title="t('wizard.course.title')" :back="returnTo ?? '/create'">
    <UEmpty v-if="denied" icon="i-lucide-lock" :title="t('content.err.permission_denied_editor')" :actions="[{ label: t('course.toList'), to: '/courses', color: 'neutral', variant: 'outline' }]" />
    <HomeState v-else :status="id ? status : 'success'" :has-data="!id || !!course" @retry="refresh()">
      <WizardShell :title="t('wizard.course.title')" :steps="stepLabels" :current="step" :reach="id ? 5 : 1" :base="base">
        <!-- 1 · basics -->
        <section v-if="step === 1" aria-labelledby="wiz-title" class="space-y-5">
          <header>
            <h1 id="wiz-title" class="text-lg font-semibold text-highlighted">{{ t('wizard.course.basics.title') }}</h1>
            <p class="mt-1 text-sm text-muted">{{ t('wizard.course.basics.lead') }}</p>
          </header>
          <UForm id="wizard-basics" ref="form" :schema="schema" :state="state" class="space-y-4" @submit="saveBasics">
            <UFormField :label="t('editor.title')" name="title" required>
              <UInput v-model="state.title" autocomplete="off" class="w-full" autofocus />
            </UFormField>
            <UFormField :label="t('programs.form.slug')" name="slug" :help="t('programs.form.slugHelp')" required>
              <UInput v-model="state.slug" autocomplete="off" spellcheck="false" class="w-full font-mono" @update:model-value="onSlug" />
            </UFormField>
            <UFormField :label="t('programs.form.description')" name="description">
              <MarkdownEditor v-model="state.description" mode="compact" :max-length="20000" />
            </UFormField>
          </UForm>
          <p v-if="!course" class="text-sm text-muted">{{ t('wizard.course.basics.draftNote') }}</p>
          <footer class="flex items-center justify-between gap-3 border-t border-default pt-4">
            <UButton :label="t('wizard.cancel')" :to="returnTo ?? (course ? `/editor/${course.id}` : '/create')" color="neutral" variant="ghost" />
            <UButton type="submit" form="wizard-basics" :label="t('wizard.next')" trailing-icon="i-lucide-arrow-right" :loading="saving" />
          </footer>
        </section>

        <!-- 2 · structure -->
        <section v-else-if="step === 2 && course" aria-labelledby="wiz-title" class="space-y-5">
          <header>
            <h1 id="wiz-title" class="text-lg font-semibold text-highlighted">{{ t('wizard.course.structure.title') }}</h1>
            <p class="mt-1 text-sm text-muted">{{ t('wizard.course.structure.lead') }}</p>
          </header>
          <UTabs v-model="structureTab" :items="structureTabs" :content="false" variant="link" color="primary" />
          <EditorOutline v-if="structureTab === 'manual'" focus="structure" />
          <CoursePlanImport v-else @applied="structureTab = 'manual'" />
          <footer class="flex items-center justify-between gap-3 border-t border-default pt-4">
            <UButton :label="t('wizard.back')" icon="i-lucide-arrow-left" color="neutral" variant="ghost" @click="go(1)" />
            <div class="flex items-center gap-3">
              <span v-if="!lessonCount" class="text-sm text-muted">{{ t('wizard.course.structure.need') }}</span>
              <UButton :label="t('wizard.next')" trailing-icon="i-lucide-arrow-right" :disabled="!lessonCount" @click="go(3)" />
            </div>
          </footer>
        </section>

        <!-- 3 · materials -->
        <section v-else-if="step === 3 && course" aria-labelledby="wiz-title" class="space-y-5">
          <header>
            <h1 id="wiz-title" class="text-lg font-semibold text-highlighted">{{ t('wizard.course.materials.title') }}</h1>
            <p class="mt-1 text-sm text-muted">{{ t('wizard.course.materials.lead') }}</p>
          </header>
          <EditorOutline v-if="lessonCount" focus="materials" />
          <p v-else class="rounded-lg px-4 py-8 text-center text-sm text-muted ring-1 ring-inset ring-default">{{ t('wizard.course.materials.needLessons') }}</p>
          <footer class="flex items-center justify-between gap-3 border-t border-default pt-4">
            <UButton :label="t('wizard.back')" icon="i-lucide-arrow-left" color="neutral" variant="ghost" @click="go(2)" />
            <UButton :label="t('wizard.next')" trailing-icon="i-lucide-arrow-right" @click="go(4)" />
          </footer>
        </section>

        <!-- 4 · assignments -->
        <section v-else-if="step === 4 && course" aria-labelledby="wiz-title" class="space-y-5">
          <header>
            <h1 id="wiz-title" class="text-lg font-semibold text-highlighted">{{ t('wizard.course.assignments.title') }}</h1>
            <p class="mt-1 text-sm text-muted">{{ t('wizard.course.assignments.lead') }}</p>
          </header>
          <EditorOutline v-if="lessonCount" focus="assignments" stay />
          <p v-else class="rounded-lg px-4 py-8 text-center text-sm text-muted ring-1 ring-inset ring-default">{{ t('wizard.course.assignments.needLessons') }}</p>
          <footer class="flex items-center justify-between gap-3 border-t border-default pt-4">
            <UButton :label="t('wizard.back')" icon="i-lucide-arrow-left" color="neutral" variant="ghost" @click="go(3)" />
            <UButton :label="t('wizard.next')" trailing-icon="i-lucide-arrow-right" @click="go(5)" />
          </footer>
        </section>

        <!-- 5 · review and publish -->
        <section v-else-if="step === 5 && course" aria-labelledby="wiz-title" class="space-y-6">
          <header>
            <h1 id="wiz-title" class="text-lg font-semibold text-highlighted">{{ t('wizard.course.review.title') }}</h1>
            <p class="mt-1 text-sm text-muted">{{ t('wizard.course.review.lead') }}</p>
          </header>
          <dl class="num flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div v-for="k in (['modules', 'lessons', 'materials', 'assignments'] as const)" :key="k">
              <dt class="text-muted">{{ t(`wizard.course.review.stat.${k}`) }}</dt>
              <dd class="font-medium text-highlighted">{{ stats[k] }}</dd>
            </div>
          </dl>

          <section aria-labelledby="check-title" class="space-y-2">
            <h2 id="check-title" class="text-sm font-semibold text-highlighted">{{ t('wizard.course.review.checklist') }}</h2>
            <ul v-if="issues.length" class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
              <li v-for="i in issues" :key="i.key + JSON.stringify(i.params)" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <UBadge :label="t(`wizard.course.review.severity.${i.severity}`)" :color="i.severity === 'error' ? 'error' : i.severity === 'warn' ? 'warning' : 'neutral'" variant="subtle" size="sm" />
                <span class="min-w-0 flex-1 basis-56 text-sm text-default">{{ t(`wizard.course.review.issue.${i.key}`, i.params) }}</span>
                <UButton :label="t('wizard.course.review.fix')" color="neutral" variant="outline" size="xs" @click="go(i.step)" />
              </li>
            </ul>
            <UAlert v-else color="success" variant="subtle" icon="i-lucide-check" :description="t('wizard.course.review.allGood')" />
            <UButton
              v-if="unpublishedCount"
              :label="t('wizard.course.review.publishAll')"
              icon="i-lucide-eye"
              color="neutral"
              variant="outline"
              size="sm"
              :loading="publishingAll"
              @click="publishAll"
            />
          </section>

          <section aria-labelledby="preview-title" class="space-y-2">
            <h2 id="preview-title" class="text-sm font-semibold text-highlighted">{{ t('wizard.course.review.preview') }}</h2>
            <div v-if="sample" class="space-y-3 rounded-lg p-4 ring-1 ring-inset ring-default">
              <div>
                <p class="text-xs text-muted">{{ sample.module }}</p>
                <p class="text-base font-semibold text-highlighted">{{ sample.lesson }}</p>
              </div>
              <ul class="space-y-1.5 text-sm">
                <li v-for="m in sample.materials" :key="`m${m.id}`" class="flex items-center gap-2">
                  <UIcon :name="KIND_ICON[m.kind]" class="size-4 shrink-0 text-muted" aria-hidden="true" />
                  <span class="text-highlighted">{{ m.title }}</span>
                </li>
                <li v-for="a in sample.assignments" :key="`a${a.id}`" class="flex items-center gap-2">
                  <UBadge :label="t(`lesson.mode.${a.mode}`)" color="neutral" variant="subtle" size="sm" />
                  <span class="text-highlighted">{{ a.title }}</span>
                </li>
              </ul>
            </div>
            <p v-else class="text-sm text-muted">{{ t('wizard.course.review.previewEmpty') }}</p>
          </section>

          <section v-if="course.can_manage_editors" aria-labelledby="editors-title" class="space-y-2">
            <h2 id="editors-title" class="text-sm font-semibold text-highlighted">{{ t('wizard.course.review.editors') }}</h2>
            <EditorEditors />
          </section>

          <section aria-labelledby="status-title" class="space-y-2">
            <h2 id="status-title" class="text-sm font-semibold text-highlighted">{{ t('wizard.course.review.status') }}</h2>
            <USwitch v-model="publish" :label="t(publish ? 'wizard.course.review.publish' : 'wizard.course.review.draft')" :description="t(publish ? 'wizard.course.review.publishHelp' : 'wizard.course.review.draftHelp')" />
          </section>

          <footer class="flex items-center justify-between gap-3 border-t border-default pt-4">
            <UButton :label="t('wizard.back')" icon="i-lucide-arrow-left" color="neutral" variant="ghost" @click="go(4)" />
            <div class="flex items-center gap-3">
              <span v-if="blocked" class="text-sm text-muted">{{ t('wizard.course.structure.need') }}</span>
              <UButton :label="t(publish ? 'wizard.course.review.publishNow' : 'wizard.course.review.save')" icon="i-lucide-check" :disabled="blocked" :loading="finishing" @click="finish" />
            </div>
          </footer>
        </section>

        <!-- done -->
        <section v-else-if="done && course" aria-labelledby="wiz-title" class="space-y-4 rounded-lg px-6 py-10 text-center ring-1 ring-inset ring-default">
          <UIcon name="i-lucide-circle-check" class="mx-auto size-8 text-success" aria-hidden="true" />
          <h1 id="wiz-title" class="text-lg font-semibold text-highlighted">{{ t('wizard.course.done.title') }}</h1>
          <p class="text-sm text-muted">{{ course.title }}. {{ t(course.is_published ? 'wizard.course.done.published' : 'wizard.course.done.draft') }}</p>
          <div class="flex flex-wrap justify-center gap-2 pt-2">
            <UButton v-if="returnTo" :label="t('wizard.course.done.toProgram')" icon="i-lucide-corner-up-left" :loading="addingToProgram" @click="backToProgram" />
            <UButton v-else :label="t('wizard.course.done.program')" to="/create/program" />
            <UButton :label="t('wizard.course.done.open')" :to="`/editor/${course.id}`" color="neutral" variant="outline" />
            <UButton :label="t('wizard.course.done.another')" to="/create/course" color="neutral" variant="ghost" />
          </div>
        </section>
      </WizardShell>
    </HomeState>
  </AppPage>
</template>
