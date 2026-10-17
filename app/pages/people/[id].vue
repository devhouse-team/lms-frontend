<script setup lang="ts">
import type { EnrollmentStatus, PersonDetail } from '~~/shared/types'

definePageMeta({ roles: ['head'], headScope: 'all' })

const { t, locale } = useI18n()
const route = useRoute()
const { data, status, error, refresh } = await useFetch<PersonDetail>(() => `/api/people/${route.params.id}`, { key: `person-${route.params.id}` })
useHead({ title: () => `${data.value?.name ?? t('nav.people')} · dev.house` })

const notFound = computed(() => error.value?.statusCode === 404)
const date = (iso: string) => new Date(iso).toLocaleDateString(locale.value, { dateStyle: 'medium' })

const statusColor: Record<EnrollmentStatus, 'primary' | 'neutral' | 'success' | 'error'> = {
  active: 'primary', paused: 'neutral', completed: 'success', dropped: 'error'
}
</script>

<template>
  <AppPage :title="data?.name ?? t('nav.people')" back="/people">
    <UEmpty v-if="notFound" icon="i-lucide-user-x" :title="t('person.notFound')" :description="t('person.notFoundText')" :actions="[{ label: t('person.back'), to: '/people', color: 'neutral', variant: 'outline' }]" />
    <HomeState v-else :status="status" :has-data="!!data" @retry="refresh()">
      <div v-if="data" class="mx-auto w-full max-w-3xl space-y-8">
        <header class="flex items-center gap-4">
          <UAvatar :src="data.avatar" :alt="data.name" size="3xl" />
          <div class="min-w-0">
            <h2 class="truncate text-xl font-semibold text-highlighted">{{ data.name }}</h2>
            <p class="num truncate text-sm text-muted">{{ data.email }} · @{{ data.username }}</p>
            <div class="mt-2 flex flex-wrap gap-2">
              <UBadge :label="data.role ? t(`roles.${data.role}`) : t('people.noRole')" :color="data.role ? 'primary' : 'neutral'" variant="subtle" size="sm" />
              <UBadge v-if="data.isSuperuser" :label="t('person.admin')" color="neutral" variant="outline" size="sm" icon="i-lucide-shield" />
              <UBadge
                :label="data.emailVerified ? t('person.verified') : t('person.unverified')"
                :icon="data.emailVerified ? 'i-lucide-check' : 'i-lucide-mail-warning'"
                :color="data.emailVerified ? 'success' : 'neutral'"
                variant="subtle"
                size="sm"
              />
            </div>
          </div>
        </header>

        <section aria-labelledby="enr-title">
          <h3 id="enr-title" class="mb-3 text-sm font-semibold text-highlighted">{{ t('person.asStudent') }}</h3>
          <div v-if="data.enrollments.length" class="overflow-hidden rounded-lg ring-1 ring-inset ring-default">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-default text-left text-xs text-muted">
                  <th scope="col" class="px-4 py-2 font-medium">{{ t('person.cohort') }}</th>
                  <th scope="col" class="px-3 py-2 font-medium">{{ t('person.status') }}</th>
                  <th scope="col" class="hidden px-3 py-2 font-medium sm:table-cell">{{ t('person.since') }}</th>
                  <th scope="col" class="hidden px-4 py-2 font-medium sm:table-cell">{{ t('person.mentor') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr v-for="e in data.enrollments" :key="e.cohortId" class="transition-colors hover:bg-elevated/60">
                  <td class="max-w-0 px-4 py-2.5">
                    <NuxtLink :to="`/cohorts/${e.cohortId}`" class="num block truncate text-highlighted hover:underline" :title="e.cohortName">{{ e.cohortName }}</NuxtLink>
                    <p v-if="e.programTitle" class="truncate text-xs text-muted">{{ e.programTitle }}</p>
                  </td>
                  <td class="px-3 py-2.5"><UBadge :label="t(`enrollment.${e.status}`)" :color="statusColor[e.status]" variant="subtle" size="sm" /></td>
                  <td class="num hidden whitespace-nowrap px-3 py-2.5 text-muted sm:table-cell">{{ date(e.since) }}</td>
                  <td class="hidden px-4 py-2.5 sm:table-cell" :class="e.mentor ? 'text-highlighted' : 'text-dimmed'">{{ e.mentor?.name ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="text-sm text-muted">{{ t('person.noEnrollments') }}</p>
        </section>

        <section aria-labelledby="staff-title">
          <h3 id="staff-title" class="mb-3 text-sm font-semibold text-highlighted">{{ t('person.asStaff') }}</h3>
          <ul v-if="data.staffIn.length" class="divide-y divide-default overflow-hidden rounded-lg ring-1 ring-inset ring-default">
            <li v-for="s in data.staffIn" :key="s.cohortId" class="flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-elevated/60">
              <div class="min-w-0">
                <NuxtLink :to="`/cohorts/${s.cohortId}`" class="num block truncate text-highlighted hover:underline" :title="s.cohortName">{{ s.cohortName }}</NuxtLink>
                <p v-if="s.programTitle" class="truncate text-xs text-muted">{{ s.programTitle }}</p>
              </div>
              <UBadge :label="t(`staff.role.${s.role}`)" color="neutral" variant="subtle" size="sm" />
            </li>
          </ul>
          <p v-else class="text-sm text-muted">{{ t('person.noStaff') }}</p>
        </section>
      </div>
    </HomeState>
  </AppPage>
</template>
