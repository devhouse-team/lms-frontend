<script setup lang="ts">
import type { AssignmentDetail } from '~~/shared/types'

/**
 * One assignment for the student (spec course-content.md, Assignment page): homework, exam (countdown → window → one
 * attempt, trials before it) or practice (unlimited, solution after the first). What may be sent comes from the API
 * (`phase`, `canSubmit`, `canTrial`); times follow the API's clock and the cohort's timezone.
 */
definePageMeta({ roles: ['mentee'] })

const route = useRoute()
const { t, locale } = useI18n()
const toast = useToast()
const { message, code } = useApiErrors('content')
const { long } = useCohortFormat()

const cohortId = computed(() => String(route.params.cohortId))
const assignmentId = computed(() => String(route.params.assignmentId))
const key = computed(() => `assignment:${cohortId.value}:${assignmentId.value}`)
const { data: a, status, error, refresh } = await useFetch<AssignmentDetail>(() => `/api/assignments/${cohortId.value}/${assignmentId.value}`, { key: key.value })
useHead({ title: () => `${a.value?.title ?? t('nav.assignments')} · dev.house` })
const { now, countdown, until } = useServerClock(() => a.value?.serverNow)
/** Clock- and viewer-zone-dependent text renders after mount: the server has another clock and zone (hydration) */
const mounted = ref(false)
onMounted(() => (mounted.value = true))

const filesBase = computed(() => `/api/files/cohorts/${cohortId.value}/assignments/${assignmentId.value}`)
const solutionBase = (materialId: string) => `/api/files/cohorts/${cohortId.value}/materials/${materialId}`

// ---- times in the cohort's zone, plus the viewer's when it differs ------------------------------------
const zoned = (iso: string, opts: Intl.DateTimeFormatOptions, tz = a.value!.timezone) => new Intl.DateTimeFormat(locale.value, { timeZone: tz, ...opts }).format(new Date(iso))
const otherZone = computed(() => mounted.value && !!a.value && browserZone() !== a.value.timezone)
const windowText = computed(() => {
  const x = a.value
  if (!x?.opensAt || !x.closesAt) return ''
  const day = zoned(x.opensAt, { weekday: 'short', day: 'numeric', month: 'short' })
  return `${day}, ${zoned(x.opensAt, { hour: '2-digit', minute: '2-digit' })}–${zoned(x.closesAt, { hour: '2-digit', minute: '2-digit' })} (${x.timezone})`
})
const yourTime = computed(() => (a.value?.opensAt && otherZone.value
  ? t('exam.yourTime', { time: zoned(a.value.opensAt, { weekday: 'short', hour: '2-digit', minute: '2-digit' }, browserZone()) })
  : ''))
const timeOf = (iso: string) => zoned(iso, { hour: '2-digit', minute: '2-digit' })
const dateTime = (iso: string) => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

// ---- state --------------------------------------------------------------------------------------------
const closedCohort = computed(() => (a.value && a.value.cohort.status !== 'active' ? a.value.cohort : null))
const closedText = computed(() => closedCohort.value?.status === 'finished'
  ? t('submission.closedFinished', { date: long(closedCohort.value.finishedAt ?? closedCohort.value.endsOn) })
  : closedCohort.value ? t('submission.closedPlanned', { date: long(closedCohort.value.startsOn) }) : '')
const pastDue = computed(() => !!a.value?.dueAt && Date.parse(a.value.dueAt) < now.value)
/** The exam form hides at closes_at; a send already in flight is still accepted for 2 minutes */
const windowOver = computed(() => !!a.value?.closesAt && until(a.value.closesAt) <= 0)
const counted = computed(() => a.value?.submissions[0])
/** An exam send (or upload) still running at closes_at keeps the form mounted, so `sent` isn't lost */
const inFlight = ref(false)
const examState = computed(() => {
  const x = a.value
  if (!x || x.mode !== 'exam') return undefined
  if (counted.value) return 'submitted'
  if (x.phase === 'not_open') return 'not_open'
  if ((x.phase === 'closed' || windowOver.value) && !inFlight.value) return 'missed'
  return 'open'
})
const canSend = computed(() => !!a.value?.canSubmit && !closedCohort.value && !(a.value.mode === 'exam' && windowOver.value))

// ---- exam opening: refetch once at opens_at (0–3 s jitter), then retry every 5 s up to 6 times ---------------------------
const stuck = ref(false)
const announce = ref('')
let retries = 0
let pending: ReturnType<typeof setTimeout> | undefined
async function refetchUntilOpen() {
  await refresh()
  if (a.value?.phase !== 'not_open') {
    announce.value = t('exam.nowOpen')
    return
  }
  if (++retries > 6) return void (stuck.value = true)
  pending = setTimeout(refetchUntilOpen, 5000)
}
watch(now, (n) => {
  const x = a.value
  if (!x || x.mode !== 'exam') return
  if (x.phase === 'not_open' && x.opensAt && n >= Date.parse(x.opensAt) && !pending && !stuck.value) {
    pending = setTimeout(refetchUntilOpen, Math.random() * 3000)
  }
  if (examState.value === 'open' && x.closesAt) {
    const left = Date.parse(x.closesAt) - n
    if (left <= 15 * 60_000 && left > 15 * 60_000 - 1000) announce.value = t('exam.fifteenLeft')
  }
})
// ---- exam closing: refetch at closes_at and after the 2-minute grace (a late send from another tab, the final state)
let graceTimer: ReturnType<typeof setTimeout> | undefined
watch(windowOver, (over) => {
  if (!over || a.value?.mode !== 'exam' || counted.value) return
  refresh()
  clearTimeout(graceTimer)
  graceTimer = setTimeout(refresh, until(a.value.closesAt!) + 125_000)
})
onBeforeUnmount(() => {
  clearTimeout(pending)
  clearTimeout(graceTimer)
})

// ---- sending --------------------------------------------------------------------------------------------
async function onSent(trial = false) {
  await refresh()
  invalidateContent(key.value)
  const mode = a.value?.mode
  toast.add({ title: trial ? t('exam.trialSent') : mode === 'exam' ? t('exam.sent') : mode === 'practice' ? t('practice.sentToast') : t('submission.sentToast'), icon: 'i-lucide-check', color: 'success' })
}
function onSendError(e: unknown) {
  const c = code(e)
  const reason = (e as { data?: { data?: { details?: { reason?: string, n?: number } } } }).data?.data?.details?.reason
  const text = c === 'format_not_accepted' && reason ? t(`content.err.format.${reason}`) : message(e)
  toast.add({ title: text, color: 'error', icon: 'i-lucide-circle-alert' })
  // The state moved on (window, attempt, cohort, formats): the refetch shows what's possible now; the form keeps its contents
  if (['cohort_not_active', 'submission_pending', 'exam_not_open', 'exam_closed', 'attempt_used', 'trial_not_allowed', 'trial_limit', 'format_not_accepted'].includes(c ?? '')) refresh()
}

const latestTrial = computed(() => a.value?.trials[0])
const trialFiles = computed(() => latestTrial.value?.files.map(f => `${f.filename} (${formatBytes(f.size, locale.value)})`).join(', ') ?? '')
const MODE_ICON = { homework: 'i-lucide-notebook-pen', exam: 'i-lucide-timer', practice: 'i-lucide-dumbbell' } as const
</script>

<template>
  <AppPage :title="t('nav.assignments')" back="/assignments">
    <UEmpty
      v-if="error"
      icon="i-lucide-file-question"
      :title="error.statusCode === 404 ? t('assignment.notFound') : code(error) === 'lesson_locked' ? t('content.err.lesson_locked') : t('home.loadError')"
      :actions="[{ label: t('assignment.toList'), to: '/assignments', color: 'neutral', variant: 'outline' }]"
    />
    <HomeState v-else :status="status" :has-data="!!a" @retry="refresh()">
      <div v-if="a" class="mx-auto grid w-full max-w-6xl gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <p class="sr-only" aria-live="polite">{{ announce }}</p>
        <div class="min-w-0 space-y-8">
          <header class="space-y-3">
            <div class="flex flex-wrap items-center gap-2">
              <UBadge :label="t(`lesson.mode.${a.mode}`)" :icon="MODE_ICON[a.mode]" color="neutral" variant="outline" size="sm" />
              <StatusBadge v-if="a.mode !== 'practice'" :status="a.status" />
              <UBadge v-else-if="counted" :label="counted.feedback ? t('practice.commented') : t('practice.sent')" color="neutral" variant="subtle" size="sm" />
            </div>
            <h1 class="text-balance text-[1.75rem] font-semibold leading-tight tracking-tight text-highlighted">{{ a.title }}</h1>
          </header>

          <!-- Exam before the window: countdown, no statement -->
          <section v-if="examState === 'not_open'" class="rounded-lg bg-elevated p-5 ring-1 ring-inset ring-default sm:p-6" aria-labelledby="exam-opens">
            <p id="exam-opens" class="text-sm text-muted">{{ t('exam.opensIn') }}</p>
            <p class="num mt-1 min-h-9 text-[1.875rem] font-semibold leading-tight" :class="mounted && until(a.opensAt!) < 86_400_000 ? 'text-primary' : 'text-highlighted'">{{ mounted ? countdown(a.opensAt!) : '' }}</p>
            <p class="num mt-2 text-sm text-default">{{ windowText }}</p>
            <p v-if="yourTime" class="num text-xs text-muted">{{ yourTime }}</p>
            <p class="mt-3 max-w-prose text-sm text-muted">{{ t('exam.beforeNote') }}</p>
            <p v-if="stuck" class="mt-3 text-sm text-warning">{{ t('exam.reload') }}</p>
          </section>

          <template v-else>
            <MarkdownView v-if="a.statement" :source="a.statement" :files="a.files" :base="filesBase" />
            <div v-if="a.files.length" class="grid max-w-3xl gap-2 sm:grid-cols-2">
              <FileCard v-for="f in a.files" :key="f.id" :file="f" :base="filesBase" />
            </div>
          </template>

          <UAlert v-if="closedCohort" icon="i-lucide-lock" color="neutral" variant="subtle" :description="closedText" />

          <!-- Exam: open window, one attempt -->
          <template v-else-if="a.mode === 'exam'">
            <section v-if="examState === 'open' && (canSend || inFlight)" aria-labelledby="exam-submit" class="rounded-lg bg-elevated p-5 ring-1 ring-inset ring-default sm:p-6">
              <div class="flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="exam-submit" class="text-sm font-semibold text-highlighted">{{ t('exam.submitTitle') }}</h2>
                <p v-if="mounted && !windowOver" class="num text-sm" :class="until(a.closesAt!) < 15 * 60_000 ? 'text-primary' : 'text-muted'">{{ t('exam.closesIn', { value: countdown(a.closesAt!) }) }}</p>
              </div>
              <p class="mt-1 text-sm text-muted">{{ t('exam.onceNote') }}</p>
              <SubmitForm class="mt-5" :cohort-id="a.cohortId" :assignment-id="a.id" :accepts="a.accepts" :confirm-text="t('exam.confirmText')" :send-label="t('exam.send')" @sent="onSent()" @error="onSendError" @busy="v => (inFlight = v)" />
            </section>
            <UAlert v-else-if="examState === 'submitted'" icon="i-lucide-circle-check" color="success" variant="subtle" :description="t(counted!.isLate ? 'exam.submittedLate' : 'exam.submitted', { time: timeOf(counted!.submittedAt) })" />
            <UAlert v-else-if="examState === 'open'" icon="i-lucide-pause" color="neutral" variant="subtle" :description="t('exam.cantSubmit')" />
            <UAlert v-else-if="examState === 'missed'" icon="i-lucide-circle-x" color="neutral" variant="subtle" :description="t('exam.missed', { time: a.closesAt ? timeOf(a.closesAt) : '' })" />

            <!-- Trial: prove the upload works before the window; never counts -->
            <section v-if="a.trialEnabled && (a.canTrial || latestTrial) && examState === 'not_open'" aria-labelledby="trial-title" class="space-y-3 rounded-lg p-5 ring-1 ring-inset ring-default sm:p-6">
              <div class="flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="trial-title" class="text-sm font-semibold text-highlighted">{{ t('exam.trialTitle') }}</h2>
                <span class="num text-xs text-muted">{{ t('exam.trialsUsed', { n: a.trials.length }) }}</span>
              </div>
              <p class="text-sm text-muted">{{ t('exam.trialNote') }}</p>
              <UAlert v-if="latestTrial && mounted" icon="i-lucide-check" color="success" variant="subtle" :description="t('exam.trialReceived', { files: trialFiles || '—', time: dateTime(latestTrial.submittedAt) })" />
              <SubmitForm v-if="a.canTrial" :cohort-id="a.cohortId" :assignment-id="a.id" :accepts="a.accepts" trial :send-label="t('exam.trialSend')" @sent="onSent(true)" @error="onSendError" />
            </section>
          </template>

          <!-- Homework and practice -->
          <template v-else>
            <section v-if="canSend" aria-labelledby="submit-title" class="rounded-lg bg-elevated p-5 ring-1 ring-inset ring-default sm:p-6">
              <h2 id="submit-title" class="text-sm font-semibold text-highlighted">
                {{ a.mode === 'practice' ? (counted ? t('practice.again') : t('practice.submit')) : a.status === 'changes' ? t('submission.resubmit') : t('submission.submit') }}
              </h2>
              <p class="mt-1 text-sm text-muted">{{ a.mode === 'practice' ? t('practice.hint') : t('submission.hint') }}</p>
              <p v-if="a.mode === 'homework' && pastDue" class="mt-2 text-sm text-warning">{{ t('submission.lateNotice') }}</p>
              <SubmitForm class="mt-5" :cohort-id="a.cohortId" :assignment-id="a.id" :accepts="a.accepts" :send-label="a.mode === 'practice' ? t('practice.send') : undefined" @sent="onSent()" @error="onSendError" />
            </section>
            <UAlert
              v-else-if="a.status === 'waiting'"
              icon="i-lucide-hourglass"
              color="neutral"
              variant="subtle"
              :title="t('submission.waitingTitle')"
              :description="t('submission.waitingText', { mentor: a.mentor?.name ?? t('roles.mentor') })"
            />
          </template>

          <section v-if="a.submissions.length" aria-labelledby="history-title">
            <h2 id="history-title" class="mb-3 text-sm font-semibold text-highlighted">{{ t('submission.history') }}</h2>
            <SubmissionHistory :items="a.submissions" />
          </section>

          <!-- On phones the solutions follow the history -->
          <section v-if="a.solutions.length" class="space-y-4 lg:hidden" aria-labelledby="solutions-m">
            <h2 id="solutions-m" class="text-sm font-semibold text-highlighted">{{ t('solution.title') }}</h2>
            <MaterialBlock v-for="m in a.solutions" :key="m.id" :material="m" :base="solutionBase(m.id)" />
          </section>
        </div>

        <HomeRail>
          <section class="p-4" aria-labelledby="due-title">
            <h2 id="due-title" class="text-sm font-semibold text-highlighted">{{ a.mode === 'exam' ? t('exam.window') : t('assignment.due') }}</h2>
            <template v-if="a.mode === 'exam' && a.opensAt">
              <p class="num mt-3 text-sm text-highlighted">{{ windowText }}</p>
              <p v-if="yourTime" class="num mt-1 text-xs text-muted">{{ yourTime }}</p>
            </template>
            <template v-else-if="a.mode === 'homework' && a.dueAt">
              <p class="num mt-3 text-sm text-highlighted">{{ long(a.dueOn!) }}</p>
              <p v-if="mounted" class="num mt-1 text-xs" :class="pastDue ? 'text-muted' : until(a.dueAt) < 86_400_000 ? 'text-primary' : 'text-muted'">
                {{ pastDue ? t('assignment.pastDue') : t('time.in', { value: countdown(a.dueAt) }) }}
              </p>
            </template>
            <p v-else class="mt-3 text-sm text-muted">{{ a.mode === 'practice' ? t('practice.noDue') : t('assignment.noDue') }}</p>
          </section>
          <section class="p-4" aria-labelledby="who-title">
            <h2 id="who-title" class="text-sm font-semibold text-highlighted">{{ t('assignment.reviewer') }}</h2>
            <div v-if="a.mentor" class="mt-3 flex items-center gap-3">
              <UAvatar :src="a.mentor.avatar" :alt="a.mentor.name" />
              <div class="min-w-0">
                <p class="truncate text-sm text-highlighted">{{ a.mentor.name }}</p>
                <p class="num text-xs text-muted">{{ a.cohortName }}</p>
              </div>
            </div>
            <p v-else class="mt-3 text-sm text-muted">{{ t('home.mentorNone') }}</p>
          </section>
          <section v-if="a.solutions.length" class="hidden space-y-4 p-4 lg:block" aria-labelledby="solutions-d">
            <h2 id="solutions-d" class="text-sm font-semibold text-highlighted">{{ t('solution.title') }}</h2>
            <MaterialBlock v-for="m in a.solutions" :key="m.id" :material="m" :base="solutionBase(m.id)" />
          </section>
        </HomeRail>
      </div>
    </HomeState>
  </AppPage>
</template>
