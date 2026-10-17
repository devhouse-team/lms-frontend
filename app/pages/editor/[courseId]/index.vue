<script setup lang="ts">
import type { CourseOutlineApi } from '~/composables/useCourseEditor'

/**
 * Course editor: Outline, Settings, Editors (only with `can_manage_editors`). Open to any signed-in view; the API
 * decides (403 permission_denied / 404 → "not an editor"). Spec: course-content.md, Course editor.
 */
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const courseId = String(route.params.courseId)
const { data: outline, status, error, refresh } = await useFetch<CourseOutlineApi>(`/api/editor/courses/${courseId}`, { key: `editor-outline:${courseId}` })
useHead({ title: () => `${outline.value?.title ?? t('nav.courses')} · ${t('editor.title_')} · dev.house` })
provideCourseEditor(courseId, outline, refresh)

const denied = computed(() => [403, 404].includes(error.value?.statusCode ?? 0))
const tabs = computed(() => [
  { value: 'outline', label: t('editor.tab.outline') },
  { value: 'settings', label: t('editor.tab.settings') },
  ...(outline.value?.can_manage_editors ? [{ value: 'editors', label: t('editor.tab.editors') }] : [])
])
const tab = computed({
  get: () => (tabs.value.some(x => x.value === route.query.tab) ? String(route.query.tab) : 'outline'),
  set: v => router.replace({ query: { ...route.query, tab: v === 'outline' ? undefined : v } })
})
</script>

<template>
  <AppPage :title="t('editor.title_')" back="/courses">
    <UEmpty v-if="denied" icon="i-lucide-lock" :title="t('content.err.permission_denied_editor')" :actions="[{ label: t('course.toList'), to: '/courses', color: 'neutral', variant: 'outline' }]" />
    <HomeState v-else :status="status" :has-data="!!outline" @retry="refresh()">
      <div v-if="outline" class="mx-auto w-full max-w-5xl space-y-6">
        <header class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-xl font-semibold tracking-tight text-balance text-highlighted">{{ outline.title }}</h1>
              <UBadge :label="outline.is_published ? t('editor.publishedShort') : t('editor.draft')" :color="outline.is_published ? 'success' : 'neutral'" variant="subtle" size="sm" />
            </div>
            <p class="mt-1 font-mono text-xs text-muted">{{ outline.slug }}</p>
          </div>
        </header>
        <UTabs v-model="tab" :items="tabs" :content="false" variant="link" color="primary" />
        <EditorOutline v-if="tab === 'outline'" />
        <EditorSettings v-else-if="tab === 'settings'" />
        <EditorEditors v-else />
      </div>
    </HomeState>
  </AppPage>
</template>
