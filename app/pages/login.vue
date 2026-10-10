<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: 'auth', public: true })

const { t } = useI18n()
const { login, loginWithTelegram } = useAuth()
useHead({ title: () => `${t('auth.title')} · dev.house` })

const schema = computed(() => z.object({
  email: z.string({ error: t('auth.err.emailRequired') }).trim().min(1, t('auth.err.emailRequired')).email(t('auth.err.emailInvalid')),
  password: z.string({ error: t('auth.err.passwordRequired') }).min(1, t('auth.err.passwordRequired'))
}))

const state = reactive({ email: '', password: '' })
const loading = ref<'form' | 'telegram' | null>(null)
const error = ref<string | null>(null)

function messageFor(e: unknown) {
  const code = (e as { statusCode?: number })?.statusCode
  if (code === 401) return t('auth.err.invalid')
  if (code === 404) return t('auth.err.noTelegram')
  return t('auth.err.network')
}

async function onSubmit(e: FormSubmitEvent<{ email: string, password: string }>) {
  error.value = null
  loading.value = 'form'
  try {
    await login(e.data.email, e.data.password)
  } catch (err) {
    error.value = messageFor(err)
  } finally {
    loading.value = null
  }
}

async function onTelegram() {
  error.value = null
  loading.value = 'telegram'
  try {
    await loginWithTelegram()
  } catch (err) {
    error.value = messageFor(err)
  } finally {
    loading.value = null
  }
}

const isDev = import.meta.dev
const demo = [
  { role: 'mentee', email: 'aliya@demo.devhouse.kz' },
  { role: 'mentor', email: 'nurzhan@demo.devhouse.kz' },
  { role: 'head', email: 'head@demo.devhouse.kz' }
] as const
function fillDemo(email: string) {
  state.email = email
  state.password = 'devhouse'
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold tracking-tight text-highlighted">{{ t('auth.title') }}</h1>
    <p class="mt-2 text-sm text-muted">{{ t('auth.subtitle') }}</p>

    <UButton
      class="mt-8"
      block
      size="lg"
      color="neutral"
      variant="outline"
      icon="i-simple-icons-telegram"
      :label="t('auth.telegram')"
      :loading="loading === 'telegram'"
      :disabled="!!loading"
      @click="onTelegram"
    />

    <USeparator class="my-6" :label="t('auth.or')" :ui="{ label: 'text-xs text-dimmed' }" />

    <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
      <UFormField :label="t('auth.email')" name="email">
        <UInput v-model="state.email" type="email" autocomplete="email" inputmode="email" size="lg" class="w-full" />
      </UFormField>
      <UFormField :label="t('auth.password')" name="password">
        <UInput v-model="state.password" type="password" autocomplete="current-password" size="lg" class="w-full" />
      </UFormField>

      <UAlert v-if="error" :description="error" color="error" variant="subtle" icon="i-lucide-circle-alert" role="alert" />

      <UButton type="submit" block size="lg" color="primary" :label="t('auth.submit')" :loading="loading === 'form'" :disabled="!!loading" />
    </UForm>

    <p class="mt-8 text-sm text-muted">
      {{ t('auth.noAccount') }}
      <a href="https://t.me/dev_house_academy" class="text-highlighted underline decoration-dimmed underline-offset-4 hover:decoration-current" target="_blank" rel="noopener noreferrer">{{ t('auth.contact') }}</a>
    </p>

    <div v-if="isDev" class="mt-10 rounded-md p-3 text-xs ring-1 ring-inset ring-default">
      <p class="text-muted">{{ t('auth.demo') }}</p>
      <ul class="mt-2 space-y-1">
        <li v-for="d in demo" :key="d.email">
          <button type="button" class="num cursor-pointer text-left text-toned hover:text-highlighted" @click="fillDemo(d.email)">
            {{ t(`roles.${d.role}`) }} · {{ d.email }}
          </button>
        </li>
      </ul>
      <p class="num mt-2 text-dimmed">{{ t('auth.demoPassword') }}: devhouse</p>
    </div>
  </div>
</template>
