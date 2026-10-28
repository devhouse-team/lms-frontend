<script setup lang="ts">
/** Course bars on a week grid; a bar past the program's last week is flagged. Spec: setup-flow.md, Schedule. */
const props = defineProps<{ weeks: number, rows: { id: string, title: string, start: number, len: number }[] }>()
const { t } = useI18n()
const pct = (n: number) => `${(n / props.weeks) * 100}%`
const end = (r: { start: number, len: number }) => r.start + r.len - 1
const labelEvery = computed(() => (props.weeks <= 12 ? 1 : props.weeks <= 52 ? 4 : 8))
</script>

<template>
  <div class="overflow-x-auto rounded-lg ring-1 ring-inset ring-default">
    <div :style="{ minWidth: `${Math.max(480, 160 + weeks * 14)}px` }">
      <div class="flex border-b border-default text-xs text-muted">
        <div class="w-40 shrink-0 px-3 py-1.5">{{ t('wizard.program.schedule.week') }}</div>
        <div class="grid flex-1" :style="{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }" aria-hidden="true">
          <span v-for="w in weeks" :key="w" class="num py-1.5 text-center">{{ (w - 1) % labelEvery === 0 ? w : '' }}</span>
        </div>
      </div>
      <ul>
        <li v-for="r in rows" :key="r.id" class="flex items-center border-b border-default last:border-b-0">
          <span class="w-40 shrink-0 truncate px-3 py-2 text-sm text-default" :title="r.title">{{ r.title }}</span>
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
      </ul>
    </div>
  </div>
</template>
