<script setup lang="ts">
import type { FileMeta } from '~~/shared/types'

/**
 * Markdown editor (spec course-content.md, Markdown editor): a Mono textarea with a toolbar and a live preview that
 * uses the reader's own renderer. `full`: side by side from `lg`, Upload .md; `compact`: Write / Preview tabs.
 * `upload` turns pasted, dropped or picked images into attached files referenced as `file:<id>`.
 */
const props = withDefaults(defineProps<{
  mode?: 'full' | 'compact'
  maxLength: number
  /** Files attached to the object, for `file:` references in the preview */
  files?: FileMeta[]
  /** Nitro file route of the object, for the preview */
  base?: string
  upload?: (file: File) => Promise<FileMeta | null>
  placeholder?: string
}>(), { mode: 'compact', files: () => [], base: undefined, upload: undefined, placeholder: undefined })
const model = defineModel<string>({ required: true })
const { t } = useI18n()
const toast = useToast()

const area = useTemplateRef<{ textareaRef: HTMLTextAreaElement }>('area')
const el = () => area.value?.textareaRef
const tab = ref<'write' | 'preview'>('write')

/** Preview re-renders 300 ms after typing stops */
const preview = ref(model.value)
let timer: ReturnType<typeof setTimeout> | undefined
watch(model, (v) => {
  clearTimeout(timer)
  timer = setTimeout(() => (preview.value = v), 300)
})
onBeforeUnmount(() => clearTimeout(timer))

/** Replace the selection (or insert at the caret) and keep the caret where it makes sense */
function replace(text: string, selectFrom = text.length, selectTo = selectFrom) {
  const ta = el()
  if (!ta) return
  const { selectionStart: s, selectionEnd: e } = ta
  model.value = model.value.slice(0, s) + text + model.value.slice(e)
  nextTick(() => {
    ta.focus()
    ta.setSelectionRange(s + selectFrom, s + selectTo)
  })
}
function wrap(before: string, after: string, fallback: string) {
  const ta = el()
  if (!ta) return
  const sel = model.value.slice(ta.selectionStart, ta.selectionEnd) || fallback
  replace(before + sel + after, before.length, before.length + sel.length)
}
function linePrefix(prefix: string) {
  const ta = el()
  if (!ta) return
  const start = model.value.lastIndexOf('\n', ta.selectionStart - 1) + 1
  ta.setSelectionRange(start, start)
  replace(prefix)
}

const tools = computed(() => [
  { key: 'bold', icon: 'i-lucide-bold', kbd: '⌘B', run: () => wrap('**', '**', t('editor.md.boldText')) },
  { key: 'italic', icon: 'i-lucide-italic', kbd: '⌘I', run: () => wrap('_', '_', t('editor.md.italicText')) },
  { key: 'heading', icon: 'i-lucide-heading', run: () => linePrefix('## ') },
  { key: 'link', icon: 'i-lucide-link', kbd: '⌘K', run: () => wrap('[', '](https://)', t('editor.md.linkText')) },
  { key: 'code', icon: 'i-lucide-code', run: () => wrap('`', '`', 'code') },
  { key: 'codeBlock', icon: 'i-lucide-square-code', run: () => wrap('\n```python\n', '\n```\n', 'print("hello")') },
  { key: 'math', icon: 'i-lucide-sigma', run: () => wrap('$', '$', 'x^2') },
  { key: 'mathBlock', icon: 'i-lucide-square-sigma', run: () => wrap('\n$$\n', '\n$$\n', '\\sum_{i=1}^{n} i') },
  { key: 'table', icon: 'i-lucide-table', run: () => replace('\n| A | B | C |\n|---|---|---|\n|   |   |   |\n|   |   |   |\n') },
  ...(props.upload ? [{ key: 'image', icon: 'i-lucide-image-plus', run: () => imageInput.value?.click() }] : []),
  ...(props.mode === 'full' ? [{ key: 'uploadMd', icon: 'i-lucide-file-up', run: () => mdInput.value?.click() }] : [])
])

/** Esc then Tab leaves the field; otherwise Tab indents (keyboard users aren't trapped) */
let escaped = false
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    escaped = true
    return
  }
  if (e.key === 'Tab' && !e.shiftKey && !escaped) {
    e.preventDefault()
    replace('  ')
  }
  escaped = false
  if (!(e.metaKey || e.ctrlKey)) return
  const k = e.key.toLowerCase()
  const tool = k === 'b' ? 'bold' : k === 'i' ? 'italic' : k === 'k' ? 'link' : undefined
  if (tool) {
    e.preventDefault()
    tools.value.find(x => x.key === tool)?.run()
  }
}

// ---- images: paste, drop, pick -----------------------------------------------------------
const imageInput = useTemplateRef('imageInput')
const uploading = ref(0)
let placeholders = 0
/** All placeholders go in with one edit at the caret, then each upload swaps its own (numbered) placeholder */
function insertImages(files: File[]) {
  if (!props.upload || !files.length) return
  const items = files.map(file => ({ file, placeholder: `![${t('editor.md.uploading', { name: file.name })} #${++placeholders}]()` }))
  replace(items.map(x => x.placeholder).join('\n'))
  for (const { file, placeholder } of items) {
    uploading.value++
    props.upload(file)
      .then(meta => (model.value = model.value.replace(placeholder, meta ? `![${file.name.replace(/\.[^.]+$/, '')}](file:${meta.id})` : '')))
      .catch(() => (model.value = model.value.replace(placeholder, '')))
      .finally(() => uploading.value--)
  }
}
function onPaste(e: ClipboardEvent) {
  const images = [...(e.clipboardData?.files ?? [])].filter(f => f.type.startsWith('image/'))
  if (!images.length || !props.upload) return
  e.preventDefault()
  insertImages(images)
}
function onDrop(e: DragEvent) {
  const images = [...(e.dataTransfer?.files ?? [])].filter(f => f.type.startsWith('image/'))
  if (!images.length || !props.upload) return
  e.preventDefault()
  insertImages(images)
}
function onImagePick(e: Event) {
  const input = e.target as HTMLInputElement
  insertImages([...(input.files ?? [])])
  input.value = ''
}

// ---- .md upload: read in the browser, never stored as a file ------------------------------
const mdInput = useTemplateRef('mdInput')
const unresolved = ref<string[]>([])
async function onMdPick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const text = await file.text()
  if (text.length > props.maxLength) return void toast.add({ title: t('editor.md.tooLong', { n: props.maxLength }), color: 'error', icon: 'i-lucide-circle-alert' })
  if (model.value.trim() && !confirm(t('editor.md.replaceConfirm'))) return
  model.value = text
  preview.value = text
  // Relative image paths point at the author's computer and can't resolve
  unresolved.value = [...text.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)].map(m => m[1]!).filter(src => !/^(https?:|file:)/i.test(src))
}

const count = computed(() => model.value.length)
</script>

<template>
  <div class="space-y-2">
    <div class="flex flex-wrap items-center gap-0.5" role="toolbar" :aria-label="t('editor.md.toolbar')">
      <UTooltip v-for="tool in tools" :key="tool.key" :text="tool.kbd ? `${t(`editor.md.${tool.key}`)} (${tool.kbd})` : t(`editor.md.${tool.key}`)">
        <UButton :icon="tool.icon" color="neutral" variant="ghost" size="xs" :aria-label="t(`editor.md.${tool.key}`)" :aria-keyshortcuts="tool.kbd?.replace('⌘', 'Meta+')" @click="tool.run" />
      </UTooltip>
      <div class="ms-auto flex items-center gap-2" :class="mode === 'full' && 'lg:hidden'">
        <UTabs v-model="tab" :items="[{ value: 'write', label: t('editor.md.write') }, { value: 'preview', label: t('editor.md.preview') }]" :content="false" size="xs" color="neutral" />
      </div>
      <input ref="imageInput" type="file" class="sr-only" tabindex="-1" :accept="acceptFor('content_image')" multiple @change="onImagePick">
      <input ref="mdInput" type="file" class="sr-only" tabindex="-1" accept=".md,.markdown,text/markdown" @change="onMdPick">
    </div>

    <UAlert
      v-if="unresolved.length"
      color="warning"
      variant="subtle"
      icon="i-lucide-image-off"
      :title="t('editor.md.unresolved', unresolved.length)"
      :description="unresolved.join(', ')"
      :close="true"
      @update:open="unresolved = []"
    />

    <div :class="mode === 'full' && 'lg:grid lg:grid-cols-2 lg:gap-4'">
      <div :class="[tab === 'preview' && 'hidden', mode === 'full' && 'lg:block']">
        <UTextarea
          ref="area"
          v-model="model"
          autoresize
          :rows="mode === 'full' ? 12 : 5"
          :maxrows="mode === 'full' ? 0 : 16"
          :placeholder="placeholder"
          class="w-full"
          :ui="{ base: 'font-mono text-[13px] leading-relaxed' }"
          @keydown="onKeydown"
          @paste="onPaste"
          @drop="onDrop"
        />
        <div class="mt-1 flex items-center gap-3 text-xs text-muted">
          <span v-if="uploading" class="inline-flex items-center gap-1"><UIcon name="i-lucide-loader-circle" class="size-3.5 animate-spin" />{{ t('editor.md.uploadingImages') }}</span>
          <span v-if="count > maxLength * 0.8" class="num ms-auto" :class="count > maxLength * 0.9 ? 'text-warning' : ''">{{ count.toLocaleString() }} / {{ maxLength.toLocaleString() }}</span>
        </div>
      </div>
      <section
        :class="[tab === 'write' && 'hidden', mode === 'full' && 'lg:block']"
        class="min-h-24 rounded-lg p-4 ring-1 ring-inset ring-default"
        :aria-label="t('editor.md.preview')"
      >
        <MarkdownView v-if="preview.trim()" :source="preview" :files="files" :base="base" />
        <p v-else class="text-sm text-dimmed">{{ t('editor.md.nothing') }}</p>
      </section>
    </div>
  </div>
</template>
