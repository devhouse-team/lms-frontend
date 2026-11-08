<script setup lang="ts">
// The only page an overdue student can open (middleware auth.global.ts); spec payments.md
definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const { user, logout, switchRole } = useAuth()
const { fetch: refreshSession } = useUserSession()
const { date } = usePaymentFormat()
useHead({ title: () => `${t('payment.requiredTitle')} · dev.house` })

const others = computed(() => (user.value?.roles ?? []).filter(r => r !== 'mentee'))
const checking = ref(false)

/** Paid since? Reload the user; the middleware sends a cleared student home */
async function check() {
  checking.value = true
  try {
    await refreshSession()
    await navigateTo('/')
  } finally {
    checking.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <div class="space-y-2">
      <UIcon name="i-lucide-lock" class="size-6 text-error" />
      <h1 class="text-xl font-semibold tracking-tight text-highlighted">{{ t('payment.requiredTitle') }}</h1>
      <p v-if="user?.billing?.nextDueOn" class="text-sm text-default">{{ t('payment.requiredText', { date: date(user.billing.nextDueOn) }) }}</p>
      <p class="text-sm text-muted">{{ t('payment.requiredContact') }}</p>
    </div>
    <div class="flex flex-col gap-2">
      <UButton :label="t('payment.requiredRetry')" icon="i-lucide-rotate-cw" color="primary" block :loading="checking" @click="check" />
      <UButton
        v-for="r in others"
        :key="r"
        :label="t('payment.requiredOther', { role: t(`roles.${r}`) })"
        color="neutral"
        variant="outline"
        block
        @click="switchRole(r)"
      />
      <UButton :label="t('auth.logout')" icon="i-lucide-log-out" color="neutral" variant="ghost" block @click="logout()" />
    </div>
  </div>
</template>
