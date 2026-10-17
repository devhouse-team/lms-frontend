<script setup lang="ts">
import type { AcceptedFormats } from '~~/shared/types'

/**
 * Submit form shared by every mode (spec course-content.md, Submit form), built from the assignment's accepted formats:
 * files (uploaded on select, limited by count and type groups, 25 MB each), a markdown note and links (≤ 10), only the
 * parts the assignment accepts. At least one part. A failed send keeps everything. `confirmText` asks first (exams).
 */
const props = defineProps<{
  cohortId: string
  assignmentId: string
  accepts: AcceptedFormats
  /** An exam trial: never counts */
  trial?: boolean
  confirmText?: string
  sendLabel?: string
}>()
const emit = defineEmits<{ sent: [], error: [e: unknown] }>()
const { t, locale } = useI18n()
const toast = useToast()
const { upload } = useStorageUpload()

interface Item { key: number, file: File, name: string, size: number, id?: string, state: 'uploading' | 'done' | 'error' }
const files = ref<Item[]>([])
const body = ref('')
const links = ref<string[]>([''])
const sending = ref(false)
const confirming = ref(false)
const error = ref<string>()
/** Bound, not static: a static `//` inside v-for breaks vue-tsc's generated code */
const LINK_PLACEHOLDER = 'https://github.com/…'
let seq = 0

const fileInput = useTemplateRef('fileInput')
async function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  const picked = [...(input.files ?? [])]
  input.value = ''
  for (const f of picked) {
    if (counted.value >= props.accepts.maxFiles) {
      toast.add({ title: t('submission.err.maxFiles', { n: props.accepts.maxFiles }), color: 'error', icon: 'i-lucide-circle-alert' })
      break
    }
    const check = checkUpload(f.name, f.size, 'submission')
    if (!check.ok || !inGroups(f.name, props.accepts.fileTypes)) {
      toast.add({ title: check.ok || check.reason === 'type' ? t('submission.err.fileType', { name: f.name }) : t('submission.err.fileSize', { name: f.name }), color: 'error', icon: 'i-lucide-circle-alert' })
      continue
    }
    const item = reactive<Item>({ key: ++seq, file: f, name: f.name, size: f.size, state: 'uploading' })
    files.value.push(item)
    start(item)
  }
}
function start(item: Item) {
  item.state = 'uploading'
  upload(item.file, 'submission').then((id) => {
    item.id = id
    item.state = 'done'
  }).catch(() => (item.state = 'error'))
}
/** Failed uploads don't count towards the limit: they're retried or removed */
const counted = computed(() => files.value.filter(f => f.state !== 'error').length)
const removeFile = (key: number) => (files.value = files.value.filter(f => f.key !== key))
const busy = computed(() => files.value.some(f => f.state === 'uploading'))

const cleanLinks = computed(() => links.value.map(l => l.trim()).filter(Boolean))
const badLink = computed(() => cleanLinks.value.find(l => !/^https?:\/\/\S+\.\S+/i.test(l)))
const typesHint = computed(() => (props.accepts.fileTypes.length ? props.accepts.fileTypes.map(g => t(`submission.group.${g}`)).join(', ') : t('submission.anyType')))

/** Only the accepted parts are sent */
function payload() {
  return {
    body: props.accepts.text ? body.value : '',
    links: props.accepts.links ? cleanLinks.value : [],
    fileIds: props.accepts.files ? files.value.filter(f => f.state === 'done').map(f => f.id!) : [],
    isTrial: !!props.trial
  }
}

function check() {
  error.value = undefined
  if (files.value.some(f => f.state === 'error')) return void (error.value = t('submission.err.failedFiles'))
  const p = payload()
  if (!p.fileIds.length && !p.body.trim() && !p.links.length) return void (error.value = t(props.accepts.files && !props.accepts.text && !props.accepts.links ? 'submission.err.emptyFiles' : 'submission.err.empty'))
  if (props.accepts.links && badLink.value) return void (error.value = t('submission.err.url'))
  return p
}

function onSend() {
  if (!check()) return
  if (props.confirmText) confirming.value = true
  else send()
}

async function send() {
  const p = check()
  confirming.value = false
  if (!p) return
  sending.value = true
  try {
    await $fetch(`/api/assignments/${props.cohortId}/${props.assignmentId}/submissions`, { method: 'POST', body: p })
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
    <div v-if="accepts.files" class="space-y-2">
      <p class="text-sm font-medium text-highlighted">{{ t('submission.files') }}</p>
      <ul v-if="files.length" class="space-y-1.5">
        <li v-for="f in files" :key="f.key" class="flex items-center gap-3 rounded-lg px-3 py-2 ring-1 ring-inset ring-default">
          <UIcon :name="f.state === 'uploading' ? 'i-lucide-loader-circle' : f.state === 'error' ? 'i-lucide-circle-alert' : fileKind(f.name).icon" class="size-4 shrink-0" :class="f.state === 'uploading' ? 'animate-spin text-muted' : f.state === 'error' ? 'text-error' : 'text-muted'" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate text-sm text-highlighted">{{ f.name }}</span>
          <span class="num shrink-0 text-xs" :class="f.state === 'error' ? 'text-error' : 'text-muted'">
            {{ f.state === 'error' ? t('submission.uploadFailed') : f.state === 'uploading' ? t('submission.uploading') : formatBytes(f.size, locale) }}
          </span>
          <UButton v-if="f.state === 'error'" :label="t('common.retry')" color="neutral" variant="outline" size="xs" @click="start(f)" />
          <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" :aria-label="t('submission.removeFile', { name: f.name })" @click="removeFile(f.key)" />
        </li>
      </ul>
      <input ref="fileInput" type="file" :multiple="accepts.maxFiles > 1" class="sr-only" tabindex="-1" :accept="acceptForGroups(accepts.fileTypes)" @change="onPick">
      <UButton :label="t('submission.addFiles')" icon="i-lucide-paperclip" color="neutral" variant="outline" size="sm" :disabled="counted >= accepts.maxFiles" @click="fileInput?.click()" />
      <p class="text-xs text-muted">{{ t('submission.filesLimits', { n: accepts.maxFiles, types: typesHint }, accepts.maxFiles) }}</p>
    </div>

    <div v-if="accepts.text" class="space-y-2">
      <p class="text-sm font-medium text-highlighted">{{ t('submission.note') }} <span v-if="accepts.files || accepts.links" class="font-normal text-muted">· {{ t('common.optional') }}</span></p>
      <MarkdownEditor v-model="body" mode="compact" :max-length="50000" :placeholder="t('submission.notePlaceholder')" />
    </div>

    <div v-if="accepts.links" class="space-y-2">
      <p class="text-sm font-medium text-highlighted">{{ t('submission.links') }} <span v-if="accepts.files || accepts.text" class="font-normal text-muted">· {{ t('common.optional') }}</span></p>
      <div v-for="(link, index) in links" :key="index" class="flex gap-2">
        <UInput :model-value="link" type="url" inputmode="url" :placeholder="LINK_PLACEHOLDER" class="w-full" :aria-label="t('submission.link', { n: index + 1 })" @update:model-value="v => (links[index] = String(v))" />
        <UButton v-if="links.length > 1" icon="i-lucide-x" color="neutral" variant="ghost" :aria-label="t('submission.removeLink')" @click="links.splice(index, 1)" />
      </div>
      <UButton v-if="links.length < 10" :label="t('submission.addLink')" icon="i-lucide-plus" color="neutral" variant="ghost" size="xs" @click="links.push('')" />
    </div>

    <p v-if="error" class="text-sm text-error" role="alert">{{ error }}</p>
    <UButton :label="sendLabel ?? t('submission.send')" icon="i-lucide-send" :color="trial ? 'neutral' : 'primary'" :variant="trial ? 'outline' : 'solid'" size="lg" :loading="sending" :disabled="busy" @click="onSend" />

    <UModal v-if="confirmText" v-model:open="confirming" :title="t('exam.confirmTitle')">
      <template #body>
        <p class="text-sm">{{ confirmText }}</p>
      </template>
      <template #footer>
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="confirming = false" />
        <UButton :label="t('exam.confirmSend')" color="primary" :loading="sending" @click="send" />
      </template>
    </UModal>
  </div>
</template>
