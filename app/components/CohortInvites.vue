<script setup lang="ts">
import type { CohortInvite } from '~~/shared/types'

/**
 * The cohort's open invites (spec invites.md, Invited section): pending and expired, with Resend and Revoke; a finished
 * cohort keeps only Revoke. Hidden while empty: Add students is the way in.
 */
const props = defineProps<{ cohortId: string, finished: boolean }>()
const emit = defineEmits<{ changed: [], stale: [] }>()
const { t, locale } = useI18n()
const { short } = useCohortFormat()
const { left, relative } = useCountdown()

const key = computed(() => `cohort-invites:${props.cohortId}`)
const { data: invites, status, refresh } = useLazyFetch<CohortInvite[]>(() => `/api/cohorts/${props.cohortId}/invites`, { key, default: () => [] })
defineExpose({ refresh })

const absolute = (iso: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
const changed = () => {
  refresh()
  emit('changed')
}
</script>

<template>
  <section v-if="invites.length || status === 'error'" class="space-y-3" aria-labelledby="invited-title">
    <div>
      <h2 id="invited-title" class="text-sm font-semibold text-highlighted">
        {{ t('invites.section') }} <span class="num font-normal text-muted">{{ invites.length }}</span>
      </h2>
      <p class="mt-1 text-xs text-muted">{{ t('invites.sectionHint') }}</p>
    </div>

    <div v-if="status === 'error' && !invites.length" class="flex items-center gap-3 rounded-lg px-4 py-6 text-sm text-muted ring-1 ring-inset ring-default">
      {{ t('invites.loadError') }}
      <UButton :label="t('common.retry')" color="neutral" variant="outline" size="xs" @click="refresh()" />
    </div>
    <div v-else class="overflow-hidden rounded-lg ring-1 ring-inset ring-default">
      <table class="w-full table-fixed text-sm">
        <thead>
          <tr class="border-b border-default text-left text-xs text-muted">
            <th scope="col" class="px-4 py-2 font-medium">{{ t('auth.email') }}</th>
            <th scope="col" class="w-28 px-3 py-2 font-medium">{{ t('invites.col.status') }}</th>
            <th scope="col" class="hidden w-48 px-3 py-2 font-medium sm:table-cell">{{ t('invites.col.expiry') }}</th>
            <th scope="col" class="hidden w-36 px-3 py-2 font-medium md:table-cell">{{ t('invites.col.invited') }}</th>
            <th scope="col" class="w-14 px-3 py-2 sm:w-44"><span class="sr-only">{{ t('invites.col.actions') }}</span></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr v-for="inv in invites" :key="inv.id">
            <td class="truncate px-4 py-2.5 text-highlighted">{{ inv.email }}</td>
            <td class="px-3 py-2.5">
              <UBadge :label="t(`invites.status.${inv.status}`)" :color="inv.status === 'expired' ? 'warning' : 'neutral'" variant="subtle" size="sm" />
            </td>
            <td class="num hidden whitespace-nowrap px-3 py-2.5 text-xs text-muted sm:table-cell">
              <time :datetime="inv.expiresAt" :title="absolute(inv.expiresAt)">
                {{ inv.status === 'expired' ? t('invites.expiredOn', { date: short(inv.expiresAt) }) : t('head.expiresIn', { value: left(inv.expiresAt) }) }}
              </time>
            </td>
            <td class="hidden whitespace-nowrap px-3 py-2.5 text-xs text-muted md:table-cell">
              <time :datetime="inv.createdAt" :title="absolute(inv.createdAt)">{{ relative(inv.createdAt) }}</time>
            </td>
            <td class="px-3 py-2.5">
              <InviteActions
                class="justify-end"
                :invite="{ id: inv.id, email: inv.email, cohortId }"
                :can-resend="!finished"
                inline
                :keep="key"
                @changed="changed"
                @stale="emit('stale')"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
