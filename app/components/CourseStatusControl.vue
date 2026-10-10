<script setup lang="ts">
import type { CourseStatus } from '~~/shared/types'

const props = defineProps<{ modelValue: CourseStatus, title: string }>()
const emit = defineEmits<{ 'update:modelValue': [CourseStatus] }>()
const { t } = useI18n()

const options: { value: CourseStatus, icon: string }[] = [
  { value: 'todo', icon: 'i-lucide-circle-dashed' },
  { value: 'in_progress', icon: 'i-lucide-loader' },
  { value: 'done', icon: 'i-lucide-check' }
]

const tone: Record<CourseStatus, string> = {
  todo: 'bg-accented text-highlighted',
  in_progress: 'bg-primary/15 text-primary ring-1 ring-inset ring-primary/40',
  done: 'bg-success/20 text-success ring-1 ring-inset ring-success/40'
}

function onKey(e: KeyboardEvent, i: number) {
  const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
  if (!dir) return
  e.preventDefault()
  const next = options[(i + dir + options.length) % options.length]!
  emit('update:modelValue', next.value)
  nextTick(() => (e.currentTarget as HTMLElement | null)?.parentElement?.querySelectorAll<HTMLElement>('[role=radio]')[(i + dir + options.length) % options.length]?.focus())
}
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="t('status.label', { title })"
    class="inline-flex items-center rounded-md bg-muted p-0.5 ring-1 ring-inset ring-default"
  >
    <button
      v-for="(o, i) in options"
      :key="o.value"
      type="button"
      role="radio"
      :aria-checked="props.modelValue === o.value"
      :tabindex="props.modelValue === o.value ? 0 : -1"
      class="flex h-7 items-center gap-1.5 rounded px-2 text-xs font-medium transition-[background-color,color] duration-150 ease-out cursor-pointer"
      :class="props.modelValue === o.value ? tone[o.value] : 'text-muted hover:text-highlighted hover:bg-elevated'"
      @click="emit('update:modelValue', o.value)"
      @keydown="onKey($event, i)"
    >
      <UIcon :name="o.icon" class="size-3.5 shrink-0" />
      <span class="hidden whitespace-nowrap sm:inline">{{ t(`status.${o.value}`) }}</span>
      <span class="sr-only sm:hidden">{{ t(`status.${o.value}`) }}</span>
    </button>
  </div>
</template>
