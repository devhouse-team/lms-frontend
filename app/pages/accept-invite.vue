<script setup lang="ts">
import { z } from 'zod'

/** Target of the invite email: /accept-invite?token=… */
definePageMeta({ layout: 'auth', public: true })

const route = useRoute()
const { t } = useI18n()
const { afterLogin } = useAuth()
useHead({ title: () => `${t('invite.title')} · dev.house` })

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const invalid = ref(!token.value)

const schema = computed(() => z.object({
  name: z.string().trim().min(2, t('invite.err.name')).max(80, t('invite.err.name')),
  username: z.string().trim().regex(/^[A-Za-z0-9._-]{2,40}$/, t('invite.err.username')),
  password: z.string().min(8, t('invite.err.password')).max(128, t('invite.err.password')),
  confirm: z.string()
}).refine(v => v.password === v.confirm, { message: t('invite.err.confirm'), path: ['confirm'] }))

const state = reactive({ name: '', username: '', password: '', confirm: '' })
const loading = ref(false)
const submitError = ref<string | null>(null)

async function onSubmit() {
  submitError.value = null
  loading.value = true
  try {
    await $fetch('/api/invites/accept', {
      method: 'POST',
      body: { token: token.value, name: state.name.trim(), username: state.username.trim(), password: state.password }
    })
    await afterLogin()
  } catch (e) {
    const err = e as { statusCode?: number, data?: { statusMessage?: string, message?: string } }
    const code = err.data?.statusMessage
    if (code === 'invite_invalid') invalid.value = true
    // Password policy and field errors come back as 422 with an English explanation
    else if (err.statusCode === 422) submitError.value = err.data?.message ?? t('common.saveError')
    else if (err.statusCode === 409) submitError.value = t('invite.taken')
    else submitError.value = t('auth.err.network')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <template v-if="invalid">
      <UIcon name="i-lucide-link-2-off" class="size-6 text-muted" />
      <h1 class="mt-4 text-2xl font-semibold tracking-tight text-highlighted">{{ t('invite.problem.invalid.title') }}</h1>
      <p class="mt-2 text-sm text-muted">{{ t('invite.problem.invalid.text') }}</p>
      <div class="mt-8 flex flex-wrap gap-2">
        <UButton to="/login" :label="t('invite.toLogin')" color="primary" />
        <UButton href="https://t.me/dev_house_academy" target="_blank" :label="t('auth.contactCta')" color="neutral" variant="ghost" />
      </div>
    </template>

    <template v-else>
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted">{{ t('invite.title') }}</h1>
      <p class="mt-2 text-sm text-muted">{{ t('invite.subtitle') }}</p>

      <UForm :schema="schema" :state="state" class="mt-8 space-y-4" @submit="onSubmit">
        <UFormField :label="t('invite.name')" name="name" :hint="t('invite.nameHint')">
          <UInput v-model="state.name" autocomplete="name" size="lg" class="w-full" />
        </UFormField>
        <UFormField :label="t('invite.username')" name="username" :hint="t('invite.usernameHint')">
          <UInput v-model="state.username" autocomplete="username" autocapitalize="none" spellcheck="false" size="lg" class="w-full" />
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
