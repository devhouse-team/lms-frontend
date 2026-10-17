<script setup lang="ts">
/** Old links `/assignments/{cohortId}-{lessonId}` (notifications, bookmarks) go to the lesson's first assignment */
definePageMeta({ roles: ['mentee'] })
const route = useRoute()
const { t } = useI18n()
const { data, error } = await useFetch<{ to: string }>(`/api/assignments/resolve/${String(route.params.id)}`)
if (data.value) await navigateTo(data.value.to, { replace: true })
</script>

<template>
  <AppPage :title="t('nav.assignments')" back="/assignments">
    <UEmpty
      v-if="error"
      icon="i-lucide-file-question"
      :title="t('assignment.notFound')"
      :actions="[{ label: t('assignment.toList'), to: '/assignments', color: 'neutral', variant: 'outline' }]"
    />
  </AppPage>
</template>
