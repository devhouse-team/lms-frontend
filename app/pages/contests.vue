<script setup lang="ts">
import type { ContestStanding, LeetcodeContest, SavedContest } from '~~/shared/types'

definePageMeta({ contestManager: true })

const { t, locale } = useI18n()
const toast = useToast()
const { toastError } = useContestErrors()
const { user } = useAuth()
const now = useNow()
useHead({ title: () => `${t('nav.contests')} · dev.house` })

const PAGE = 10

const { data: saved, status, refresh } = await useFetch('/api/contests/saved', { key: 'contests-saved', default: () => [] })

const fmt = (iso: string) => new Intl.DateTimeFormat(locale.value, { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const minutes = (sec: number) => t('contest.minutes', { n: Math.round(sec / 60) })

/* ---------- results of the selected saved contest ---------- */

const selectedSlug = ref<string>()
watch(saved, (list) => {
  if (!list.some(c => c.slug === selectedSlug.value)) selectedSlug.value = list[0]?.slug
}, { immediate: true })
const selected = computed(() => saved.value.find(c => c.slug === selectedSlug.value))

// Stored results of the open contest, fetched on the client so switching contests doesn't block the page
const { data: standings, status: standingsStatus, refresh: refreshStandings } = useFetch(
  () => `/api/contests/saved/${selectedSlug.value}/results`,
  { key: () => `contest-results-${selectedSlug.value}`, immediate: !!selectedSlug.value, server: false, lazy: true, default: () => [] }
)
const took = computed(() => standings.value.filter(r => r.attended).length)
const registeredN = computed(() => standings.value.filter(r => r.registered).length)
const noShowN = computed(() => standings.value.filter(r => r.attendance === 'no_show').length)
const phase = computed(() => (selected.value ? contestStatus(selected.value, now.value) : undefined))
/** Registrations, results and the leaderboard moved: reload what shows them */
const reload = () => Promise.all([refresh(), refreshStandings(), refreshNuxtData(['contest-rating', 'contests-saved'])])

/* ---------- registrations of others (before the start) ---------- */

const regBusy = ref<string>()
async function setRegistered(r: ContestStanding, on: boolean) {
  if (!selected.value) return
  regBusy.value = r.userId
  try {
    await $fetch(`/api/contests/saved/${selected.value.slug}/registrations/${r.userId}`, { method: on ? 'PUT' : 'DELETE' })
    await Promise.all([refresh(), refreshStandings()])
  } catch (e) {
    toastError(e)
    if (['contest_started', 'contest_not_found'].includes(apiError(e).code ?? '')) await Promise.all([refresh(), refreshStandings()])
  } finally {
    regBusy.value = undefined
  }
}

/* ---------- correct a result (after the end) ---------- */

const correcting = ref<{ row: ContestStanding, status: 'excused' | 'attended' }>()
const correctOpen = ref(false)
const note = ref('')
const correctBusy = ref(false)
function askCorrect(row: ContestStanding, status: 'excused' | 'attended') {
  correcting.value = { row, status }
  note.value = row.override?.note ?? ''
  correctOpen.value = true
}
async function saveCorrect() {
  if (!selected.value || !correcting.value) return
  correctBusy.value = true
  try {
    await $fetch(`/api/contests/saved/${selected.value.slug}/attendance/${correcting.value.row.userId}`, {
      method: 'PUT', body: { status: correcting.value.status, note: note.value || null }
    })
    correctOpen.value = false
    await reload()
    toast.add({ title: t('contest.overrideSaved'), icon: 'i-lucide-check', color: 'success' })
  } catch (e) {
    toastError(e)
  } finally {
    correctBusy.value = false
  }
}
async function clearCorrect(row: ContestStanding) {
  if (!selected.value) return
  try {
    await $fetch(`/api/contests/saved/${selected.value.slug}/attendance/${row.userId}`, { method: 'DELETE' })
    await reload()
  } catch (e) {
    toastError(e)
  }
}
/** An override only matters where LeetCode has no result: excuse a miss, or mark someone LeetCode did not count */
const menuFor = (r: ContestStanding) => [[
  ...(!r.attended || r.override?.status === 'attended'
    ? [
        { label: t('contest.markExcused'), icon: 'i-lucide-shield-check', onSelect: () => askCorrect(r, 'excused') },
        { label: t('contest.markAttended'), icon: 'i-lucide-check', onSelect: () => askCorrect(r, 'attended') }
      ]
    : []),
  ...(r.override ? [{ label: t('contest.clearOverride'), icon: 'i-lucide-undo-2', onSelect: () => clearCorrect(r) }] : [])
]].filter(g => g.length)

/* ---------- LeetCode mentors (superuser) ---------- */

const isSuper = computed(() => !!user.value?.isSuperuser)
const { data: managers, status: managersStatus, refresh: refreshManagers } = useFetch('/api/contests/managers', {
  key: 'contest-managers', server: false, lazy: true, immediate: isSuper.value, default: () => []
})
const { data: options } = useFetch('/api/contests/managers/options', {
  key: 'contest-manager-options', server: false, lazy: true, immediate: isSuper.value, default: () => []
})
const pickable = computed(() => {
  const taken = new Set(managers.value.map(m => m.id))
  return options.value.filter(o => !taken.has(o.id)).map(o => ({ label: `${o.name} @${o.username}`, value: o.id, name: o.name }))
})
const picked = ref<string>()
const mentorBusy = ref<string>()
async function addMentor() {
  const o = pickable.value.find(x => x.value === picked.value)
  if (!o) return
  mentorBusy.value = o.value
  try {
    await $fetch(`/api/contests/managers/${o.value}`, { method: 'PUT' })
    picked.value = undefined
    await refreshManagers()
    toast.add({ title: t('contest.mentorAdded', { name: o.name }), icon: 'i-lucide-check', color: 'success' })
  } catch (e) {
    toastError(e)
  } finally {
    mentorBusy.value = undefined
  }
}
async function removeMentor(id: string) {
  mentorBusy.value = id
  try {
    await $fetch(`/api/contests/managers/${id}`, { method: 'DELETE' })
    await refreshManagers()
  } catch (e) {
    toastError(e)
  } finally {
    mentorBusy.value = undefined
  }
}

const syncing = ref(false)
async function sync() {
  if (!selected.value) return
  syncing.value = true
  try {
    await $fetch(`/api/contests/saved/${selected.value.slug}/sync`, { method: 'POST' })
    await reload()
    toast.add({ title: t('contest.synced'), icon: 'i-lucide-check', color: 'success' })
  } catch (e) {
    toastError(e)
  } finally {
    syncing.value = false
  }
}

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

        <section v-if="isSuper" aria-labelledby="mentors-title">
          <h2 id="mentors-title" class="mb-1 text-sm font-semibold text-highlighted">{{ t('contest.mentorsTitle') }}</h2>
          <p class="mb-3 text-xs text-muted">{{ t('contest.mentorsHint') }}</p>
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <USelectMenu v-model="picked" :items="pickable" value-key="value" :placeholder="t('contest.mentorPick')" class="w-full sm:w-72" />
            <UButton :label="t('contest.mentorAdd')" icon="i-lucide-user-plus" :disabled="!picked" :loading="!!picked && mentorBusy === picked" @click="addMentor" />
          </div>
          <div v-if="managersStatus === 'error'" class="flex items-center justify-between gap-3 rounded-lg px-4 py-4 text-sm text-muted ring-1 ring-inset ring-default">
            {{ t('contest.err.managers') }}
            <UButton :label="t('common.retry')" color="neutral" variant="outline" size="sm" @click="refreshManagers()" />
          </div>
          <ul v-else-if="managers.length" class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default" data-test="mentors">
            <li v-for="m in managers" :key="m.id" class="flex items-center gap-3 px-4 py-2 text-sm">
              <span class="min-w-0 flex-1 truncate"><span class="text-highlighted">{{ m.name }}</span><span class="text-muted"> @{{ m.username }}</span></span>
              <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="sm" :loading="mentorBusy === m.id" :aria-label="t('contest.mentorRemove', { name: m.name })" @click="removeMentor(m.id)" />
            </li>
          </ul>
          <p v-else-if="managersStatus !== 'pending'" class="rounded-lg px-4 py-6 text-sm text-muted ring-1 ring-inset ring-default">{{ t('contest.mentorNone') }}</p>
        </section>

        <section v-if="selected" aria-labelledby="results-title">
          <div class="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="results-title" class="text-sm font-semibold text-highlighted">{{ phase === 'upcoming' ? t('contest.registrantsTitle') : t('contest.standings') }} · {{ selected.title }}</h2>
            <div class="flex items-center gap-3">
              <p v-if="standingsStatus === 'success' && phase !== 'upcoming'" class="num text-xs text-muted">
                {{ t('contest.took', { n: took, total: standings.length }) }} · {{ t('contest.registeredN', { n: registeredN }) }} · {{ t('contest.noShowCol') }}: {{ noShowN }}
              </p>
              <UButton
                v-if="contestStatus(selected, now) === 'finished'"
                :label="t('contest.sync')"
                icon="i-lucide-refresh-cw"
                color="neutral"
                variant="outline"
                size="xs"
                :loading="syncing"
                @click="sync"
              />
            </div>
          </div>
          <p v-if="contestStatus(selected, now) === 'finished'" class="num mb-3 text-xs text-muted">
            {{ selected.syncedAt ? t('contest.syncedAt', { date: fmt(selected.syncedAt) }) : t('contest.notSynced') }}
          </p>
          <p v-if="standingsStatus === 'pending' || standingsStatus === 'idle'" class="flex items-center gap-2 rounded-lg px-4 py-6 text-sm text-muted ring-1 ring-inset ring-default">
            <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />{{ t('contest.loadingResults') }}
          </p>
          <div v-else-if="standingsStatus === 'error'" class="flex items-center justify-between gap-3 rounded-lg px-4 py-4 text-sm text-muted ring-1 ring-inset ring-default">
            {{ t('contest.err.results') }}
            <UButton :label="t('common.retry')" color="neutral" variant="outline" size="sm" @click="refreshStandings()" />
          </div>
          <template v-else-if="phase === 'upcoming'">
            <p class="mb-2 text-xs text-muted">{{ t('contest.registrantsHint') }}</p>
            <ul class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default" data-test="registrants">
              <li v-for="r in standings" :key="r.username" class="flex items-center gap-3 px-4 py-2 text-sm">
                <span class="min-w-0 flex-1 truncate">
                  <span class="text-highlighted">{{ r.name }}</span>
                  <span class="text-muted"> @{{ r.username }}</span>
                </span>
                <span class="num hidden shrink-0 text-xs text-muted sm:inline">{{ r.leetcodeId }}</span>
                <UBadge :label="r.registered ? t('contest.registeredState') : t('contest.notRegistered')" :color="r.registered ? 'success' : 'neutral'" variant="subtle" size="sm" />
                <UButton
                  :label="r.registered ? t('contest.cancelFor') : t('contest.registerFor')"
                  :aria-label="`${r.registered ? t('contest.cancelFor') : t('contest.registerFor')}: ${r.name}`"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  :loading="regBusy === r.userId"
                  @click="setRegistered(r, !r.registered)"
                />
              </li>
              <li v-if="!standings.length" class="px-4 py-6 text-center text-sm text-muted">{{ t('contest.noLeetcodeUsers') }}</li>
            </ul>
          </template>
          <ContestResults v-else :rows="standings" :problems="CONTEST_PROBLEMS">
            <template v-if="phase === 'finished'" #actions="{ row }">
              <UDropdownMenu v-if="menuFor(row).length" :items="menuFor(row)">
                <UButton icon="i-lucide-ellipsis" color="neutral" variant="ghost" size="xs" :aria-label="t('contest.correctFor', { name: row.name })" />
              </UDropdownMenu>
              <span v-else class="size-6 shrink-0" aria-hidden="true" />
            </template>
          </ContestResults>
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

    <UModal v-model:open="correctOpen" :title="correcting ? t('contest.correctFor', { name: correcting.row.name }) : ''">
      <template #body>
        <p class="mb-3 text-sm text-default">{{ correcting ? t(`contest.attendance.${correcting.status}`) : '' }}</p>
        <UFormField :label="t('contest.overrideNote')" :hint="t('common.optional')">
          <UTextarea v-model="note" :rows="3" :maxlength="500" class="w-full" />
        </UFormField>
        <p class="mt-3 text-xs text-muted">{{ t('contest.overrideHint') }}</p>
      </template>
      <template #footer>
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="correctOpen = false" />
        <UButton :label="t('common.save')" :loading="correctBusy" @click="saveCorrect" />
      </template>
    </UModal>

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
