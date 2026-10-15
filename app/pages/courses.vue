<script setup lang="ts">
import { z } from 'zod'
import type { CourseStatus, ExternalCourse } from '~~/shared/types'

definePageMeta({ roles: ['mentee'] })

const { t } = useI18n()
const toast = useToast()
useHead({ title: () => `${t('nav.courses')} · dev.house` })

const { data, status, refresh } = await useFetch('/api/courses', { key: 'courses' })
const done = computed(() => data.value?.filter(c => c.status === 'done').length ?? 0)

async function onChange(id: string, next: CourseStatus) {
  const c = data.value?.find(x => x.id === id)
  if (!c) return
  const prev = c.status
  c.status = next
  try {
    await $fetch(`/api/courses/${id}/status`, { method: 'PATCH', body: { status: next } })
    clearNuxtData('dashboard-mentee')
  } catch {
    c.status = prev
    toast.add({ title: t('home.statusError'), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}

// Remove immediately; Undo re-creates it (no confirm dialog)
async function onRemove(id: string) {
  const idx = data.value?.findIndex(x => x.id === id) ?? -1
  if (!data.value || idx === -1) return
  const [removed] = data.value.splice(idx, 1)
  try {
    await $fetch(`/api/courses/${id}`, { method: 'DELETE' })
    clearNuxtData('dashboard-mentee')
  } catch {
    data.value.splice(idx, 0, removed!)
    toast.add({ title: t('common.saveError'), color: 'error', icon: 'i-lucide-circle-alert' })
    return
  }
  toast.add({
    title: t('courses.removed', { title: removed!.title }),
    icon: 'i-lucide-trash-2',
    color: 'neutral',
    actions: [{ label: t('courses.undo'), color: 'neutral', variant: 'outline', onClick: () => restore(removed!, idx) }]
  })
}

async function restore(c: ExternalCourse, idx: number) {
  try {
    const created = await $fetch('/api/courses', { method: 'POST', body: { title: c.title, url: c.url } })
    if (c.status !== 'todo') {
      await $fetch(`/api/courses/${created.id}/status`, { method: 'PATCH', body: { status: c.status } })
      created.status = c.status
    }
    data.value?.splice(Math.min(idx, data.value.length), 0, created)
    clearNuxtData('dashboard-mentee')
  } catch {
    toast.add({ title: t('common.saveError'), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}

const schema = computed(() => z.object({
  title: z.string().trim().min(2, t('courses.err.title')).max(120, t('courses.err.title')),
  url: z.string().trim().min(1, t('submission.err.urlRequired')).url(t('submission.err.url')).refine(u => /^https?:\/\//i.test(u), t('submission.err.url'))
}))
const state = reactive({ title: '', url: '' })
const adding = ref(false)

async function onAdd() {
  adding.value = true
  try {
    const c = await $fetch('/api/courses', { method: 'POST', body: { title: state.title.trim(), url: state.url.trim() } })
    data.value?.push(c)
    state.title = ''
    state.url = ''
    clearNuxtData('dashboard-mentee')
  } catch {
    toast.add({ title: t('common.saveError'), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    adding.value = false
  }
}
</script>

<template>
  <AppPage mock :title="t('nav.courses')">
    <HomeState :status="status" :has-data="!!data" @retry="refresh()">
      <div v-if="data" class="mx-auto w-full max-w-4xl space-y-8">
        <header>
          <h1 class="text-xl font-semibold tracking-tight text-highlighted">{{ t('home.courses') }}</h1>
          <p class="mt-1 max-w-prose text-sm text-muted">{{ t('home.coursesHint') }}</p>
          <p class="num mt-2 text-xs text-muted">{{ t('home.coursesDone', { done, total: data.length }) }}</p>
        </header>

        <CoursesList :courses="data" removable @change="onChange" @remove="onRemove" />

        <section aria-labelledby="add-title" class="rounded-lg p-5 ring-1 ring-inset ring-default">
          <h2 id="add-title" class="text-sm font-semibold text-highlighted">{{ t('courses.add') }}</h2>
          <p class="mt-1 text-sm text-muted">{{ t('courses.addHint') }}</p>
          <UForm :schema="schema" :state="state" class="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start" @submit="onAdd">
            <UFormField :label="t('courses.title')" name="title">
              <UInput v-model="state.title" class="w-full" />
            </UFormField>
            <UFormField :label="t('courses.link')" name="url">
              <UInput v-model="state.url" type="url" inputmode="url" placeholder="https://…" class="w-full" />
            </UFormField>
            <UButton type="submit" :label="t('courses.addButton')" icon="i-lucide-plus" color="neutral" variant="outline" :loading="adding" class="sm:mt-6" />
          </UForm>
        </section>
      </div>
    </HomeState>
  </AppPage>
</template>
