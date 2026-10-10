<script setup lang="ts">
import { z } from 'zod'
import type { InvitePublic } from '~~/shared/types'

definePageMeta({ layout: 'auth', public: true })

const route = useRoute()
const { t, locale } = useI18n()
const { afterLogin } = useAuth()
const token = computed(() => String(route.params.token))

const { data: invite, error, status } = await useFetch<InvitePublic>(() => `/api/invites/${token.value}`)
useHead({ title: () => `${t('invite.title')} · dev.house` })

const problem = computed<'missing' | 'used' | 'expired' | null>(() => {
  const code = error.value?.statusCode
  if (code === 404) return 'missing'
  if (code === 410) return 'used'
  if (invite.value?.expired) return 'expired'
  return null
})

const schema = computed(() => z.object({
  name: z.string().trim().min(2, t('invite.err.name')).max(80, t('invite.err.name')),
  password: z.string().min(8, t('invite.err.password')),
  confirm: z.string()
}).refine(v => v.password === v.confirm, { message: t('invite.err.confirm'), path: ['confirm'] }))

const state = reactive({ name: '', password: '', confirm: '' })
const loading = ref(false)
const submitError = ref<string | null>(null)

async function onSubmit() {
  submitError.value = null
  loading.value = true
  try {
    await $fetch(`/api/invites/${token.value}/accept`, { method: 'POST', body: { name: state.name, password: state.password } })
    await afterLogin()
  } catch (e) {
    const code = (e as { statusCode?: number })?.statusCode
    submitError.value = code === 410 ? t('invite.used') : t('auth.err.network')
  } finally {
    loading.value = false
  }
}

const expiry = computed(() => invite.value
  ? new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(invite.value.expiresAt))
  : '')
</script>

<template>
  <div>
    <template v-if="status === 'pending'">
      <USkeleton class="h-8 w-48" />
      <USkeleton class="mt-4 h-24 w-full" />
    </template>

    <template v-else-if="problem">
      <UIcon name="i-lucide-link-2-off" class="size-6 text-muted" />
      <h1 class="mt-4 text-2xl font-semibold tracking-tight text-highlighted">{{ t(`invite.problem.${problem}.title`) }}</h1>
      <p class="mt-2 text-sm text-muted">{{ t(`invite.problem.${problem}.text`) }}</p>
      <div class="mt-8 flex flex-wrap gap-2">
        <UButton href="https://t.me/dev_house_academy" target="_blank" :label="t('auth.contactCta')" color="primary" />
        <UButton to="/login" :label="t('invite.toLogin')" color="neutral" variant="ghost" />
      </div>
    </template>

    <template v-else-if="invite">
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">{{ t('invite.title') }}</h1>
      <p class="mt-2 text-sm text-muted">{{ t('invite.subtitle', { by: invite.invitedBy }) }}</p>

      <dl class="mt-6 divide-y divide-default rounded-md text-sm ring-1 ring-inset ring-default">
        <div class="flex justify-between gap-4 px-3 py-2">
          <dt class="text-muted">{{ t('invite.role') }}</dt>
          <dd class="text-highlighted">{{ t(`roles.${invite.role}`) }}</dd>
        </div>
        <div v-if="invite.programTitle" class="flex justify-between gap-4 px-3 py-2">
          <dt class="text-muted">{{ t('invite.program') }}</dt>
          <dd class="text-right text-highlighted">{{ invite.programTitle }}<span v-if="invite.cohortName" class="num"> · {{ invite.cohortName }}</span></dd>
        </div>
        <div class="flex justify-between gap-4 px-3 py-2">
          <dt class="text-muted">{{ t('auth.email') }}</dt>
          <dd class="num truncate text-highlighted">{{ invite.email }}</dd>
        </div>
      </dl>
      <p class="num mt-2 text-xs text-dimmed">{{ t('invite.validUntil', { date: expiry }) }}</p>

      <UForm :schema="schema" :state="state" class="mt-8 space-y-4" @submit="onSubmit">
        <UFormField :label="t('invite.name')" name="name" :hint="t('invite.nameHint')">
          <UInput v-model="state.name" autocomplete="name" size="lg" class="w-full" />
        </UFormField>
        <UFormField :label="t('auth.password')" name="password" :help="t('invite.passwordHelp')">
          <UInput v-model="state.password" type="password" autocomplete="new-password" size="lg" class="w-full" />
        </UFormField>
        <UFormField :label="t('invite.confirm')" name="confirm">
          <UInput v-model="state.confirm" type="password" autocomplete="new-password" size="lg" class="w-full" />
        </UFormField>

        <UAlert v-if="submitError" :description="submitError" color="error" variant="subtle" icon="i-lucide-circle-alert" role="alert" />

        <UButton type="submit" block size="lg" color="primary" :label="t('invite.submit')" :loading="loading" />
      </UForm>
    </template>
  </div>
</template>
