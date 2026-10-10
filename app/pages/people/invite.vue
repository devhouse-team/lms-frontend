<script setup lang="ts">
import { z } from 'zod'
import type { CohortOption, InvitePublic, ProgramSlug } from '~~/shared/types'

definePageMeta({ roles: ['head'] })

const { t, locale } = useI18n()
const toast = useToast()
useHead({ title: () => `${t('inviteForm.title')} · dev.house` })

const { data: cohorts } = await useFetch<CohortOption[]>('/api/cohorts/options', { default: () => [] })

const programs: { value: ProgramSlug, label: string }[] = [
  { value: 'frontend', label: 'Frontend Development' },
  { value: 'backend', label: 'Backend Development' },
  { value: 'mobile', label: 'Mobile Development' },
  { value: 'ml', label: 'Machine Learning' },
  { value: 'algorithms', label: 'Algorithms & Data Structures' }
]

const roleItems = computed(() => [
  { value: 'mentee', label: t('roles.mentee'), description: t('inviteForm.menteeHint') },
  { value: 'mentor', label: t('roles.mentor'), description: t('inviteForm.mentorHint') }
])
const cohortItems = computed(() => (cohorts.value ?? []).map(c => ({ value: c.id, label: `${c.name} · ${c.programTitle}` })))

const schema = computed(() => z.object({
  email: z.string().trim().min(1, t('auth.err.emailRequired')).email(t('auth.err.emailInvalid')),
  role: z.enum(['mentee', 'mentor']),
  cohortId: z.string().optional(),
  program: z.string().optional()
}).refine(v => v.role !== 'mentee' || !!v.cohortId, { message: t('inviteForm.err.cohort'), path: ['cohortId'] }))

const state = reactive<{ email: string, role: 'mentee' | 'mentor', cohortId?: string, program?: ProgramSlug }>({ email: '', role: 'mentee' })
const sending = ref(false)
const created = ref<InvitePublic | null>(null)
const link = computed(() => created.value && import.meta.client ? `${window.location.origin}/invite/${created.value.token}` : '')

async function onSubmit() {
  sending.value = true
  try {
    created.value = await $fetch<InvitePublic>('/api/invites', {
      method: 'POST',
      body: { email: state.email.trim(), role: state.role, cohortId: state.role === 'mentee' ? state.cohortId : undefined, program: state.role === 'mentor' ? state.program : undefined }
    })
    clearNuxtData(['dashboard-head', 'people'])
  } catch (e) {
    const err = e as { statusCode?: number, statusMessage?: string, data?: { statusMessage?: string } }
    const msg = err.data?.statusMessage ?? err.statusMessage
    toast.add({
      title: err.statusCode === 409 ? (msg === 'User exists' ? t('inviteForm.err.userExists') : t('inviteForm.err.pending')) : t('common.saveError'),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    sending.value = false
  }
}

async function copy() {
  try {
    await navigator.clipboard.writeText(link.value)
    toast.add({ title: t('head.linkCopied'), icon: 'i-lucide-link', color: 'neutral' })
  } catch {
    toast.add({ title: t('head.copyFailed'), description: link.value, color: 'error' })
  }
}

function another() {
  created.value = null
  state.email = ''
}

const expiry = computed(() => created.value
  ? new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(created.value.expiresAt))
  : '')
</script>

<template>
  <AppPage :title="t('inviteForm.title')" back="/people">
    <div class="mx-auto w-full max-w-xl">
      <template v-if="created">
        <UIcon name="i-lucide-mail-check" class="size-6 text-success" />
        <h1 class="mt-3 text-xl font-semibold tracking-tight text-highlighted">{{ t('inviteForm.createdTitle') }}</h1>
        <p class="mt-1 text-sm text-muted">{{ t('inviteForm.createdText', { email: created.email, date: expiry }) }}</p>

        <div class="mt-6 flex items-center gap-2 rounded-lg p-1 pl-3 ring-1 ring-inset ring-default">
          <span class="num min-w-0 flex-1 truncate text-sm text-highlighted">{{ link }}</span>
          <UButton :label="t('inviteForm.copy')" icon="i-lucide-copy" color="primary" @click="copy" />
        </div>
        <p class="mt-2 text-xs text-muted">{{ t('inviteForm.sendHint') }}</p>

        <div class="mt-8 flex flex-wrap gap-2">
          <UButton :label="t('inviteForm.another')" icon="i-lucide-user-plus" color="neutral" variant="outline" @click="another" />
          <UButton to="/people" :label="t('inviteForm.toPeople')" color="neutral" variant="ghost" />
        </div>
      </template>

      <template v-else>
        <h1 class="text-xl font-semibold tracking-tight text-highlighted">{{ t('inviteForm.title') }}</h1>
        <p class="mt-1 text-sm text-muted">{{ t('inviteForm.subtitle') }}</p>

        <UForm :schema="schema" :state="state" class="mt-8 space-y-5" @submit="onSubmit">
          <UFormField :label="t('auth.email')" name="email">
            <UInput v-model="state.email" type="email" autocomplete="off" inputmode="email" size="lg" class="w-full" />
          </UFormField>

          <UFormField :label="t('invite.role')" name="role">
            <URadioGroup v-model="state.role" :items="roleItems" variant="table" />
          </UFormField>

          <UFormField v-if="state.role === 'mentee'" :label="t('inviteForm.cohort')" name="cohortId">
            <USelect v-model="state.cohortId" :items="cohortItems" :placeholder="t('inviteForm.cohortPlaceholder')" size="lg" class="w-full" />
          </UFormField>
          <UFormField v-else :label="t('invite.program')" name="program" :hint="t('common.optional')">
            <USelect v-model="state.program" :items="programs" :placeholder="t('inviteForm.programPlaceholder')" size="lg" class="w-full" />
          </UFormField>

          <UButton type="submit" :label="t('inviteForm.submit')" icon="i-lucide-send" color="primary" size="lg" :loading="sending" />
        </UForm>
      </template>
    </div>
  </AppPage>
</template>
