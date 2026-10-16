<script setup lang="ts">
/** Plain text with its line breaks, clamped to `lines` with "Show more" / "Show less" when it overflows */
const props = defineProps<{ text: string, lines: 3 | 6 }>()
const { t } = useI18n()
const CLAMP = { 3: 'line-clamp-3', 6: 'line-clamp-6' } as const

const el = useTemplateRef('el')
const expanded = ref(false)
const overflows = ref(false)
const measure = () => nextTick(() => {
  if (el.value && !expanded.value) overflows.value = el.value.scrollHeight > el.value.clientHeight + 1
})
onMounted(measure)
watch(() => props.text, measure)
</script>

<template>
  <div>
    <p ref="el" class="max-w-prose whitespace-pre-line text-pretty" :class="expanded ? '' : CLAMP[lines]">{{ text }}</p>
    <UButton
      v-if="overflows"
      :label="expanded ? t('programs.showLess') : t('programs.showMore')"
      color="neutral"
      variant="link"
      size="xs"
      class="-ms-2 mt-1"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    />
  </div>
</template>
