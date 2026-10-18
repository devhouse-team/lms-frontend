<script setup lang="ts">
import type { InvitePublic } from '~~/shared/types'

/** Open invites of both kinds in a rail (People, head home): email, role or "Student · {cohort}", expiry. `actions`: Resend / Revoke */
defineProps<{ invites: InvitePublic[], actions?: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const { left } = useCountdown()
</script>

<template>
  <ul v-if="invites.length" class="mt-3 space-y-3">
    <li v-for="inv in invites" :key="inv.id" class="flex min-w-0 items-start gap-2">
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm text-highlighted">{{ inv.email }}</p>
        <NuxtLink v-if="inv.cohort" :to="`/cohorts/${inv.cohort.id}`" class="block truncate text-xs text-muted underline-offset-4 hover:text-highlighted hover:underline">
          {{ t('invites.studentIn', { cohort: inv.cohort.name }) }}
        </NuxtLink>
        <p v-else-if="inv.role" class="truncate text-xs text-muted">{{ t(`roles.${inv.role}`) }}</p>
        <p class="num mt-0.5 text-xs" :class="inv.status === 'expired' ? 'text-error' : 'text-dimmed'">
          {{ inv.status === 'expired' ? t('head.expired') : t('head.expiresIn', { value: left(inv.expiresAt) }) }}
        </p>
      </div>
      <InviteActions
        v-if="actions"
        :invite="{ id: inv.id, email: inv.email, cohortId: inv.cohort?.id }"
        can-resend
        keep="people"
        @changed="emit('changed')"
      />
    </li>
  </ul>
  <p v-else class="mt-3 text-sm text-muted">{{ t('head.noInvites') }}</p>
</template>
