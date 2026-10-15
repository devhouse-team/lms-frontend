<script setup lang="ts">
import { z } from 'zod'

definePageMeta({ layout: 'auth', public: true })

const route = useRoute()
const { t } = useI18n()
useHead({ title: () => `${t('recovery.forgotTitle')} · dev.house` })

const schema = computed(() => z.object({
  email: z.string().trim().min(1, t('recovery.err.email')).email(t('recovery.err.email')).max(254, t('recovery.err.email'))
}))
const state = reactive({ email: typeof route.query.email === 'string' ? route.query.email : '' })
const loading = ref(false)
const error = ref<string | null>(null)
const sentTo = ref<string | null>(null)

async function onSubmit() {
  error.value = null
  loading.value = true
  try {
    await $fetch('/api/auth/forgot', { method: 'POST', body: { email: state.email.trim() } })
    // Same answer whether or not the account exists (no enumeration)
    sentTo.value = state.email.trim()
  } catch (e) {
    error.value = apiError(e).status === 429 ? t('recovery.rateLimited') : t('auth.err.network')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <template v-if="sentTo">
      <UIcon name="i-lucide-mail-check" class="size-6 text-success" />
      <h1 class="mt-4 text-2xl font-semibold tracking-tight text-highlighted">{{ t('recovery.sentTitle') }}</h1>
      <p class="mt-2 text-sm text-muted">{{ t('recovery.sentText', { email: sentTo }) }}</p>
      <p class="mt-2 text-xs text-muted">{{ t('recovery.sentHint') }}</p>
      <UButton class="mt-8" to="/login" :label="t('invite.toLogin')" color="primary" />
    </template>

    <template v-else>
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">{{ t('recovery.forgotTitle') }}</h1>
      <p class="mt-2 text-sm text-muted">{{ t('recovery.forgotSubtitle') }}</p>

      <UForm :schema="schema" :state="state" class="mt-8 space-y-4" @submit="onSubmit">
        <UFormField :label="t('auth.email')" name="email">
          <UInput v-model="state.email" type="email" autocomplete="email" inputmode="email" size="lg" class="w-full" />
        </UFormField>
        <UAlert v-if="error" :description="error" color="error" variant="subtle" icon="i-lucide-circle-alert" role="alert" />
        <UButton type="submit" block size="lg" color="primary" :label="t('recovery.send')" :loading="loading" />
      </UForm>

      <UButton class="mt-6" to="/login" :label="t('invite.toLogin')" color="neutral" variant="link" icon="i-lucide-arrow-left" />
    </template>
  </div>
</template>
