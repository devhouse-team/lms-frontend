<script setup lang="ts">
/**
 * Resend and Revoke for one open invite (spec invites.md), with the revoke confirm. `inline`: Resend as a button (from
 * `sm`) and Revoke in the row menu (cohort page); otherwise both in the menu (People rail). `keep` is the page's own cache key,
 * refreshed through `changed` instead of cleared. `stale`: the cohort finished meanwhile.
 */
const props = defineProps<{ invite: { id: string, email: string, cohortId?: string }, canResend: boolean, inline?: boolean, keep: string }>()
const emit = defineEmits<{ changed: [], stale: [] }>()
const { t, te } = useI18n()
const toast = useToast()
const busy = ref(false)
const confirming = ref(false)

/** Other views holding this invite: People, head home and the cohort's Invited list */
const invalidate = () => clearNuxtData(k => k !== props.keep
  && (k === 'people' || k === 'dashboard-head' || (!!props.invite.cohortId && k === `cohort-invites:${props.invite.cohortId}`)))

async function run(action: 'resend' | 'revoke') {
  busy.value = true
  try {
    await $fetch(`/api/invites/${props.invite.id}${action === 'resend' ? '/resend' : ''}`, { method: action === 'resend' ? 'POST' : 'DELETE' })
    toast.add({ title: action === 'resend' ? t('invites.resent', { email: props.invite.email }) : t('invites.revoked'), icon: 'i-lucide-check', color: 'success' })
  } catch (e) {
    const code = apiError(e).code ?? ''
    const title = te(`invites.err.${code}`) ? t(`invites.err.${code}`, { email: props.invite.email })
      : te(`cohorts.err.${code}`) ? t(`cohorts.err.${code}`) : t('common.saveError')
    toast.add({ title, color: 'error', icon: 'i-lucide-circle-alert' })
    if (code === 'cohort_finished') emit('stale')
  } finally {
    busy.value = false
    confirming.value = false
    invalidate()
    emit('changed') // success or not, show the server's state
  }
}

const menu = computed(() => [[
  // Inline Resend is a button from `sm`; on phones it sits in the menu
  ...(props.canResend ? [{ label: t('invites.resend'), icon: 'i-lucide-send', class: props.inline ? 'sm:hidden' : undefined, onSelect: () => run('resend') }] : []),
  { label: t('invites.revoke'), icon: 'i-lucide-x', color: 'error' as const, onSelect: () => { confirming.value = true } }
]])
</script>

<template>
  <div class="flex shrink-0 items-center gap-1">
    <UButton v-if="inline && canResend" :label="t('invites.resend')" color="neutral" variant="ghost" size="xs" :loading="busy" class="max-sm:hidden" @click="run('resend')" />
    <UDropdownMenu :items="menu" :content="{ align: 'end' }">
      <UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" size="xs" :loading="busy && !inline" :aria-label="t('invites.actionsFor', { email: invite.email })" />
    </UDropdownMenu>
    <UModal v-model:open="confirming" :title="t('invites.revokeTitle')">
      <template #body>
        <p class="text-sm text-default">{{ t('invites.revokeConfirm', { email: invite.email }) }}</p>
      </template>
      <template #footer>
        <UButton :label="t('invites.keep')" color="neutral" variant="ghost" @click="confirming = false" />
        <UButton :label="t('invites.revoke')" color="error" :loading="busy" @click="run('revoke')" />
      </template>
    </UModal>
  </div>
</template>
