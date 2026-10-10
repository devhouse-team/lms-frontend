<script setup lang="ts">
import type { CourseStatus, ExternalCourse } from '~~/shared/types'

defineProps<{ courses: ExternalCourse[], removable?: boolean }>()
const emit = defineEmits<{ change: [id: string, status: CourseStatus], remove: [id: string] }>()
const { t } = useI18n()
</script>

<template>
  <ul v-if="courses.length" class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
    <li v-for="c in courses" :key="c.id" class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div class="min-w-0 flex-1 basis-48">
        <a
          :href="c.url"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-highlighted underline-offset-4 decoration-dimmed hover:underline"
        >
          <span class="truncate">{{ c.title }}</span>
          <UIcon name="i-lucide-arrow-up-right" class="size-3.5 shrink-0 text-muted" />
          <span class="sr-only">{{ t('common.open') }} {{ c.source }}</span>
        </a>
        <p class="num mt-0.5 text-xs text-muted">{{ c.source }}</p>
      </div>
      <CourseStatusControl :model-value="c.status" :title="c.title" @update:model-value="emit('change', c.id, $event)" />
      <UButton
        v-if="removable"
        icon="i-lucide-trash-2"
        color="neutral"
        variant="ghost"
        size="sm"
        :aria-label="t('courses.remove', { title: c.title })"
        @click="emit('remove', c.id)"
      />
    </li>
  </ul>
  <UEmpty v-else icon="i-lucide-link" :description="t('home.coursesEmpty')" variant="naked" />
</template>
