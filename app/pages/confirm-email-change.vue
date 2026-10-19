<script setup lang="ts">
/**
 * Target of the change-email email: /confirm-email-change?token=… (spec profile.md). Client-only page (route rule): the
 * token is read after mount, so link scanners can't use it up, and dropped from the URL at once.
 */
definePageMeta({ layout: 'auth', public: true })

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { loggedIn, fetch: refreshSession } = useUserSession()
useHead({
  title: () => `${t('recovery.emailChange.title')} · dev.house`,
  meta: [{ name: 'referrer', content: 'no-referrer' }]
})

const token = ref('')
const state = ref<'pending' | 'done' | 'invalid' | 'taken' | 'error'>('pending')
const email = ref<string>()

async function confirm() {
  state.value = 'pending'
  try {
    const res = await $fetch('/api/auth/email-change', { method: 'POST', body: { token: token.value } })
    email.value = res.email
    if (res.email) {
      await refreshSession()
      clearNuxtData('me')
    }
    state.value = 'done'
  } catch (e) {
    const err = apiError(e)
    state.value = err.status === 400 ? 'invalid' : err.status === 409 || err.status === 422 ? 'taken' : 'error'
  }
}

onMounted(() => {
  token.value = typeof route.query.token === 'string' ? route.query.token : ''
  if (route.query.token) router.replace({ query: {} })
  if (!token.value) state.value = 'invalid'
  else confirm()
})
const next = computed(() => (loggedIn.value ? { to: '/me', label: t('recovery.toProfile') } : { to: '/login', label: t('invite.toLogin') }))
</script>

<template>
  <div>
    <div v-if="state === 'pending'" class="flex items-center gap-3 text-sm text-muted" role="status">
      <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin" />
      {{ t('recovery.emailChange.pending') }}
    </div>

    <LinkInvalid v-else-if="state === 'invalid'" :title="t('recovery.invalid.title')" :text="t('recovery.emailChange.invalid')">
      <UButton :to="next.to" :label="next.label" color="primary" />
    </LinkInvalid>

    <template v-else-if="state === 'taken'">
      <UIcon name="i-lucide-mail-x" class="size-6 text-muted" />
      <h1 class="mt-4 text-2xl font-semibold tracking-tight text-highlighted">{{ t('recovery.emailChange.title') }}</h1>
      <p class="mt-2 text-sm text-muted" role="alert">{{ t('recovery.emailChange.taken') }}</p>
      <UButton class="mt-8" :to="next.to" :label="next.label" color="primary" />
    </template>

    <template v-else-if="state === 'done'">
      <div role="status">
        <UIcon name="i-lucide-mail-check" class="size-6 text-success" />
        <h1 class="mt-4 text-2xl font-semibold tracking-tight text-highlighted">{{ t('recovery.emailChange.done') }}</h1>
        <p v-if="email" class="mt-2 text-sm text-muted">{{ t('recovery.emailChange.doneTo', { email }) }}</p>
      </div>
      <UButton class="mt-8" :to="next.to" :label="next.label" color="primary" />
    </template>

    <template v-else>
      <UAlert :description="t('auth.err.network')" color="error" variant="subtle" icon="i-lucide-circle-alert" role="alert" />
      <div class="mt-6 flex flex-wrap gap-2">
        <UButton :label="t('common.retry')" icon="i-lucide-rotate-ccw" color="neutral" variant="outline" @click="confirm" />
        <UButton :to="next.to" :label="next.label" color="neutral" variant="ghost" />
      </div>
    </template>
  </div>
</template>
