<script setup lang="ts">
/**
 * Homework submit form (spec course-content.md, Submit form, Phase 1): files (any allowed type, ≤ 10, 25 MB each,
 * uploaded on select), a markdown note and links (≤ 10). At least one part. A failed send keeps everything.
 */
const props = defineProps<{ assignmentId: string }>()
const emit = defineEmits<{ sent: [], error: [e: unknown] }>()
const { t, locale } = useI18n()
const toast = useToast()
const { upload } = useStorageUpload()

interface Item { key: number, name: string, size: number, id?: string, state: 'uploading' | 'done' | 'error' }
const files = ref<Item[]>([])
const body = ref('')
const links = ref<string[]>([''])
const sending = ref(false)
const error = ref<string>()
const MAX_FILES = 10
/** Bound, not static: a static `//` inside v-for breaks vue-tsc's generated code */
const LINK_PLACEHOLDER = 'https://github.com/…'
let seq = 0

const fileInput = useTemplateRef('fileInput')
async function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  const picked = [...(input.files ?? [])]
  input.value = ''
  for (const f of picked) {
    if (files.value.length >= MAX_FILES) {
      toast.add({ title: t('submission.err.maxFiles', { n: MAX_FILES }), color: 'error', icon: 'i-lucide-circle-alert' })
      break
    }
    const check = checkUpload(f.name, f.size, 'submission')
    if (!check.ok) {
      toast.add({ title: check.reason === 'type' ? t('submission.err.fileType', { name: f.name }) : t('submission.err.fileSize', { name: f.name }), color: 'error', icon: 'i-lucide-circle-alert' })
      continue
    }
    const item = reactive<Item>({ key: ++seq, name: f.name, size: f.size, state: 'uploading' })
    files.value.push(item)
    upload(f, 'submission').then((id) => {
      item.id = id
      item.state = 'done'
    }).catch(() => (item.state = 'error'))
  }
}
const removeFile = (key: number) => (files.value = files.value.filter(f => f.key !== key))
const busy = computed(() => files.value.some(f => f.state === 'uploading'))

const cleanLinks = computed(() => links.value.map(l => l.trim()).filter(Boolean))
const badLink = computed(() => cleanLinks.value.find(l => !/^https?:\/\/\S+\.\S+/i.test(l)))

async function send() {
  error.value = undefined
  const fileIds = files.value.filter(f => f.state === 'done').map(f => f.id!)
  if (!fileIds.length && !body.value.trim() && !cleanLinks.value.length) return void (error.value = t('submission.err.empty'))
  if (badLink.value) return void (error.value = t('submission.err.url'))
  sending.value = true
  try {
    await $fetch(`/api/assignments/${props.assignmentId}/submissions`, { method: 'POST', body: { body: body.value, links: cleanLinks.value, fileIds } })
    files.value = []
    body.value = ''
    links.value = ['']
    emit('sent')
  } catch (e) {
    emit('error', e) // the form keeps everything, so a retry costs nothing
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <div class="space-y-2">
      <p class="text-sm font-medium text-highlighted">{{ t('submission.files') }}</p>
      <ul v-if="files.length" class="space-y-1.5">
        <li v-for="f in files" :key="f.key" class="flex items-center gap-3 rounded-lg px-3 py-2 ring-1 ring-inset ring-default">
          <UIcon :name="f.state === 'uploading' ? 'i-lucide-loader-circle' : f.state === 'error' ? 'i-lucide-circle-alert' : fileKind(f.name).icon" class="size-4 shrink-0" :class="f.state === 'uploading' ? 'animate-spin text-muted' : f.state === 'error' ? 'text-error' : 'text-muted'" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate text-sm text-highlighted">{{ f.name }}</span>
          <span class="num shrink-0 text-xs" :class="f.state === 'error' ? 'text-error' : 'text-muted'">
            {{ f.state === 'error' ? t('submission.uploadFailed') : f.state === 'uploading' ? t('submission.uploading') : formatBytes(f.size, locale) }}
          </span>
          <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" :aria-label="t('submission.removeFile', { name: f.name })" @click="removeFile(f.key)" />
        </li>
      </ul>
      <input ref="fileInput" type="file" multiple class="sr-only" tabindex="-1" :accept="acceptFor('submission')" @change="onPick">
      <UButton :label="t('submission.addFiles')" icon="i-lucide-paperclip" color="neutral" variant="outline" size="sm" :disabled="files.length >= MAX_FILES" @click="fileInput?.click()" />
      <p class="text-xs text-muted">{{ t('submission.filesHint', { n: MAX_FILES }) }}</p>
    </div>

    <div class="space-y-2">
      <p class="text-sm font-medium text-highlighted">{{ t('submission.note') }} <span class="font-normal text-muted">· {{ t('common.optional') }}</span></p>
      <MarkdownEditor v-model="body" mode="compact" :max-length="50000" :placeholder="t('submission.notePlaceholder')" />
    </div>

    <div class="space-y-2">
      <p class="text-sm font-medium text-highlighted">{{ t('submission.links') }} <span class="font-normal text-muted">· {{ t('common.optional') }}</span></p>
      <div v-for="(link, index) in links" :key="index" class="flex gap-2">
        <UInput :model-value="link" type="url" inputmode="url" :placeholder="LINK_PLACEHOLDER" class="w-full" :aria-label="t('submission.link', { n: index + 1 })" @update:model-value="v => (links[index] = String(v))" />
        <UButton v-if="links.length > 1" icon="i-lucide-x" color="neutral" variant="ghost" :aria-label="t('submission.removeLink')" @click="links.splice(index, 1)" />
      </div>
      <UButton v-if="links.length < 10" :label="t('submission.addLink')" icon="i-lucide-plus" color="neutral" variant="ghost" size="xs" @click="links.push('')" />
    </div>

    <p v-if="error" class="text-sm text-error" role="alert">{{ error }}</p>
    <UButton :label="t('submission.send')" icon="i-lucide-send" color="primary" size="lg" :loading="sending" :disabled="busy" @click="send" />
  </div>
</template>
