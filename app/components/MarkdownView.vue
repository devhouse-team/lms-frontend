<script setup lang="ts">
import type { FileMeta } from '~~/shared/types'

/**
 * Renders authored markdown with the one pipeline (`renderMarkdown`): math, highlighted code, `file:` images through
 * Nitro, sanitized by DOMPurify. The only `v-html` in the app. Rendered after mount; a skeleton holds the place.
 */
const props = defineProps<{ source: string, files?: FileMeta[], base?: string }>()
const { t } = useI18n()
const toast = useToast()

const html = ref<string>()
async function render() {
  html.value = await renderMarkdown(props.source, {
    files: props.files,
    base: props.base,
    labels: { copy: t('content.copy'), missingFile: id => t('content.missingFile', { id }) }
  })
}
onMounted(render)
watch(() => [props.source, props.files, props.base], render)

/** Copy buttons in code blocks (event delegation: the HTML is generated) */
async function onClick(e: MouseEvent) {
  const btn = (e.target as HTMLElement).closest('[data-copy]')
  if (!btn) return
  try {
    await navigator.clipboard.writeText(btn.parentElement?.querySelector('code')?.textContent ?? '')
    toast.add({ title: t('content.copied'), icon: 'i-lucide-clipboard-check', color: 'neutral' })
  } catch {
    toast.add({ title: t('common.saveError'), color: 'error' })
  }
}
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- sanitized by DOMPurify in renderMarkdown (spec: the only v-html) -->
  <div v-if="html !== undefined" class="md-body" @click="onClick" v-html="html" />
  <div v-else class="max-w-[72ch] space-y-2" aria-busy="true">
    <USkeleton class="h-4 w-11/12" />
    <USkeleton class="h-4 w-10/12" />
    <USkeleton class="h-4 w-7/12" />
  </div>
</template>
