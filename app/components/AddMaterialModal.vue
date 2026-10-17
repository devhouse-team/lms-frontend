<script setup lang="ts">
import type { components } from '~~/shared/types/api'
import type { MaterialKind } from '~~/shared/types'

/**
 * Create a material of one kind on a lesson (or a course page with `lessonId` unset): title plus the kind's file or
 * URL. Markdown then opens the material editor; the others stay in the outline. Created unpublished.
 */
const props = defineProps<{ kind?: MaterialKind, lessonId?: number }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const { courseId, call } = useCourseEditor()
const { upload, uploading } = useStorageUpload()

const title = ref('')
const url = ref('')
const fileIds = ref<number[]>([])
const fileNames = ref<string[]>([])
const fileError = ref<string>()
const saving = ref(false)
watch(open, (o) => {
  if (!o) return
  title.value = ''
  url.value = ''
  fileIds.value = []
  fileNames.value = []
  fileError.value = undefined
})

const needsFile = computed(() => props.kind === 'pdf' || props.kind === 'image' || props.kind === 'file')
const needsUrl = computed(() => props.kind === 'video' || props.kind === 'link')
const embed = computed(() => (props.kind === 'video' && url.value ? toEmbed(url.value) : null))
const urlError = computed(() => {
  if (!url.value) return undefined
  if (props.kind === 'video') return embed.value ? undefined : t('editor.err.videoHost')
  return /^https?:\/\/\S+\.\S+/i.test(url.value) ? undefined : t('editor.err.url')
})
const accept = computed(() => (props.kind === 'pdf' ? '.pdf' : props.kind === 'image' ? acceptFor('content_image') : acceptFor('content')))
const valid = computed(() => title.value.trim().length >= 1 && (!needsFile.value || fileIds.value.length) && (!needsUrl.value || (url.value && !urlError.value)))

async function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  const picked = [...(input.files ?? [])]
  input.value = ''
  fileError.value = undefined
  for (const f of props.kind === 'file' ? picked : picked.slice(0, 1)) {
    const check = checkUpload(f.name, f.size, props.kind === 'image' ? 'content_image' : 'content')
    if (!check.ok || (props.kind === 'pdf' && check.contentType !== 'application/pdf')) {
      fileError.value = t(check.ok || check.reason === 'type' ? 'editor.err.fileType' : 'editor.err.fileSize', { name: f.name })
      continue
    }
    try {
      const id = await upload(f, 'content')
      if (props.kind === 'file') {
        fileIds.value.push(Number(id))
        fileNames.value.push(f.name)
      } else {
        fileIds.value = [Number(id)]
        fileNames.value = [f.name]
      }
      if (!title.value) title.value = f.name.replace(/\.[^.]+$/, '')
    } catch {
      fileError.value = t('editor.err.upload', { name: f.name })
    }
  }
}

async function create() {
  if (!valid.value || !props.kind) return
  saving.value = true
  const body = {
    title: title.value.trim(),
    kind: props.kind,
    tags: [],
    body: props.kind === 'markdown' ? t('editor.starterBody') : '',
    url: needsUrl.value ? url.value.trim() : null,
    file_ids: fileIds.value,
    is_published: false
  }
  const path = props.lessonId ? `lessons/${props.lessonId}/materials` : `courses/${courseId}/materials`
  const m = await call<components['schemas']['MaterialRead']>('POST', path, body, t('editor.materialAdded'))
  saving.value = false
  if (!m) return
  open.value = false
  if (props.kind === 'markdown') await navigateTo(`/editor/${courseId}/materials/${m.id}`)
}
</script>

<template>
  <UModal v-model:open="open" :title="kind ? t('editor.addKind', { kind: t(`material.kind.${kind}`) }) : ''">
    <template #body>
      <form id="add-material" class="space-y-4" @submit.prevent="create">
        <UFormField v-if="needsFile" :label="kind === 'file' ? t('editor.files') : t('editor.file')" :error="fileError">
          <div class="space-y-2">
            <p v-for="n in fileNames" :key="n" class="truncate text-sm text-highlighted"><UIcon name="i-lucide-check" class="me-1 size-4 align-middle text-success" />{{ n }}</p>
            <label class="inline-flex">
              <input type="file" class="sr-only" :accept="accept" :multiple="kind === 'file'" @change="onFiles">
              <UButton as="span" :label="uploading ? t('submission.uploading') : t('editor.chooseFile')" :loading="uploading" icon="i-lucide-upload" color="neutral" variant="outline" size="sm" />
            </label>
          </div>
        </UFormField>
        <UFormField v-if="needsUrl" :label="kind === 'video' ? t('editor.videoUrl') : t('editor.url')" :error="urlError" :help="kind === 'video' && !urlError ? t('editor.videoHelp') : undefined">
          <UInput v-model="url" type="url" inputmode="url" placeholder="https://" class="w-full" />
        </UFormField>
        <div v-if="embed" class="aspect-video overflow-hidden rounded-lg bg-black ring-1 ring-inset ring-default">
          <iframe :src="embed.embedUrl" :title="title || t('editor.videoUrl')" class="size-full" allow="fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" />
        </div>
        <UFormField :label="t('editor.title')">
          <UInput v-model="title" maxlength="200" autocomplete="off" class="w-full" />
        </UFormField>
      </form>
    </template>
    <template #footer>
      <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
      <UButton type="submit" form="add-material" :label="t('editor.create')" color="primary" :disabled="!valid || uploading" :loading="saving" />
    </template>
  </UModal>
</template>
