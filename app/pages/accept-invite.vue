<script setup lang="ts">
import { z } from 'zod'
import type { InvitePreview } from '~~/shared/types'

/**
 * Target of the invite email: /accept-invite?token=… (spec invites.md). First the public preview (the cohort, or the
 * role; the invited email; expiry), then the form. A cohort invite lands on the cohort's courses.
 */
definePageMeta({ layout: 'auth', public: true })

const route = useRoute()
const { t, locale } = useI18n()
const toast = useToast()
const { long } = useCohortFormat()
const { afterLogin } = useAuth()
useHead({ title: () => `${t('invite.title')} · dev.house` })

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))

// The token never reaches the SSR payload: client-only fetch, cleared on leaving
const { data: preview, status, error, refresh } = useLazyFetch<InvitePreview>('/api/invites/preview', {
  key: 'invite-preview', query: { token }, server: false, immediate: !!token.value
})
onBeforeUnmount(() => clearNuxtData('invite-preview'))

/** Set by accept when the link turns out unusable after the preview */
const acceptProblem = ref<'invalid' | 'finished' | null>(null)
const problem = computed(() => {
  if (!token.value || acceptProblem.value === 'invalid') return 'invalid'
  if (acceptProblem.value === 'finished' || preview.value?.cohort?.status === 'finished') return 'finished'
  const code = apiError(error.value).code
  if (code === 'invite_not_found') return 'invalid'
  if (code === 'rate_limited' || error.value?.statusCode === 429) return 'rate'
  if (error.value) return 'load'
  return null
})
const loading = computed(() => !problem.value && !preview.value)

const cohort = computed(() => preview.value?.cohort ?? null)
const started = computed(() => !!cohort.value && cohort.value.startsOn <= todayUtc())
const until = computed(() => preview.value
  ? new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(preview.value.expiresAt))
  : '')

const schema = computed(() => z.object({
  name: z.string().trim().min(2, t('invite.err.name')).max(80, t('invite.err.name')),
  username: z.string().trim().regex(/^[a-z0-9_]{2,32}$/, t('invite.err.username')),
  password: passwordSchema(t),
  confirm: z.string()
}).refine(v => v.password === v.confirm, { message: t('invite.err.confirm'), path: ['confirm'] }))

const state = reactive({ name: '', username: '', password: '', confirm: '' })
const sending = ref(false)
const submitError = ref<string | null>(null)
const accountExists = ref(false)
const fieldErrors = ref<Partial<Record<'name' | 'username' | 'password', string>>>({})

async function onSubmit() {
  submitError.value = null
  accountExists.value = false
  fieldErrors.value = {}
  sending.value = true
  try {
    const res = await $fetch('/api/invites/accept', {
      method: 'POST',
      body: { token: token.value, name: state.name.trim(), username: state.username.trim(), password: state.password }
    })
    if (res.cohortId && cohort.value) {
      const name = cohort.value.name
      await afterLogin('/courses')
      toast.add({ title: t('invite.welcomeCohort', { cohort: name }), icon: 'i-lucide-party-popper', color: 'success' })
    } else {
      await afterLogin()
    }
  } catch (e) {
    const err = apiError(e)
    if (err.code === 'invite_invalid') acceptProblem.value = err.reason === 'cohort_finished' ? 'finished' : 'invalid'
    else if (err.code === 'user_exists') accountExists.value = true
    else if (err.code === 'rate_limited') submitError.value = t('invite.problem.rate.text')
    else if (err.code === 'validation_error') {
      fieldErrors.value = { name: err.field('name'), username: err.field('username'), password: err.field('password') }
      if (!Object.values(fieldErrors.value).some(Boolean)) submitError.value = err.message ?? t('common.saveError')
    } else submitError.value = t('auth.err.network')
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div>
    <div v-if="loading" class="space-y-4" aria-busy="true">
      <USkeleton class="h-8 w-3/4" />
      <USkeleton class="h-4 w-1/2" />
      <USkeleton class="h-4 w-2/3" />
      <USkeleton class="mt-8 h-10 w-full" />
      <USkeleton class="h-10 w-full" />
    </div>

    <template v-else-if="problem === 'invalid'">
      <UIcon name="i-lucide-link-2-off" class="size-6 text-muted" />
      <h1 class="mt-4 text-2xl font-semibold tracking-tight text-highlighted">{{ t('invite.problem.invalid.title') }}</h1>
      <p class="mt-2 text-sm text-muted">{{ t('invite.problem.invalid.text') }}</p>
      <div class="mt-8 flex flex-wrap gap-2">
        <UButton to="/login" :label="t('invite.toLogin')" color="primary" />
        <UButton href="https://t.me/dev_house_academy" target="_blank" :label="t('auth.contactCta')" color="neutral" variant="ghost" />
      </div>
    </template>

    <template v-else-if="problem === 'finished'">
      <UIcon name="i-lucide-calendar-x" class="size-6 text-muted" />
      <h1 class="mt-4 text-2xl font-semibold tracking-tight text-balance text-highlighted">{{ t('invite.problem.finished.title', { cohort: cohort?.name ?? '' }) }}</h1>
      <p class="mt-2 text-sm text-muted">{{ t('invite.problem.finished.text') }}</p>
      <div class="mt-8 flex flex-wrap gap-2">
        <UButton href="https://t.me/dev_house_academy" target="_blank" :label="t('auth.contactCta')" color="primary" />
        <UButton to="/login" :label="t('invite.toLogin')" color="neutral" variant="ghost" />
      </div>
    </template>

    <template v-else-if="problem === 'rate' || problem === 'load'">
      <UIcon name="i-lucide-circle-alert" class="size-6 text-muted" />
      <h1 class="mt-4 text-2xl font-semibold tracking-tight text-highlighted">{{ problem === 'rate' ? t('invite.problem.rate.title') : t('invite.problem.load.title') }}</h1>
      <p class="mt-2 text-sm text-muted">{{ problem === 'rate' ? t('invite.problem.rate.text') : t('invite.problem.load.text') }}</p>
      <UButton :label="t('common.retry')" icon="i-lucide-rotate-ccw" color="neutral" variant="outline" class="mt-8" :loading="status === 'pending'" @click="refresh()" />
    </template>

    <template v-else-if="preview">
      <header class="space-y-1.5">
        <h1 class="text-2xl font-semibold tracking-tight text-balance text-highlighted">
          {{ cohort ? t('invite.joining', { cohort: cohort.name }) : t('invite.title') }}
        </h1>
        <p v-if="cohort" class="text-sm text-default">
          {{ t(started ? 'invite.startedOn' : 'invite.startsOn', { program: cohort.programTitle, date: long(cohort.startsOn) }) }}
        </p>
        <p v-else-if="preview.role" class="text-sm text-default">{{ t('invite.asRole', { role: t(`roles.${preview.role}`).toLowerCase() }) }}</p>
        <p class="pt-2 text-sm text-muted">{{ t('invite.forEmail', { email: preview.email }) }}</p>
        <p class="num text-xs text-muted">{{ t('invite.validUntil', { date: until }) }}</p>
      </header>

      <UForm :schema="schema" :state="state" class="mt-8 space-y-4" @submit="onSubmit">
        <UFormField :label="t('invite.name')" name="name" :hint="t('invite.nameHint')" :error="fieldErrors.name">
          <UInput v-model="state.name" autocomplete="name" size="lg" class="w-full" />
        </UFormField>
        <UFormField :label="t('invite.username')" name="username" :hint="t('invite.usernameHint')" :error="fieldErrors.username">
          <UInput v-model="state.username" autocomplete="username" autocapitalize="none" spellcheck="false" size="lg" class="w-full" />
        </UFormField>
        <UFormField :label="t('auth.password')" name="password" :help="fieldErrors.password ? undefined : t('password.rules')" :error="fieldErrors.password">
          <UInput v-model="state.password" type="password" autocomplete="new-password" size="lg" class="w-full" />
        </UFormField>
        <UFormField :label="t('invite.confirm')" name="confirm">
          <UInput v-model="state.confirm" type="password" autocomplete="new-password" size="lg" class="w-full" />
        </UFormField>

        <UAlert v-if="accountExists" color="error" variant="subtle" icon="i-lucide-circle-alert" role="alert">
          <template #description>
            {{ t('invite.err.userExists', { email: preview.email }) }}
            <NuxtLink to="/login" class="font-medium underline underline-offset-4">{{ t('invite.toLogin') }}</NuxtLink>
          </template>
        </UAlert>
        <UAlert v-if="submitError" :description="submitError" color="error" variant="subtle" icon="i-lucide-circle-alert" role="alert" />

        <UButton type="submit" block size="lg" color="primary" :label="cohort ? t('invite.submitCohort') : t('invite.submit')" :loading="sending" />
      </UForm>
    </template>
  </div>
</template>
