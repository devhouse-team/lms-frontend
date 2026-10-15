<script setup lang="ts">
import { z } from 'zod'

/** Target of the reset email: /reset-password?token=… (valid 1 hour, once) */
definePageMeta({ layout: 'auth', public: true })

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { loggedIn, clear } = useUserSession()
useHead({
  title: () => `${t('recovery.resetTitle')} · dev.house`,
  meta: [{ name: 'referrer', content: 'no-referrer' }]
})

// Keep the token in memory and drop it from the address bar, history and screenshots
const token = typeof route.query.token === 'string' ? route.query.token : ''
onMounted(() => { if (route.query.token) router.replace({ query: {} }) })

const status = ref<'form' | 'done' | 'invalid'>(token ? 'form' : 'invalid')
const schema = computed(() => z.object({
  password: passwordSchema(t),
  confirm: z.string()
}).refine(v => v.password === v.confirm, { message: t('invite.err.confirm'), path: ['confirm'] }))
const state = reactive({ password: '', confirm: '' })
const loading = ref(false)
const error = ref<string | null>(null)
const passwordError = ref<string>()

async function onSubmit() {
  error.value = null
  passwordError.value = undefined
  loading.value = true
  try {
    await $fetch('/api/auth/reset', { method: 'POST', body: { token, password: state.password } })
    // The API revoked every token this user had, so a session on this browser is dead too
    if (loggedIn.value) {
      await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
      await clear()
    }
    status.value = 'done'
  } catch (e) {
    const err = apiError(e)
    if (err.status === 400) status.value = 'invalid'
    // Policy rejection: the link is still good, fix the password and resend
    else if (err.status === 422) passwordError.value = err.field('new_password') ?? err.message ?? t('common.saveError')
    else error.value = err.status === 429 ? t('recovery.rateLimited') : t('auth.err.network')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <LinkInvalid v-if="status === 'invalid'" :title="t('recovery.invalid.title')" :text="t('recovery.invalid.text')">
      <UButton to="/forgot-password" :label="t('recovery.requestNew')" color="primary" />
      <UButton to="/login" :label="t('invite.toLogin')" color="neutral" variant="ghost" />
    </LinkInvalid>

    <template v-else-if="status === 'done'">
      <UIcon name="i-lucide-check" class="size-6 text-success" />
      <h1 class="mt-4 text-2xl font-semibold tracking-tight text-highlighted">{{ t('recovery.doneTitle') }}</h1>
      <p class="mt-2 text-sm text-muted">{{ t('recovery.doneText') }}</p>
      <UButton class="mt-8" to="/login" :label="t('auth.submit')" color="primary" />
    </template>

    <template v-else>
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">{{ t('recovery.resetTitle') }}</h1>
      <p class="mt-2 text-sm text-muted">{{ t('recovery.resetSubtitle') }}</p>

      <UForm :schema="schema" :state="state" class="mt-8 space-y-4" @submit="onSubmit">
        <UFormField :label="t('recovery.newPassword')" name="password" :help="passwordError ? undefined : t('password.rules')" :error="passwordError">
          <UInput v-model="state.password" type="password" autocomplete="new-password" size="lg" class="w-full" />
        </UFormField>
        <UFormField :label="t('invite.confirm')" name="confirm">
          <UInput v-model="state.confirm" type="password" autocomplete="new-password" size="lg" class="w-full" />
        </UFormField>
        <UAlert v-if="error" :description="error" color="error" variant="subtle" icon="i-lucide-circle-alert" role="alert" />
        <UButton type="submit" block size="lg" color="primary" :label="t('recovery.resetSubmit')" :loading="loading" />
      </UForm>
    </template>
  </div>
</template>
