<script setup lang="ts">
import type { Attendance, ContestProfile } from '~~/shared/types'

/**
 * A person's LeetCode progress in the LMS (spec contests.md): rating card with a line over time (hover or arrow keys
 * pick a contest), totals, and every contest with attendance, LMS rank, solved and the rating change.
 */
const props = defineProps<{ username: string }>()
const { t, locale } = useI18n()
const { data: profile, status, error, refresh } = useFetch<ContestProfile>(
  () => `/api/contests/users/${encodeURIComponent(props.username)}`,
  { key: () => `contest-profile-${props.username}`, server: false, lazy: true }
)

const history = computed(() => profile.value?.history ?? [])
const series = computed(() => ratingSeries(history.value))
const trend = computed(() => ratingTrend(series.value))
const picked = ref<number | null>(null)
const activeIdx = computed(() => picked.value !== null && picked.value < series.value.length ? picked.value : series.value.length - 1)
const active = computed(() => series.value[activeIdx.value])
watch(() => props.username, () => (picked.value = null))

const bestRank = computed(() => Math.min(...history.value.map(r => r.lmsRank ?? Infinity)))
const stats = computed(() => {
  const tt = profile.value?.totals
  return tt
    ? [
        { label: t('contest.statAttended'), value: tt.attended, of: history.value.length },
        { label: t('contest.registeredCol'), value: tt.registered },
        { label: t('contest.noShowCol'), value: tt.noShow },
        { label: t('contest.excusedCol'), value: tt.excused },
        { label: t('contest.solvedCol'), value: tt.solved },
        { label: t('contest.statBest'), value: Number.isFinite(bestRank.value) ? `#${bestRank.value}` : '—' }
      ]
    : []
})

const date = (iso: string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) => new Date(iso).toLocaleDateString(locale.value, opts)
const MARK: Record<Attendance, { icon: string, class: string } | null> = {
  attended: { icon: 'i-lucide-check', class: 'text-success' },
  no_show: { icon: 'i-lucide-user-x', class: 'text-warning' },
  walk_in: { icon: 'i-lucide-user-plus', class: 'text-muted' },
  excused: { icon: 'i-lucide-shield-check', class: 'text-muted' },
  absent: null
}
const delta = (r: { ratingBefore: number | null, ratingAfter: number | null }) =>
  r.ratingBefore !== null && r.ratingAfter !== null ? r.ratingAfter - r.ratingBefore : null
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0')

/* Chart: x by date, y by rating. */
const W = 560
const H = 150
const PAD = { l: 10, r: 10, t: 14, b: 22 }
const points = computed(() => {
  const s = series.value
  if (!s.length) return []
  const times = s.map(r => new Date(r.startsAt).getTime())
  const t0 = times[0]!
  const span = times[times.length - 1]! - t0
  const lo = Math.min(...s.map(r => r.ratingAfter))
  const hi = Math.max(...s.map(r => r.ratingAfter))
  const range = Math.max(hi - lo, 40)
  const mid = (hi + lo) / 2
  return s.map((r, i) => ({
    r,
    x: PAD.l + (span ? (times[i]! - t0) / span : 0.5) * (W - PAD.l - PAD.r),
    y: PAD.t + (1 - (r.ratingAfter - (mid - range / 2)) / range) * (H - PAD.t - PAD.b)
  }))
})
const line = computed(() => points.value.map(p => `${p.x},${p.y}`).join(' '))
const cur = computed(() => points.value[activeIdx.value])

function onMove(e: PointerEvent) {
  const el = e.currentTarget as SVGSVGElement
  const rect = el.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width * W
  let best = 0
  points.value.forEach((p, i) => {
    if (Math.abs(p.x - x) < Math.abs(points.value[best]!.x - x)) best = i
  })
  picked.value = best
}
function onKey(e: KeyboardEvent) {
  const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
  if (!step) return
  e.preventDefault()
  picked.value = Math.min(series.value.length - 1, Math.max(0, activeIdx.value + step))
}
const activeLabel = computed(() => active.value
  ? `${active.value.title}, ${date(active.value.startsAt)}, ${t('contest.rankLabel')} ${active.value.lmsRank}/${active.value.participants}, ${active.value.ratingAfter}`
  : '')
</script>

<template>
  <p v-if="status === 'pending' || status === 'idle'" class="flex items-center gap-2 text-sm text-muted">
    <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />{{ t('contest.loadingResults') }}
  </p>
  <div v-else-if="status === 'error' || !profile" class="flex items-center justify-between gap-3 text-sm text-muted">
    {{ apiError(error).code === 'user_not_found' || apiError(error).status === 404 ? t('contest.err.user_not_found') : t('contest.err.profile') }}
    <UButton v-if="apiError(error).status !== 404" :label="t('common.retry')" color="neutral" variant="outline" size="sm" @click="refresh()" />
  </div>

  <div v-else class="space-y-5">
    <section class="rounded-lg bg-elevated p-4 ring-1 ring-inset ring-default sm:p-5" :aria-label="t('contest.ratingTitle')">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-sm text-muted">{{ t('contest.ratingTitle') }}</p>
          <p class="mt-1 flex items-center gap-2">
            <span class="num text-3xl font-semibold text-highlighted" data-test="rating">{{ profile.rating ?? '—' }}</span>
            <UIcon
              v-if="profile.rating !== null && trend !== 0"
              :name="trend > 0 ? 'i-lucide-arrow-up-right' : 'i-lucide-arrow-down-right'"
              class="size-6"
              :class="trend > 0 ? 'text-success' : 'text-error'"
            />
            <span v-if="profile.rating !== null && trend !== 0" class="sr-only">{{ trend > 0 ? t('contest.rise', { n: trend }) : t('contest.fall', { n: Math.abs(trend) }) }}</span>
          </p>
          <p v-if="profile.rating === null" class="mt-1 text-sm text-muted">{{ t('contest.unrated') }}</p>
        </div>
        <dl v-if="active" class="grid grid-cols-[auto_auto_auto] gap-x-6 text-sm" data-test="active">
          <div class="col-span-3 mb-1 min-w-0">
            <dt class="num text-xs text-muted">{{ date(active.startsAt) }}</dt>
            <dd class="truncate font-medium text-highlighted">{{ active.title }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted">{{ t('contest.rankLabel') }}</dt>
            <dd class="num text-highlighted">{{ active.lmsRank }}<span class="text-dimmed"> / {{ active.participants }}</span></dd>
          </div>
          <div>
            <dt class="text-xs text-muted">{{ t('contest.solvedShort') }}</dt>
            <dd class="num text-highlighted">{{ active.solved }}<span class="text-dimmed"> / {{ CONTEST_PROBLEMS }}</span></dd>
          </div>
          <div>
            <dt class="text-xs text-muted">{{ t('contest.ratingCol') }}</dt>
            <dd class="num text-highlighted">{{ active.ratingAfter }}</dd>
          </div>
        </dl>
      </div>

      <svg
        v-if="points.length"
        :viewBox="`0 0 ${W} ${H}`"
        class="mt-3 h-auto w-full touch-none text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary"
        role="img"
        tabindex="0"
        :aria-label="`${t('contest.ratingChartLabel')}. ${activeLabel}`"
        @pointermove="onMove"
        @pointerleave="picked = null"
        @keydown="onKey"
      >
        <polyline v-if="points.length > 1" :points="line" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        <template v-if="cur">
          <line :x1="cur.x" :x2="cur.x" :y1="PAD.t - 6" :y2="H - PAD.b" stroke="currentColor" stroke-opacity=".35" class="text-dimmed" />
          <circle :cx="cur.x" :cy="cur.y" r="9" fill="currentColor" fill-opacity=".2" />
          <circle :cx="cur.x" :cy="cur.y" r="4.5" fill="currentColor" stroke="var(--ui-bg)" stroke-width="1.5" data-test="dot" />
        </template>
        <g class="text-dimmed" font-size="9" fill="currentColor">
          <text :x="PAD.l" :y="H - 4">{{ date(series[0]!.startsAt, { month: 'short', year: 'numeric' }) }}</text>
          <text v-if="series.length > 1" :x="W - PAD.r" :y="H - 4" text-anchor="end">{{ date(series[series.length - 1]!.startsAt, { month: 'short', year: 'numeric' }) }}</text>
        </g>
      </svg>
      <p v-else class="mt-3 text-sm text-muted">{{ t('contest.noRatedChart') }}</p>
    </section>

    <p v-if="!history.length" class="text-sm text-muted">{{ t('contest.historyEmpty') }}</p>
    <template v-else>
      <dl class="grid grid-cols-3 gap-x-6 gap-y-3 sm:grid-cols-6">
        <div v-for="s in stats" :key="s.label">
          <dt class="text-xs text-muted">{{ s.label }}</dt>
          <dd class="num text-xl font-semibold text-highlighted">
            {{ s.value }}<span v-if="s.of !== undefined" class="text-sm font-normal text-dimmed">/{{ s.of }}</span>
          </dd>
        </div>
      </dl>

      <ul class="divide-y divide-default overflow-hidden rounded-lg ring-1 ring-inset ring-default">
        <li v-for="r in history" :key="r.slug" class="flex items-center gap-3 px-4 py-2.5 text-sm" data-test="contest-row">
          <span
            class="inline-flex size-4 shrink-0 items-center justify-center"
            role="img"
            :aria-label="t(`contest.attendance.${r.attendance}`)"
            :title="t(`contest.attendance.${r.attendance}`)"
          >
            <UIcon v-if="MARK[r.attendance]" :name="MARK[r.attendance]!.icon" class="block size-4" :class="MARK[r.attendance]!.class" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-highlighted">{{ r.title }}</p>
            <p class="num text-xs text-muted">{{ date(r.startsAt) }}</p>
          </div>
          <span
            v-if="delta(r) !== null"
            class="num w-10 text-right text-xs"
            :class="delta(r)! > 0 ? 'text-success' : delta(r)! < 0 ? 'text-error' : 'text-muted'"
          >{{ signed(delta(r)!) }}</span>
          <span class="num w-8 text-right text-muted">{{ r.lmsRank ? `#${r.lmsRank}` : '' }}</span>
          <span class="num w-10 text-right text-highlighted">{{ r.solved === null ? '—' : `${r.solved}/${CONTEST_PROBLEMS}` }}</span>
        </li>
      </ul>
    </template>
  </div>
</template>
