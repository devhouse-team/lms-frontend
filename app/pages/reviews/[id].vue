<script setup lang="ts">
definePageMeta({ roles: ['mentor'] })

const route = useRoute()
const { t, locale } = useI18n()
const toast = useToast()
const { ago, stale } = useCountdown()

const id = computed(() => String(route.params.id))
const { data, status, error, refresh } = await useFetch(() => `/api/reviews/${id.value}`)
useHead({ title: () => `${data.value?.assignment.title ?? t('nav.reviews')} · dev.house` })

const fmt = (iso: string) => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

const feedback = ref('')
const feedbackError = ref<string | null>(null)
const score = ref<number>()
const sending = ref<'accepted' | 'changes' | null>(null)
const { toastError } = useApiErrors('content')
/** Exams are graded once and practice only gets comments: neither can be sent back (review_decision_not_allowed) */
const canSendBack = computed(() => data.value?.mode === 'homework')
const scoreOk = computed(() => !data.value?.assignment.maxScore || score.value === undefined || (score.value >= 0 && score.value <= data.value.assignment.maxScore))

async function decide(verdict: 'accepted' | 'changes') {
  feedbackError.value = null
  if (verdict === 'changes' && feedback.value.trim().length < 2) {
    feedbackError.value = t('review.err.feedbackRequired')
    return
  }
  if (data.value?.mode === 'practice' && feedback.value.trim().length < 2) {
    feedbackError.value = t('review.err.commentRequired')
    return
  }
  if (!scoreOk.value) return
  sending.value = verdict
  try {
    await $fetch(`/api/reviews/${id.value}`, { method: 'POST', body: { verdict, feedback: feedback.value.trim() || undefined, ...(verdict === 'accepted' && score.value !== undefined ? { score: score.value } : {}) } })
    toast.add({ title: data.value?.mode === 'practice' ? t('review.commentedToast') : verdict === 'accepted' ? t('review.acceptedToast') : t('review.changesToast'), icon: 'i-lucide-check', color: 'success' })
    clearNuxtData(['dashboard-mentor', 'reviews'])
    // Move straight to the next oldest submission, if any
    const next = await $fetch('/api/reviews').then(r => r.waiting.find(w => w.id !== id.value)).catch(() => undefined)
    feedback.value = ''
    await navigateTo(next ? next.to : '/reviews')
  } catch (e) {
    const code = apiError(e).code
    if (code === 'not_reviewable') toast.add({ title: t('review.err.already'), color: 'error', icon: 'i-lucide-circle-alert' })
    else toastError(e)
    if (code === 'not_reviewable' || code === 'review_decision_not_allowed') refresh()
  } finally {
    sending.value = null
  }
}
</script>

<template>
  <AppPage :title="t('nav.reviews')" back="/reviews">
    <UEmpty
      v-if="error"
      icon="i-lucide-file-question"
      :title="error.statusCode === 404 ? t('review.notFound') : t('home.loadError')"
      :actions="[{ label: t('review.toList'), to: '/reviews', color: 'neutral', variant: 'outline' }]"
    />
    <HomeState v-else :status="status" :has-data="!!data" @retry="refresh()">
      <div v-if="data" class="mx-auto grid w-full max-w-6xl gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div class="min-w-0 space-y-8">
          <header class="space-y-3">
            <div class="flex flex-wrap items-center gap-2">
              <UBadge :label="t(`lesson.mode.${data.mode}`)" color="neutral" variant="outline" size="sm" />
              <StatusBadge :status="data.submission.status" />
              <UBadge v-if="data.submission.isLate" :label="t('review.late')" color="warning" variant="subtle" size="sm" />
              <span v-if="data.submission.status === 'waiting'" class="num text-xs" :class="stale(data.submission.submittedAt) ? 'text-primary' : 'text-muted'">
                {{ t('review.waitingFor', { value: ago(data.submission.submittedAt) }) }}
              </span>
              <span v-else-if="data.submission.reviewedAt" class="num text-xs text-muted">
                {{ t('review.reviewedOn', { date: fmt(data.submission.reviewedAt) }) }}
              </span>
            </div>
            <h1 class="text-balance text-[1.75rem] font-semibold leading-tight tracking-tight text-highlighted">{{ data.assignment.title }}</h1>
            <div class="flex items-center gap-2 text-sm text-muted">
              <UAvatar :src="data.mentee.avatar" :alt="data.mentee.name" size="xs" />
              <span class="text-highlighted">{{ data.mentee.name }}</span>
              <span>·</span>
              <span class="num">{{ data.cohortName }}</span>
            </div>
          </header>

          <section v-if="data.submission.status === 'waiting'" aria-labelledby="work-title" class="space-y-3">
            <h2 id="work-title" class="text-sm font-semibold text-highlighted">{{ t('review.work') }}</h2>
            <SubmissionHistory :items="[data.submission]" />
          </section>

          <section v-if="data.submission.status === 'waiting'" aria-labelledby="verdict-title" class="rounded-lg bg-elevated p-5 ring-1 ring-inset ring-default sm:p-6">
            <h2 id="verdict-title" class="text-sm font-semibold text-highlighted">{{ t('review.verdict') }}</h2>
            <p v-if="data.mode !== 'homework'" class="mt-1 text-sm text-muted">{{ t(`review.modeNote.${data.mode}`) }}</p>
            <UFormField v-if="data.assignment.maxScore && data.mode !== 'practice'" class="mt-4" :label="t('review.score', { max: data.assignment.maxScore })" :error="scoreOk ? undefined : t('review.err.score', { max: data.assignment.maxScore })">
              <UInputNumber v-model="score" :min="0" :max="data.assignment.maxScore" :step="0.5" class="w-36" />
            </UFormField>
            <UFormField class="mt-4" :label="t('review.feedback')" :help="canSendBack ? t('review.feedbackHelp') : undefined" :error="feedbackError ?? undefined" name="feedback">
              <MarkdownEditor v-model="feedback" mode="compact" :max-length="50000" :placeholder="t('review.feedbackPlaceholder')" />
            </UFormField>
            <div class="mt-5 flex flex-wrap gap-2">
              <UButton :label="data.mode === 'practice' ? t('review.leaveFeedback') : data.mode === 'exam' ? t('review.grade') : t('review.accept')" icon="i-lucide-check" color="primary" size="lg" :loading="sending === 'accepted'" :disabled="!!sending" @click="decide('accepted')" />
              <UButton v-if="canSendBack" :label="t('review.requestChanges')" icon="i-lucide-rotate-ccw" color="neutral" variant="outline" size="lg" :loading="sending === 'changes'" :disabled="!!sending" @click="decide('changes')" />
            </div>
          </section>
          <section v-else aria-labelledby="done-title">
            <h2 id="done-title" class="mb-3 text-sm font-semibold text-highlighted">{{ t('review.yourReview') }}</h2>
            <SubmissionHistory :items="[data.submission]" />
          </section>

          <section v-if="data.history.length" aria-labelledby="earlier-title">
            <h2 id="earlier-title" class="mb-3 text-sm font-semibold text-highlighted">{{ t('review.earlier') }}</h2>
            <SubmissionHistory :items="data.history" />
          </section>

          <section v-if="data.trials.length" aria-labelledby="trials-title">
            <h2 id="trials-title" class="mb-1 text-sm font-semibold text-highlighted">{{ t('review.trials') }}</h2>
            <p class="mb-3 text-xs text-muted">{{ t('review.trialsNote') }}</p>
            <SubmissionHistory :items="data.trials" />
          </section>
        </div>

        <HomeRail>
          <section class="p-4" aria-labelledby="task-title">
            <h2 id="task-title" class="text-sm font-semibold text-highlighted">{{ t('review.task') }}</h2>
            <MarkdownView v-if="data.assignment.statement" :source="data.assignment.statement" :files="data.assignment.files" :base="data.assignment.filesBase" class="mt-3 text-sm" />
            <div v-if="data.assignment.files.length" class="mt-3 space-y-2">
              <FileCard v-for="f in data.assignment.files" :key="f.id" :file="f" :base="data.assignment.filesBase" />
            </div>
            <p v-if="data.assignment.dueAt" class="num mt-3 text-xs text-muted">{{ t('review.due', { date: fmt(data.assignment.dueAt) }) }}</p>
          </section>
        </HomeRail>
      </div>
    </HomeState>
  </AppPage>
</template>
