<script setup lang="ts">
import { z } from 'zod'
import type { PersonOption, ProgramDetail, ProgramInput } from '~~/shared/types'

/**
 * Create (no `program`) or edit a program. No status or position field: status changes through the header actions.
 * Edit sends only the changed fields. The lead picker is for `canManage` (head); the lead sees the name read-only.
 * Spec: programs.md, Program modal.
 */
const props = defineProps<{ program?: ProgramDetail, canManage: boolean }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [] }>()

const { t } = useI18n()
const toast = useToast()
const { message, toastError, code } = useProgramErrors()
const { uploading, upload } = useStorageUpload()

const { data: people, status: peopleStatus, execute: loadPeople } = useLazyFetch<PersonOption[]>('/api/people/options', {
  key: 'people-options', immediate: false, server: false, default: () => []
})
const NO_LEAD = 'none'
const leadItems = computed(() => [
  { value: NO_LEAD, label: t('programs.form.noLead') },
  ...people.value.map(p => ({ value: p.id, label: p.name, description: p.email, avatar: { src: p.avatar, alt: p.name } }))
])

const COVER_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const COVER_MAX = 5 * 1024 * 1024
const months = (weeks: number) => Math.round(weeks / 4.345)

const schema = computed(() => z.object({
  title: z.string().trim().min(2, t('programs.err.title')).max(200, t('programs.err.title')),
  slug: z.string().min(2, t('programs.err.slug')).max(100, t('programs.err.slug')).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, t('programs.err.slug')),
  description: z.string().max(5000, t('programs.err.description')),
  durationWeeks: z.number({ message: t('programs.err.duration') }).int(t('programs.err.duration')).min(1, t('programs.err.duration')).max(104, t('programs.err.duration'))
}))

interface State { title: string, slug: string, description: string, durationWeeks?: number, leadId: string }
const state = reactive<State>({ title: '', slug: '', description: '', durationWeeks: 26, leadId: NO_LEAD })
/** undefined: cover untouched · string: a new uploaded file · null: removed */
const coverFileId = ref<string | null>()
const preview = ref<string | null>(null)
const slugTouched = ref(false)
const form = useTemplateRef('form')
const fileInput = useTemplateRef('fileInput')
const saving = ref(false)

function setPreview(url: string | null) {
  if (preview.value?.startsWith('blob:')) URL.revokeObjectURL(preview.value)
  preview.value = url
}

watch(open, (isOpen) => {
  if (!isOpen) return setPreview(null)
  const p = props.program
  Object.assign(state, p
    ? { title: p.title, slug: p.slug, description: p.description, durationWeeks: p.durationWeeks, leadId: p.lead?.id ?? NO_LEAD }
    : { title: '', slug: '', description: '', durationWeeks: 26, leadId: NO_LEAD })
  slugTouched.value = !!p
  coverFileId.value = undefined
  setPreview(p?.coverUrl ?? null)
  if (props.canManage && !people.value.length) loadPeople()
})
onBeforeUnmount(() => setPreview(null))

// Create: the slug follows the title until it is typed by hand; clearing it resumes following
watch(() => state.title, (title) => {
  if (!slugTouched.value) state.slug = slugify(title)
})
function onSlug(v: string | number) {
  slugTouched.value = !!props.program || v !== ''
  if (v === '' && !props.program) state.slug = slugify(state.title)
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  form.value?.clear('cover')
  const error = !COVER_TYPES.includes(file.type) ? t('programs.err.coverType') : file.size > COVER_MAX ? t('programs.err.coverSize') : undefined
  if (error) return form.value?.setErrors([{ name: 'cover', message: error }])
  try {
    coverFileId.value = await upload(file)
    setPreview(URL.createObjectURL(file))
  } catch (err) {
    // The earlier choice (kept, new or removed) stays as it was
    const c = code(err)
    form.value?.setErrors([{ name: 'cover', message: c === 'upload_mismatch' ? message(err) : t('programs.err.uploadFailed') }])
  }
}

/** Back to "cover untouched": the saved cover, if any, stays */
function resetCover() {
  coverFileId.value = undefined
  setPreview(props.program?.coverUrl ?? null)
}

function removeCover() {
  coverFileId.value = props.program?.coverUrl ? null : undefined
  setPreview(null)
}

/** API field names → form fields, for validation_error and the coded errors */
const FIELD: Record<string, string> = { title: 'title', slug: 'slug', description: 'description', duration_weeks: 'durationWeeks', cover_file_id: 'cover', lead_id: 'leadId' }
const CODE_FIELD: Record<string, string> = { slug_taken: 'slug', no_such_file: 'cover', upload_mismatch: 'cover', cover_invalid: 'cover', user_not_found: 'leadId' }

function showError(e: unknown) {
  const c = code(e)
  const err = apiError(e)
  const fields = c === 'validation_error'
    ? Object.keys(FIELD).flatMap(f => (err.field(f) ? [{ name: FIELD[f]!, message: err.field(f)! }] : []))
    : c && CODE_FIELD[c] ? [{ name: CODE_FIELD[c]!, message: message(e) }] : []
  if (fields.length) form.value?.setErrors(fields)
  else toastError(e)
  if (CODE_FIELD[c ?? ''] === 'cover') resetCover()
  if (c === 'user_not_found') loadPeople()
}

async function onSubmit() {
  const p = props.program
  const leadId = state.leadId === NO_LEAD ? null : state.leadId
  const next: ProgramInput = { title: state.title.trim(), slug: state.slug, description: state.description, durationWeeks: state.durationWeeks! }
  const body: Partial<ProgramInput> = p
    ? Object.fromEntries(Object.entries({
        ...next,
        coverFileId: coverFileId.value,
        leadId: props.canManage && leadId !== (p.lead?.id ?? null) ? leadId : undefined
      }).filter(([k, v]) => v !== undefined && v !== p[k as keyof typeof p]))
    : { ...next, ...(coverFileId.value ? { coverFileId: coverFileId.value } : {}), ...(leadId ? { leadId } : {}) }
  if (p && !Object.keys(body).length) {
    open.value = false // nothing changed: nothing to send
    return
  }
  saving.value = true
  try {
    if (p) {
      await $fetch(`/api/programs/${p.id}`, { method: 'PATCH', body })
      toast.add({ title: t('programs.done.saved'), icon: 'i-lucide-check', color: 'success' })
      invalidatePrograms(`program:${p.id}`)
      emit('saved')
    } else {
      const created = await $fetch('/api/programs', { method: 'POST', body })
      toast.add({ title: t('programs.done.created'), icon: 'i-lucide-check', color: 'success' })
      await navigateTo(`/programs/${created.id}`)
      invalidatePrograms(`program:${created.id}`)
    }
    open.value = false
  } catch (e) {
    showError(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="program ? t('programs.form.editTitle') : t('programs.form.createTitle')" :ui="{ content: 'sm:max-w-xl' }">
    <template #body>
      <UForm id="program-form" ref="form" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField :label="t('programs.form.title')" name="title" required>
          <UInput v-model="state.title" autocomplete="off" class="w-full" />
        </UFormField>
        <UFormField :label="t('programs.form.slug')" name="slug" :help="t('programs.form.slugHelp')" required>
          <UInput v-model="state.slug" autocomplete="off" spellcheck="false" class="w-full font-mono" @update:model-value="onSlug" />
        </UFormField>
        <UFormField :label="t('programs.form.description')" name="description" :help="t('programs.form.descriptionHelp')">
          <UTextarea v-model="state.description" autoresize :rows="3" :maxrows="12" class="w-full" />
          <template v-if="state.description.length >= 4500" #hint>
            <span class="num" :class="state.description.length > 5000 ? 'text-error' : ''">{{ state.description.length }}/5000</span>
          </template>
        </UFormField>
        <UFormField
          :label="t('programs.form.duration')"
          name="durationWeeks"
          :help="state.durationWeeks && months(state.durationWeeks) >= 1 ? t('programs.months', months(state.durationWeeks)) : undefined"
          required
        >
          <UInputNumber v-model="state.durationWeeks" :min="1" :max="104" :step="1" class="w-36" />
        </UFormField>

        <UFormField :label="t('programs.form.cover')" name="cover" :help="t('programs.form.coverHelp')">
          <div class="flex flex-wrap items-center gap-3">
            <ProgramCover v-if="preview" :src="preview" :title="state.title" class="aspect-video w-36 rounded-md ring-1 ring-default" />
            <div class="flex flex-wrap gap-2">
              <input ref="fileInput" type="file" :accept="COVER_TYPES.join(',')" class="sr-only" tabindex="-1" @change="onFile">
              <UButton :label="uploading ? t('programs.form.uploading') : t('programs.form.coverChoose')" :loading="uploading" icon="i-lucide-image-up" color="neutral" variant="outline" size="sm" @click="fileInput?.click()" />
              <UButton v-if="preview && !uploading" :label="t('programs.form.coverRemove')" icon="i-lucide-x" color="neutral" variant="ghost" size="sm" @click="removeCover" />
            </div>
          </div>
        </UFormField>

        <UFormField :label="t('programs.form.lead')" name="leadId">
          <USelectMenu
            v-if="canManage"
            v-model="state.leadId"
            :items="leadItems"
            value-key="value"
            :loading="peopleStatus === 'pending'"
            :search-input="{ placeholder: t('people.search') }"
            class="w-full"
          />
          <p v-else class="text-sm text-highlighted">{{ program?.lead?.name ?? t('programs.form.noLead') }}</p>
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
      <UButton type="submit" form="program-form" :label="t('common.save')" color="primary" :loading="saving" :disabled="uploading" />
    </template>
  </UModal>
</template>
