<script setup lang="ts">
/** Markdown clamped to about `lines` lines, with "Show more" / "Show less" when it overflows */
const props = defineProps<{ text: string, lines: 3 | 6 }>()
const { t } = useI18n()

const box = useTemplateRef('box')
const inner = useTemplateRef('inner')
const expanded = ref(false)
const overflows = ref(false)
let observer: ResizeObserver | undefined
onMounted(() => {
  // The markdown renders after mount, so measure whenever the content's size changes
  observer = new ResizeObserver(() => {
    if (box.value && !expanded.value) overflows.value = box.value.scrollHeight > box.value.clientHeight + 1
  })
  if (box.value) observer.observe(box.value)
  if (inner.value) observer.observe(inner.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div>
    <div ref="box" class="overflow-hidden" :style="expanded ? undefined : { maxHeight: `${props.lines * 1.6}em` }">
      <div ref="inner">
        <MarkdownView :source="text" />
      </div>
    </div>
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
