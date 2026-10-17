<script setup lang="ts">
import type { CourseGroup } from '~~/shared/types'

/** One cohort's courses as ruled rows: lessons done / released, next deadline, chevron. Planned: "Opens {date}". */
defineProps<{ group: CourseGroup, soon: (day: string) => boolean }>()
const { t } = useI18n()
const { short } = useCohortFormat()
const NuxtLink = resolveComponent('NuxtLink')
</script>

<template>
  <p v-if="!group.courses.length" class="text-sm text-muted">{{ t('courses.noCourses') }}</p>
  <ul v-else class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
    <li v-for="c in group.courses" :key="c.courseId">
      <component
        :is="group.cohort.status === 'planned' && c.doneLessons !== null ? 'div' : NuxtLink"
        :to="`/courses/${group.cohort.id}/${c.courseId}`"
        class="group flex items-center gap-3 px-4 py-3"
        :class="!(group.cohort.status === 'planned' && c.doneLessons !== null) && 'transition-colors duration-150 ease-out hover:bg-elevated'"
      >
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm text-highlighted">{{ c.title }}</span>
          <span v-if="c.nextDeadline" class="block truncate text-xs" :class="soon(c.nextDeadline.dueOn) ? 'text-primary' : 'text-muted'">
            {{ t('courses.nextDeadline', { title: c.nextDeadline.title }) }} · <span class="num">{{ short(c.nextDeadline.dueOn) }}</span>
          </span>
        </span>
        <span v-if="group.cohort.status === 'planned'" class="num shrink-0 text-xs text-muted">{{ t('courses.opens', { date: short(group.cohort.startsOn) }) }}</span>
        <span v-else class="num shrink-0 text-sm text-muted">
          {{ c.doneLessons !== null ? `${c.doneLessons} / ${c.releasedLessons}` : `${c.releasedLessons} / ${c.totalLessons}` }}
          <span class="sr-only">{{ t('courses.lessonsFigure') }}</span>
        </span>
        <UIcon v-if="!(group.cohort.status === 'planned' && c.doneLessons !== null)" name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed transition-transform duration-150 ease-out group-hover:translate-x-0.5" aria-hidden="true" />
      </component>
    </li>
  </ul>
</template>
