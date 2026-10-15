<script setup lang="ts">
/** Target of verification emails: /verify-email?token=… (valid 24 hours, once) */
definePageMeta({ layout: 'auth', public: true })

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { loggedIn } = useUserSession()
useHead({
  title: () => `${t('recovery.verifiedTitle')} · dev.house`,
  meta: [{ name: 'referrer', content: 'no-referrer' }]
})

const token = typeof route.query.token === 'string' ? route.query.token : ''
const status = ref<'pending' | 'done' | 'invalid' | 'error'>(token ? 'pending' : 'invalid')

// Client only: link scanners that prefetch the URL during SSR must not use up the token
onMounted(async () => {
  if (route.query.token) router.replace({ query: {} })
  if (!token) return
  try {
    await $fetch('/api/auth/verify', { method: 'POST', body: { token } })
    status.value = 'done'
  } catch (e) {
    const s = apiError(e).status
    status.value = s === 400 || s === 422 ? 'invalid' : 'error'
  }
})
</script>

<template>
  <div>
    <LinkInvalid v-if="status === 'invalid'" :title="t('recovery.invalid.title')" :text="t('recovery.invalid.text')">
      <UButton :to="loggedIn ? '/' : '/login'" :label="t('recovery.continue')" color="primary" />
    </LinkInvalid>

    <div v-else-if="status === 'pending'" class="flex items-center gap-3 text-sm text-muted" role="status">
      <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin" />
      {{ t('recovery.verifying') }}
    </div>

    <template v-else-if="status === 'done'">
      <UIcon name="i-lucide-mail-check" class="size-6 text-success" />
      <h1 class="mt-4 text-2xl font-semibold tracking-tight text-highlighted">{{ t('recovery.verifiedTitle') }}</h1>
      <p class="mt-2 text-sm text-muted">{{ t('recovery.verifiedText') }}</p>
      <UButton class="mt-8" :to="loggedIn ? '/' : '/login'" :label="t('recovery.continue')" color="primary" />
    </template>

    <template v-else>
      <UAlert :description="t('auth.err.network')" color="error" variant="subtle" icon="i-lucide-circle-alert" role="alert" />
      <UButton class="mt-6" :to="loggedIn ? '/' : '/login'" :label="t('recovery.continue')" color="neutral" variant="outline" />
    </template>
  </div>
</template>
