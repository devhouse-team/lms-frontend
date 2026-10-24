<script setup lang="ts">
import type { LeetcodeContest, SavedContest } from '~~/shared/types'

definePageMeta({ roles: ['head'], headScope: 'all' })

const { t, locale } = useI18n()
const toast = useToast()
useHead({ title: () => `${t('nav.contests')} · dev.house` })

const PAGE = 10
/** LeetCode weekly and biweekly contests have four problems */
const PROBLEMS = 4

const { data: saved, status, refresh } = await useFetch('/api/contests/saved', { key: 'contests-saved', default: () => [] })

const fmt = (iso: string) => new Intl.DateTimeFormat(locale.value, { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const minutes = (sec: number) => t('contest.minutes', { n: Math.round(sec / 60) })

/* ---------- results of the selected saved contest ---------- */

const selectedSlug = ref<string>()
watch(saved, (list) => {
  if (!list.some(c => c.slug === selectedSlug.value)) selectedSlug.value = list[0]?.slug
}, { immediate: true })
const selected = computed(() => saved.value.find(c => c.slug === selectedSlug.value))

// One LeetCode call per user on the API side: slow, so fetched on the client and only for the open contest
const { data: standings, status: standingsStatus, refresh: refreshStandings } = useFetch(
  () => `/api/contests/saved/${selectedSlug.value}/results`,
  { key: () => `contest-results-${selectedSlug.value}`, immediate: !!selectedSlug.value, server: false, lazy: true, default: () => [] }
)
const took = computed(() => standings.value.filter(r => r.solved !== null).length)

/* ---------- LeetCode's lists, to save from ---------- */

const tab = ref<'upcoming' | 'past'>('upcoming')
const tabs = computed(() => [
  { label: t('contest.upcoming'), value: 'upcoming' },
  { label: t('contest.past'), value: 'past' }
])

const { data: upcoming, status: upcomingStatus, refresh: refreshUpcoming } = useFetch('/api/contests/leetcode/upcoming', { key: 'leetcode-upcoming', server: false, lazy: true, default: () => [] })

const past = ref<LeetcodeContest[]>([])
const pastDone = ref(false)
const pastLoading = ref(false)
const pastError = ref(false)
async function loadPast() {
  pastLoading.value = true
  pastError.value = false
  try {
    const page = await $fetch('/api/contests/leetcode/past', { query: { limit: PAGE, skip: past.value.length } })
    past.value.push(...page)
    pastDone.value = page.length < PAGE
  } catch {
    pastError.value = true
  } finally {
    pastLoading.value = false
  }
}
watch(tab, (v) => {
  if (v === 'past' && !past.value.length && !pastDone.value) loadPast()
})

const savedSlugs = computed(() => new Set(saved.value.map(c => c.slug)))
const adding = ref<string>()

async function add(c: LeetcodeContest) {
  adding.value = c.slug
  try {
    const created = await $fetch('/api/contests/saved', { method: 'POST', body: { slug: c.slug } })
    await refresh()
    selectedSlug.value = created.slug
    toast.add({ title: t('contest.added', { title: created.title }), icon: 'i-lucide-check', color: 'success' })
  } catch (e) {
    const { status } = apiError(e)
    const title = status === 422 ? t('contest.err.unknown') : status === 503 ? t('contest.err.leetcode') : t('common.saveError')
    toast.add({ title, color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    adding.value = undefined
  }
}

/* ---------- delete ---------- */

const removing = ref<SavedContest>()
const removeOpen = ref(false)
const busy = ref(false)
function askRemove(c: SavedContest) {
  removing.value = c
  removeOpen.value = true
}
async function confirmRemove() {
  if (!removing.value) return
  busy.value = true
  try {
    await $fetch(`/api/contests/saved/${removing.value.slug}`, { method: 'DELETE' })
    removeOpen.value = false
    await refresh()
  } catch (e) {
    // Already gone: the list catches up
    if (apiError(e).status === 404) {
      removeOpen.value = false
      await refresh()
    } else {
      toast.add({ title: t('common.saveError'), color: 'error', icon: 'i-lucide-circle-alert' })
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AppPage :title="t('nav.contests')">
    <HomeState :status="status" :has-data="!!saved" @retry="refresh()">
      <div class="mx-auto w-full max-w-4xl space-y-10">
        <section aria-labelledby="saved-title">
          <h1 id="saved-title" class="mb-3 text-xl font-semibold tracking-tight text-highlighted">{{ t('contest.saved') }}</h1>
          <p v-if="!saved.length" class="rounded-lg px-4 py-6 text-sm text-muted ring-1 ring-inset ring-default">{{ t('contest.noSaved') }}</p>
          <ul v-else class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
            <li v-for="c in saved" :key="c.id" class="flex items-center gap-3 px-4 py-2" :class="c.slug === selectedSlug && 'bg-elevated'">
              <button
                type="button"
                class="min-w-0 flex-1 cursor-pointer text-left"
                :aria-current="c.slug === selectedSlug ? 'true' : undefined"
                @click="selectedSlug = c.slug"
              >
                <span class="block truncate text-sm text-highlighted">{{ c.title }}</span>
                <span class="num block text-xs text-muted">{{ fmt(c.startsAt) }} · {{ minutes(c.durationSec) }}</span>
              </button>
              <UButton icon="i-lucide-trash-2" color="neutral" variant="ghost" size="sm" :aria-label="t('contest.removeFor', { title: c.title })" @click="askRemove(c)" />
            </li>
          </ul>
        </section>

        <section v-if="selected" aria-labelledby="results-title">
          <div class="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="results-title" class="text-sm font-semibold text-highlighted">{{ t('contest.standings') }} · {{ selected.title }}</h2>
            <p v-if="standingsStatus === 'success'" class="num text-xs text-muted">{{ t('contest.took', { n: took, total: standings.length }) }}</p>
          </div>
          <p v-if="standingsStatus === 'pending' || standingsStatus === 'idle'" class="flex items-center gap-2 rounded-lg px-4 py-6 text-sm text-muted ring-1 ring-inset ring-default">
            <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />{{ t('contest.loadingResults') }}
          </p>
          <div v-else-if="standingsStatus === 'error'" class="flex items-center justify-between gap-3 rounded-lg px-4 py-4 text-sm text-muted ring-1 ring-inset ring-default">
            {{ t('contest.err.results') }}
            <UButton :label="t('common.retry')" color="neutral" variant="outline" size="sm" @click="refreshStandings()" />
          </div>
          <ol v-else class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
            <li v-for="r in standings" :key="r.username" class="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span class="num w-6 shrink-0 text-right" :class="r.place !== null && r.place <= 3 ? 'text-highlighted' : 'text-muted'">{{ r.place ?? '' }}</span>
              <span class="min-w-0 flex-1 truncate">
                <span class="text-highlighted">{{ r.name }}</span>
                <span class="text-muted"> @{{ r.username }}</span>
              </span>
              <span class="num hidden shrink-0 text-xs text-muted sm:inline">{{ r.leetcodeId }}</span>
              <span
                class="num w-12 shrink-0 text-right"
                :class="r.solved === null ? 'text-muted' : 'text-highlighted'"
                :aria-label="r.solved === null ? t('contest.absent') : t('contest.solvedLabel', { n: r.solved, total: PROBLEMS })"
              >{{ r.solved === null ? '—' : `${r.solved}/${PROBLEMS}` }}</span>
            </li>
            <li v-if="!standings.length" class="px-4 py-6 text-center text-sm text-muted">{{ t('contest.noLeetcodeUsers') }}</li>
          </ol>
        </section>

        <section aria-labelledby="add-title">
          <div class="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="add-title" class="text-sm font-semibold text-highlighted">{{ t('contest.addFrom') }}</h2>
            <UTabs v-model="tab" :items="tabs" :content="false" size="xs" color="neutral" variant="link" />
          </div>

          <template v-if="tab === 'upcoming'">
            <p v-if="upcomingStatus === 'pending' || upcomingStatus === 'idle'" class="rounded-lg px-4 py-6 text-sm text-muted ring-1 ring-inset ring-default">{{ t('contest.loading') }}</p>
            <div v-else-if="upcomingStatus === 'error'" class="flex items-center justify-between gap-3 rounded-lg px-4 py-4 text-sm text-muted ring-1 ring-inset ring-default">
              {{ t('contest.err.leetcode') }}
              <UButton :label="t('common.retry')" color="neutral" variant="outline" size="sm" @click="refreshUpcoming()" />
            </div>
            <ContestPickList v-else :items="upcoming" :saved="savedSlugs" :adding="adding" @add="add" />
          </template>

          <template v-else>
            <ContestPickList v-if="past.length" :items="past" :saved="savedSlugs" :adding="adding" @add="add" />
            <div v-if="pastError" class="mt-2 flex items-center justify-between gap-3 rounded-lg px-4 py-4 text-sm text-muted ring-1 ring-inset ring-default">
              {{ t('contest.err.leetcode') }}
              <UButton :label="t('common.retry')" color="neutral" variant="outline" size="sm" @click="loadPast()" />
            </div>
            <p v-else-if="pastLoading && !past.length" class="rounded-lg px-4 py-6 text-sm text-muted ring-1 ring-inset ring-default">{{ t('contest.loading') }}</p>
            <div v-else-if="!pastDone && past.length" class="mt-3 flex justify-center">
              <UButton :label="t('contest.more')" color="neutral" variant="outline" size="sm" :loading="pastLoading" @click="loadPast()" />
            </div>
          </template>
        </section>
      </div>
    </HomeState>

    <UModal v-model:open="removeOpen" :title="t('contest.removeTitle')">
      <template #body>
        <p class="text-sm text-default">{{ t('contest.removeConfirm', { title: removing?.title ?? '' }) }}</p>
      </template>
      <template #footer>
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="removeOpen = false" />
        <UButton :label="t('common.delete')" color="error" :loading="busy" @click="confirmRemove" />
      </template>
    </UModal>
  </AppPage>
</template>
