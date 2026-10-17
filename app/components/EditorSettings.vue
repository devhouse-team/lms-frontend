<script setup lang="ts">
/** Course settings: title, slug, markdown description, published. Sends only what changed. */
const { t } = useI18n()
const { outline, call } = useCourseEditor()
const o = computed(() => outline.value!)

const state = reactive({ title: '', slug: '', description: '', published: false })
const reset = () => Object.assign(state, { title: o.value.title, slug: o.value.slug, description: o.value.description, published: o.value.is_published })
watch(o, reset, { immediate: true })
const slugError = ref<string>()
const titleOk = computed(() => state.title.trim().length >= 2 && state.title.length <= 200)
const slugOk = computed(() => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(state.slug) && state.slug.length <= 100)
const saving = ref(false)

async function save() {
  slugError.value = undefined
  if (!titleOk.value || !slugOk.value) return
  const body = Object.fromEntries(Object.entries({
    title: state.title.trim(), slug: state.slug, description: state.description, is_published: state.published
  }).filter(([k, v]) => v !== { title: o.value.title, slug: o.value.slug, description: o.value.description, is_published: o.value.is_published }[k]))
  if (!Object.keys(body).length) return
  saving.value = true
  await call('PATCH', `courses/${o.value.id}`, body, t('editor.saved'), (e) => {
    if (apiError(e).code !== 'course_slug_taken') return false
    slugError.value = t('content.err.course_slug_taken')
    return true
  })
  saving.value = false
}
</script>

<template>
  <form class="max-w-2xl space-y-5" @submit.prevent="save">
    <UFormField :label="t('editor.title')" :error="titleOk ? undefined : t('editor.err.title')">
      <UInput v-model="state.title" class="w-full" />
    </UFormField>
    <UFormField :label="t('programs.form.slug')" :error="slugError ?? (slugOk ? undefined : t('programs.err.slug'))" :help="t('programs.form.slugHelp')">
      <UInput v-model="state.slug" spellcheck="false" class="w-full font-mono" />
    </UFormField>
    <UFormField :label="t('programs.form.description')">
      <MarkdownEditor v-model="state.description" mode="compact" :max-length="20000" />
    </UFormField>
    <USwitch v-model="state.published" :label="t('editor.coursePublished')" :description="t('editor.coursePublishedHelp')" />
    <div class="flex gap-2">
      <UButton type="submit" :label="t('common.save')" color="primary" :loading="saving" :disabled="!titleOk || !slugOk" />
      <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="reset" />
    </div>
  </form>
</template>
