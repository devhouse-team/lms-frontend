<script setup lang="ts">
import type { ProgramSummary } from '~~/shared/types'

/** Read-only program block for students and mentors: cover, title, description clamped to 3 lines */
defineProps<{ program: ProgramSummary }>()
</script>

<template>
  <div class="flex gap-4">
    <ProgramCover :src="program.coverUrl" :title="program.title" class="aspect-video w-28 shrink-0 self-start rounded-md sm:w-36" />
    <div class="min-w-0 flex-1">
      <p class="text-sm font-medium text-highlighted">{{ program.title }}</p>
      <ClampText v-if="program.description" :text="program.description" :lines="3" class="mt-1 text-sm text-muted" />
    </div>
  </div>
</template>
