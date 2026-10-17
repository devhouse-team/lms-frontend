<script setup lang="ts">
import type { components } from '~~/shared/types/api'

/** Create a course (course.create): title, slug from the title, markdown description; lands on its editor */
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()
const { toastError } = useApiErrors('content')

const state = reactive({ title: '', slug: '', description: '' })
const slugTouched = ref(false)
const slugError = ref<string>()
const saving = ref(false)
watch(open, (o) => {
  if (!o) return
  Object.assign(state, { title: '', slug: '', description: '' })
  slugTouched.value = false
  slugError.value = undefined
})
watch(() => state.title, (v) => {
  if (!slugTouched.value) state.slug = slugify(v)
})
const titleOk = computed(() => state.title.trim().length >= 2 && state.title.length <= 200)
const slugOk = computed(() => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(state.slug) && state.slug.length <= 100)

async function create() {
  if (!titleOk.value || !slugOk.value) return
  saving.value = true
  slugError.value = undefined
  try {
    const c = await $fetch<components['schemas']['CourseRead']>('/api/editor/courses', {
      method: 'POST', body: { title: state.title.trim(), slug: state.slug, description: state.description, is_published: false }
    })
    toast.add({ title: t('editor.courseCreated'), icon: 'i-lucide-check', color: 'success' })
    open.value = false
    await navigateTo(`/editor/${c.id}`)
    clearNuxtData(['editor-courses', 'my-courses'])
  } catch (e) {
    if (apiError(e).code === 'course_slug_taken') slugError.value = t('content.err.course_slug_taken')
    else toastError(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t('editor.createCourse')" :ui="{ content: 'sm:max-w-xl' }">
    <template #body>
      <form id="course-create" class="space-y-4" @submit.prevent="create">
        <UFormField :label="t('editor.title')" :error="state.title && !titleOk ? t('editor.err.title') : undefined" required>
          <UInput v-model="state.title" autocomplete="off" class="w-full" />
        </UFormField>
        <UFormField :label="t('programs.form.slug')" :error="slugError ?? (state.slug && !slugOk ? t('programs.err.slug') : undefined)" :help="t('programs.form.slugHelp')" required>
          <UInput v-model="state.slug" spellcheck="false" class="w-full font-mono" @update:model-value="v => (slugTouched = v !== '')" />
        </UFormField>
        <UFormField :label="t('programs.form.description')">
          <MarkdownEditor v-model="state.description" mode="compact" :max-length="20000" />
        </UFormField>
      </form>
    </template>
    <template #footer>
      <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
      <UButton type="submit" form="course-create" :label="t('editor.create')" color="primary" :loading="saving" :disabled="!titleOk || !slugOk" />
    </template>
  </UModal>
</template>
