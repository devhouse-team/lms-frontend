<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: 'auth', public: true })

const { t } = useI18n()
const { login } = useAuth()
const route = useRoute()
useHead({ title: () => `${t('auth.title')} · dev.house` })

const schema = computed(() => z.object({
  login: z.string({ error: t('auth.err.loginRequired') }).trim().min(1, t('auth.err.loginRequired')),
  password: z.string({ error: t('auth.err.passwordRequired') }).min(1, t('auth.err.passwordRequired'))
}))

const state = reactive({ login: '', password: '' })
const loading = ref(false)
const error = ref<string | null>(route.query.expired ? t('auth.sessionExpired') : null)

function messageFor(e: unknown) {
  const code = (e as { statusCode?: number })?.statusCode
  if (code === 401 || code === 400) return t('auth.err.invalid')
  if (code === 429) return t('auth.err.rateLimited')
  return t('auth.err.network')
}

// Carry an email over to the reset form; a username isn't something the reset flow can use
const forgotLink = computed(() => ({ path: '/forgot-password', query: state.login.includes('@') ? { email: state.login.trim() } : {} }))

async function onSubmit(e: FormSubmitEvent<{ login: string, password: string }>) {
  error.value = null
  loading.value = true
  try {
    await login(e.data.login, e.data.password)
  } catch (err) {
    error.value = messageFor(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold tracking-tight text-highlighted">{{ t('auth.title') }}</h1>
    <p class="mt-2 text-sm text-muted">{{ t('auth.subtitle') }}</p>

    <UForm :schema="schema" :state="state" class="mt-8 space-y-4" @submit="onSubmit">
      <UFormField :label="t('auth.login')" name="login">
        <UInput v-model="state.login" autocomplete="username" autocapitalize="none" spellcheck="false" size="lg" class="w-full" />
      </UFormField>
      <UFormField :label="t('auth.password')" name="password">
        <UInput v-model="state.password" type="password" autocomplete="current-password" size="lg" class="w-full" />
        <template #hint>
          <NuxtLink :to="forgotLink" class="text-muted underline-offset-4 hover:text-highlighted hover:underline">{{ t('recovery.forgotLink') }}</NuxtLink>
        </template>
      </UFormField>

      <UAlert v-if="error" :description="error" color="error" variant="subtle" icon="i-lucide-circle-alert" role="alert" />

      <UButton type="submit" block size="lg" color="primary" :label="t('auth.submit')" :loading="loading" />
    </UForm>

    <p class="mt-8 text-sm text-muted">
      {{ t('auth.noAccount') }}
      <a href="https://t.me/dev_house_academy" class="text-highlighted underline decoration-dimmed underline-offset-4 hover:decoration-current" target="_blank" rel="noopener noreferrer">{{ t('auth.contact') }}</a>
    </p>
  </div>
</template>
