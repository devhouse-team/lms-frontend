<script setup lang="ts">
import type { PromptField } from '~/composables/useCourseEditor'

/** A small form in a modal for the outline's add / rename / offset actions */
const props = defineProps<{ title: string, fields: PromptField[], initial?: Record<string, string | number>, submitLabel?: string }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ submit: [values: Record<string, string | number>] }>()
const { t } = useI18n()

const values = ref<Record<string, string | number>>({})
watch(open, (o) => {
  if (o) values.value = Object.fromEntries(props.fields.map(f => [f.name, props.initial?.[f.name] ?? (f.type === 'number' ? 0 : '')]))
})
const valid = computed(() => props.fields.every((f) => {
  const v = values.value[f.name]
  return f.type === 'number' ? Number.isInteger(v) && (f.min === undefined || (v as number) >= f.min) && (f.max === undefined || (v as number) <= f.max) : String(v ?? '').trim().length >= 1 && String(v).length <= 200
}))
function submit() {
  if (!valid.value) return
  emit('submit', Object.fromEntries(Object.entries(values.value).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])))
  open.value = false
}
</script>

<template>
  <UModal v-model:open="open" :title="title">
    <template #body>
      <form id="editor-prompt" class="space-y-4" @submit.prevent="submit">
        <UFormField v-for="f in fields" :key="f.name" :label="f.label" :help="f.help">
          <UInputNumber v-if="f.type === 'number'" v-model="values[f.name] as number" :min="f.min" :max="f.max" class="w-36" />
          <UInput v-else v-model="values[f.name] as string" autocomplete="off" class="w-full" autofocus />
        </UFormField>
      </form>
    </template>
    <template #footer>
      <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
      <UButton type="submit" form="editor-prompt" :label="submitLabel ?? t('common.save')" color="primary" :disabled="!valid" />
    </template>
  </UModal>
</template>
