<script setup lang="ts">
/**
 * The program's schedule: one row per course with its start week (editable), order, and a bar on the week grid for the
 * weeks its modules open. A bar past the program's last week is flagged. Spec: setup-flow.md, Program wizard › Schedule.
 */
interface Row { id: string, title: string, start: number, len: number, published: boolean, modules: number }
const props = defineProps<{ weeks: number, rows: Row[], busy?: boolean }>()
const emit = defineEmits<{ start: [id: string, week: number], move: [id: string, dir: -1 | 1] }>()
const { t } = useI18n()
const pct = (n: number) => `${(n / props.weeks) * 100}%`
const end = (r: Row) => r.start + r.len - 1
const labelEvery = computed(() => (props.weeks <= 12 ? 1 : props.weeks <= 52 ? 4 : 8))

// Typing or stepping a week saves once it settles
const timers = new Map<string, ReturnType<typeof setTimeout>>()
function onWeek(r: Row, v: number | null | undefined) {
  clearTimeout(timers.get(r.id))
  if (v == null || !Number.isInteger(v) || v < 1 || v > 104 || v === r.start) return
  timers.set(r.id, setTimeout(() => emit('start', r.id, v), 600))
}
onBeforeUnmount(() => timers.forEach(clearTimeout))
</script>

<template>
  <div class="overflow-x-auto rounded-lg ring-1 ring-inset ring-default">
    <div :style="{ minWidth: `${Math.max(640, 340 + weeks * 14)}px` }">
      <div class="flex border-b border-default text-xs text-muted">
        <div class="w-56 shrink-0 px-3 py-1.5">{{ t('wizard.program.schedule.course') }}</div>
        <div class="w-36 shrink-0 px-3 py-1.5">{{ t('wizard.program.schedule.startsIn') }}</div>
        <div class="grid flex-1" :style="{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }" aria-hidden="true">
          <span v-for="w in weeks" :key="w" class="num py-1.5 text-center">{{ (w - 1) % labelEvery === 0 ? w : '' }}</span>
        </div>
      </div>
      <ol>
        <li v-for="(r, i) in rows" :key="r.id" class="flex items-center border-b border-default last:border-b-0">
          <div class="flex w-56 shrink-0 items-center gap-1 px-2 py-2">
            <span class="flex flex-col">
              <UButton icon="i-lucide-chevron-up" color="neutral" variant="ghost" size="xs" class="h-4 p-0" :aria-label="`${t('programs.moveUp')}: ${r.title}`" :disabled="i === 0 || busy" @click="emit('move', r.id, -1)" />
              <UButton icon="i-lucide-chevron-down" color="neutral" variant="ghost" size="xs" class="h-4 p-0" :aria-label="`${t('programs.moveDown')}: ${r.title}`" :disabled="i === rows.length - 1 || busy" @click="emit('move', r.id, 1)" />
            </span>
            <div class="min-w-0">
              <p class="truncate text-sm text-default" :title="r.title">{{ r.title }}</p>
              <p v-if="!r.published" class="text-xs text-warning">{{ t('programs.curriculum.unpublished') }}</p>
              <p v-else-if="!r.modules" class="text-xs text-warning">{{ t('programs.curriculum.noModules') }}</p>
            </div>
          </div>
          <div class="w-36 shrink-0 px-3">
            <UInputNumber :model-value="r.start" :min="1" :max="104" size="sm" class="w-28" :disabled="busy" :aria-label="`${t('wizard.program.schedule.startsIn')}: ${r.title}`" @update:model-value="v => onWeek(r, v)" />
          </div>
          <div class="relative h-9 flex-1">
            <span
              class="num absolute top-1.5 bottom-1.5 flex items-center justify-center overflow-hidden rounded text-xs"
              :class="end(r) > weeks ? 'bg-warning/20 text-warning ring-1 ring-warning' : 'bg-primary/15 text-primary ring-1 ring-primary/40'"
              :style="{ left: pct(Math.min(r.start - 1, weeks - 1)), width: pct(Math.max(0.6, Math.min(r.len, weeks - r.start + 1))) }"
            >
              {{ r.start }}–{{ end(r) }}
            </span>
          </div>
        </li>
      </ol>
    </div>
  </div>
</template>
