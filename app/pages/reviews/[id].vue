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
const sending = ref<'accepted' | 'changes' | null>(null)

async function decide(verdict: 'accepted' | 'changes') {
  feedbackError.value = null
  if (verdict === 'changes' && feedback.value.trim().length < 2) {
    feedbackError.value = t('review.err.feedbackRequired')
    return
  }
  sending.value = verdict
  try {
    await $fetch(`/api/reviews/${id.value}`, { method: 'POST', body: { verdict, feedback: feedback.value.trim() || undefined } })
    toast.add({ title: verdict === 'accepted' ? t('review.acceptedToast') : t('review.changesToast'), icon: 'i-lucide-check', color: 'success' })
    clearNuxtData(['dashboard-mentor', 'reviews'])
    // Move straight to the next oldest submission, if any
    const next = await $fetch('/api/reviews').then(r => r.waiting.find(w => w.id !== id.value)).catch(() => undefined)
    feedback.value = ''
    await navigateTo(next ? next.to : '/reviews')
  } catch (e) {
    const code = (e as { statusCode?: number })?.statusCode
    toast.add({ title: code === 409 ? t('review.err.already') : t('common.saveError'), color: 'error', icon: 'i-lucide-circle-alert' })
    if (code === 409) refresh()
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
              <StatusBadge :status="data.submission.status" />
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
            <a
              :href="data.submission.url"
              target="_blank"
              rel="noopener noreferrer"
              class="group flex items-center gap-3 rounded-lg px-4 py-3 ring-1 ring-inset ring-default transition-colors duration-150 ease-out hover:bg-elevated"
            >
              <UIcon name="i-simple-icons-github" class="size-4 shrink-0 text-muted" />
              <span class="num min-w-0 flex-1 truncate text-sm text-highlighted">{{ data.submission.url.replace(/^https?:\/\//, '') }}</span>
              <UIcon name="i-lucide-arrow-up-right" class="size-4 shrink-0 text-dimmed transition-transform duration-150 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
            <p v-if="data.submission.note" class="max-w-prose whitespace-pre-line rounded-md bg-muted p-3 text-sm text-default">{{ data.submission.note }}</p>
          </section>

          <section v-if="data.submission.status === 'waiting'" aria-labelledby="verdict-title" class="rounded-lg bg-elevated p-5 ring-1 ring-inset ring-default sm:p-6">
            <h2 id="verdict-title" class="text-sm font-semibold text-highlighted">{{ t('review.verdict') }}</h2>
            <UFormField class="mt-4" :label="t('review.feedback')" :help="t('review.feedbackHelp')" :error="feedbackError ?? undefined" name="feedback">
              <UTextarea v-model="feedback" :rows="5" autoresize :placeholder="t('review.feedbackPlaceholder')" class="w-full" />
            </UFormField>
            <div class="mt-5 flex flex-wrap gap-2">
              <UButton :label="t('review.accept')" icon="i-lucide-check" color="primary" size="lg" :loading="sending === 'accepted'" :disabled="!!sending" @click="decide('accepted')" />
              <UButton :label="t('review.requestChanges')" icon="i-lucide-rotate-ccw" color="neutral" variant="outline" size="lg" :loading="sending === 'changes'" :disabled="!!sending" @click="decide('changes')" />
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
        </div>

        <HomeRail>
          <section class="p-4" aria-labelledby="task-title">
            <h2 id="task-title" class="text-sm font-semibold text-highlighted">{{ t('review.task') }}</h2>
            <p class="mt-3 whitespace-pre-line text-sm text-default">{{ data.assignment.description }}</p>
            <p v-if="data.assignment.dueAt" class="num mt-3 text-xs text-muted">{{ t('review.due', { date: fmt(data.assignment.dueAt) }) }}</p>
          </section>
        </HomeRail>
      </div>
    </HomeState>
  </AppPage>
</template>
