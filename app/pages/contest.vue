<script setup lang="ts">
import type { SavedContest } from '~~/shared/types'

definePageMeta({ roles: ['mentee', 'mentor', 'head'] })

const { t, locale } = useI18n()
const { user } = useAuth()
const { left } = useCountdown()
const now = useNow()
const { toastError, code } = useContestErrors()
useHead({ title: () => `${t('nav.contest')} · dev.house` })

const { data: saved, status, refresh } = await useFetch('/api/contests/saved', { key: 'contests-saved', default: () => [] })
// Registration needs a LeetCode ID; the profile says whether there is one (the API still checks)
const { data: me } = useLazyFetch('/api/me', { key: 'me' })
const apiSaysNoId = ref(false)
const needLeetcode = computed(() => apiSaysNoId.value || (!!me.value && !me.value.leetcode))

const fmt = (iso: string, withTime = true) => new Intl.DateTimeFormat(locale.value, withTime
  ? { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }
  : { day: 'numeric', month: 'long' }).format(new Date(iso))

/* ---------- running and upcoming: register ---------- */

const ahead = computed(() => saved.value
  .filter(c => contestStatus(c, now.value) !== 'finished')
  .sort((a, b) => a.startsAt.localeCompare(b.startsAt)))

// `saved` is a shallow ref: replace the item, don't edit it
function setRegistered(slug: string, registered: boolean) {
  saved.value = saved.value.map(c => c.slug === slug
    ? { ...c, registered, registrations: c.registrations + (registered ? 1 : -1) }
    : c)
}

async function toggle(c: SavedContest) {
  const next = !c.registered
  setRegistered(c.slug, next)
  try {
    await $fetch(`/api/contests/saved/${c.slug}/registration`, { method: next ? 'PUT' : 'DELETE' })
    clearNuxtData(['dashboard-mentee', 'dashboard-head'])
  } catch (e) {
    setRegistered(c.slug, !next)
    if (code(e) === 'leetcode_required') apiSaysNoId.value = true
    else toastError(e)
    // The contest began or was removed meanwhile: show the list as it is now
    if (code(e) === 'contest_started' || code(e) === 'contest_not_found') await refresh()
  }
}

/* ---------- finished: results and participants ---------- */

const past = computed(() => saved.value.filter(c => contestStatus(c, now.value) === 'finished'))
const selectedSlug = ref<string>()
watch(past, (list) => {
  if (!list.some(c => c.slug === selectedSlug.value)) selectedSlug.value = list[0]?.slug
}, { immediate: true })
const shown = computed(() => past.value.find(c => c.slug === selectedSlug.value))

const { data: standings, status: standingsStatus, refresh: refreshStandings } = useFetch(
  () => `/api/contests/saved/${selectedSlug.value}/results`,
  { key: () => `contest-results-${selectedSlug.value}`, immediate: !!selectedSlug.value, server: false, lazy: true, default: () => [] }
)

const view = ref<'results' | 'rating'>('results')
const views = computed(() => [
  { label: t('contest.tabResults'), value: 'results' },
  { label: t('contest.tabRating'), value: 'rating' }
])
// The leaderboard is computed by the API from the stored results
const { data: rating, status: ratingStatus, refresh: loadRating } = useLazyFetch('/api/contests/rating', { key: 'contest-rating', server: false, default: () => [] })
</script>

<template>
  <AppPage :title="t('nav.contest')">
    <HomeState :status="status" :has-data="!!saved" @retry="refresh()">
      <div class="mx-auto w-full max-w-4xl space-y-8">
        <section v-for="(c, i) in ahead" :key="c.id" :aria-labelledby="`cur-${c.id}`" class="rounded-lg bg-elevated p-5 ring-1 ring-inset ring-default sm:p-6">
          <p class="num text-sm text-muted">{{ fmt(c.startsAt) }}</p>
          <h1 v-if="i === 0" :id="`cur-${c.id}`" class="mt-2 text-[1.75rem] font-semibold leading-tight tracking-tight text-highlighted">{{ c.title }}</h1>
          <h2 v-else :id="`cur-${c.id}`" class="mt-2 text-xl font-semibold leading-tight tracking-tight text-highlighted">{{ c.title }}</h2>
          <p class="mt-2 max-w-prose text-sm text-default">{{ t('contest.about', { n: CONTEST_PROBLEMS }) }}</p>
          <div class="mt-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <template v-if="contestStatus(c, now) === 'live'">
                <p class="text-sm font-medium text-primary">{{ t('contest.live') }}</p>
              </template>
              <template v-else>
                <p class="text-sm text-muted">{{ t('home.contestIn') }}</p>
                <p class="num mt-0.5 text-3xl font-medium text-highlighted">{{ left(c.startsAt) }}</p>
              </template>
              <p class="num mt-1 text-xs text-muted">{{ t('contest.registeredN', { n: c.registrations }) }}</p>
            </div>
            <div v-if="contestStatus(c, now) === 'upcoming'" class="flex flex-col items-end gap-1.5">
              <UButton
                size="lg"
                :color="c.registered ? 'neutral' : 'primary'"
                :variant="c.registered ? 'outline' : 'solid'"
                :icon="c.registered ? 'i-lucide-check' : undefined"
                :label="c.registered ? t('home.registered') : t('home.register')"
                :disabled="!c.registered && needLeetcode"
                @click="toggle(c)"
              />
              <button v-if="c.registered" type="button" class="cursor-pointer text-xs text-muted underline-offset-4 hover:text-highlighted hover:underline" @click="toggle(c)">
                {{ t('home.unregister') }}
              </button>
              <p v-if="!c.registered && needLeetcode" class="max-w-56 text-right text-xs text-muted">
                {{ t('contest.needLeetcode') }}
                <NuxtLink to="/me" class="text-primary underline-offset-4 hover:underline">{{ t('contest.openProfile') }}</NuxtLink>
              </p>
            </div>
            <p v-else class="text-xs text-muted">{{ t('contest.closed') }}</p>
          </div>
        </section>
        <UEmpty v-if="!ahead.length" icon="i-lucide-trophy" :description="t('contest.noUpcoming')" />

        <section v-if="past.length" aria-labelledby="past-title">
          <div class="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="past-title" class="text-sm font-semibold text-highlighted">{{ t('contest.past') }}</h2>
            <UTabs v-model="view" :items="views" :content="false" size="xs" color="neutral" variant="link" />
          </div>

          <template v-if="view === 'results'">
            <div class="mb-3 flex flex-wrap gap-1" role="tablist" :aria-label="t('contest.past')">
              <UButton
                v-for="c in past"
                :key="c.id"
                role="tab"
                :aria-selected="selectedSlug === c.slug"
                :label="fmt(c.startsAt, false)"
                size="xs"
                color="neutral"
                :variant="selectedSlug === c.slug ? 'soft' : 'ghost'"
                class="num"
                @click="selectedSlug = c.slug"
              />
            </div>
            <p v-if="shown && !shown.syncedAt" class="mb-3 text-xs text-muted">{{ t('contest.notSynced') }}</p>
            <p v-if="standingsStatus === 'pending' || standingsStatus === 'idle'" class="flex items-center gap-2 rounded-lg px-4 py-6 text-sm text-muted ring-1 ring-inset ring-default">
              <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />{{ t('contest.loadingResults') }}
            </p>
            <div v-else-if="standingsStatus === 'error'" class="flex items-center justify-between gap-3 rounded-lg px-4 py-4 text-sm text-muted ring-1 ring-inset ring-default">
              {{ t('contest.err.results') }}
              <UButton :label="t('common.retry')" color="neutral" variant="outline" size="sm" @click="refreshStandings()" />
            </div>
            <ContestResults v-else :rows="standings" :problems="CONTEST_PROBLEMS" :highlight-username="user?.username" />
          </template>

          <template v-else>
            <p v-if="ratingStatus === 'pending' || ratingStatus === 'idle'" class="flex items-center gap-2 rounded-lg px-4 py-6 text-sm text-muted ring-1 ring-inset ring-default">
              <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />{{ t('contest.loadingResults') }}
            </p>
            <div v-else-if="ratingStatus === 'error'" class="flex items-center justify-between gap-3 rounded-lg px-4 py-4 text-sm text-muted ring-1 ring-inset ring-default">
              {{ t('contest.err.rating') }}
              <UButton :label="t('common.retry')" color="neutral" variant="outline" size="sm" @click="loadRating()" />
            </div>
            <template v-else>
              <p class="mb-2 text-xs text-muted">{{ t('contest.ratingNote') }}</p>
              <div class="overflow-x-auto rounded-lg ring-1 ring-inset ring-default">
                <table class="w-full text-sm" data-test="rating-table">
                  <thead class="text-xs text-muted">
                    <tr class="border-b border-default">
                      <th scope="col" class="num w-10 px-3 py-2 text-right font-normal">{{ t('contest.placeCol') }}</th>
                      <th scope="col" class="px-3 py-2 text-left font-normal">{{ t('contest.tabParticipants') }}</th>
                      <th scope="col" class="num px-3 py-2 text-right font-normal">{{ t('contest.ratingCol') }}</th>
                      <th scope="col" class="num px-3 py-2 text-right font-normal">{{ t('contest.deltaCol') }}</th>
                      <th scope="col" class="num px-3 py-2 text-right font-normal">{{ t('contest.attendedCol') }}</th>
                      <th scope="col" class="num px-4 py-2 text-right font-normal">{{ t('contest.solvedCol') }}</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-default">
                    <tr v-for="p in rating" :key="p.username" :class="p.username === user?.username && 'bg-primary/10'">
                      <td class="num px-3 py-2.5 text-right" :class="p.place <= 3 ? 'text-highlighted' : 'text-muted'">{{ p.place }}</td>
                      <td class="px-3 py-2.5">
                        <NuxtLink :to="`/leetcode/${p.username}`" class="text-highlighted hover:underline">{{ p.name }}</NuxtLink>
                        <span v-if="p.username === user?.username" class="text-primary"> · {{ t('contest.you') }}</span>
                        <span class="text-muted"> @{{ p.username }}</span>
                      </td>
                      <td class="num px-3 py-2.5 text-right font-medium text-highlighted">{{ p.rating }}</td>
                      <td class="num px-3 py-2.5 text-right" :class="p.lastDelta > 0 ? 'text-success' : p.lastDelta < 0 ? 'text-error' : 'text-muted'">{{ p.lastDelta > 0 ? `+${p.lastDelta}` : p.lastDelta < 0 ? `−${Math.abs(p.lastDelta)}` : '0' }}</td>
                      <td class="num px-3 py-2.5 text-right text-muted">{{ p.attended }}</td>
                      <td class="num px-4 py-2.5 text-right text-muted">{{ p.solved }}</td>
                    </tr>
                    <tr v-if="!rating.length">
                      <td colspan="6" class="px-4 py-6 text-center text-muted">{{ t('contest.noRating') }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>
          </template>
        </section>
      </div>
    </HomeState>

  </AppPage>
</template>
