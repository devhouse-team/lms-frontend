<script setup lang="ts">
import { z } from 'zod'

definePageMeta({ roles: ['mentee'] })

const route = useRoute()
const { t, locale } = useI18n()
const toast = useToast()
const { left, urgent } = useCountdown()

const id = computed(() => String(route.params.id))
const { data, status, error, refresh } = await useFetch(() => `/api/assignments/${id.value}`)
useHead({ title: () => `${data.value?.title ?? t('nav.assignments')} · dev.house` })

const fmt = (iso: string) => new Intl.DateTimeFormat(locale.value, { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const canSubmit = computed(() => data.value && (data.value.status === 'not_submitted' || data.value.status === 'changes'))
const pastDue = computed(() => !!data.value?.dueAt && new Date(data.value.dueAt).getTime() < Date.now())

const schema = computed(() => z.object({
  url: z.string().trim().min(1, t('submission.err.urlRequired')).url(t('submission.err.url')).refine(u => /^https?:\/\//i.test(u), t('submission.err.url')),
  note: z.string().max(2000, t('submission.err.note')).optional()
}))
const state = reactive({ url: '', note: '' })
const sending = ref(false)

async function onSubmit() {
  sending.value = true
  try {
    await $fetch(`/api/assignments/${id.value}/submissions`, { method: 'POST', body: { url: state.url.trim(), note: state.note.trim() || undefined } })
    state.url = ''
    state.note = ''
    await refresh()
    refreshNuxtData('dashboard-mentee')
    toast.add({ title: t('submission.sentToast'), icon: 'i-lucide-check', color: 'success' })
  } catch (e) {
    const code = (e as { statusCode?: number })?.statusCode
    toast.add({ title: code === 409 ? t('submission.err.conflict') : t('common.saveError'), color: 'error', icon: 'i-lucide-circle-alert' })
    if (code === 409) refresh()
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <AppPage :title="t('nav.assignments')" back="/assignments">
    <UEmpty
      v-if="error"
      icon="i-lucide-file-question"
      :title="error.statusCode === 404 ? t('assignment.notFound') : t('home.loadError')"
      :actions="[{ label: t('assignment.toList'), to: '/assignments', color: 'neutral', variant: 'outline' }]"
    />
    <HomeState v-else :status="status" :has-data="!!data" @retry="refresh()">
      <div v-if="data" class="mx-auto grid w-full max-w-6xl gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div class="min-w-0 space-y-8">
          <header class="space-y-3">
            <StatusBadge :status="data.status" />
            <h1 class="text-balance text-[1.75rem] font-semibold leading-tight tracking-tight text-highlighted">{{ data.title }}</h1>
            <p class="max-w-prose whitespace-pre-line text-sm text-default">{{ data.description }}</p>
          </header>

          <section v-if="canSubmit" aria-labelledby="submit-title" class="rounded-lg bg-elevated p-5 ring-1 ring-inset ring-default sm:p-6">
            <h2 id="submit-title" class="text-sm font-semibold text-highlighted">
              {{ data.status === 'changes' ? t('submission.resubmit') : t('submission.submit') }}
            </h2>
            <p class="mt-1 text-sm text-muted">{{ t('submission.hint') }}</p>
            <UForm :schema="schema" :state="state" class="mt-5 space-y-4" @submit="onSubmit">
              <UFormField :label="t('submission.url')" name="url">
                <UInput v-model="state.url" type="url" inputmode="url" placeholder="https://github.com/…" size="lg" class="w-full" />
              </UFormField>
              <UFormField :label="t('submission.note')" name="note" :hint="t('common.optional')">
                <UTextarea v-model="state.note" :rows="3" autoresize :placeholder="t('submission.notePlaceholder')" class="w-full" />
              </UFormField>
              <UButton type="submit" :label="t('submission.send')" icon="i-lucide-send" color="primary" size="lg" :loading="sending" />
            </UForm>
          </section>

          <UAlert
            v-else-if="data!.status === 'waiting'"
            icon="i-lucide-hourglass"
            color="neutral"
            variant="subtle"
            :title="t('submission.waitingTitle')"
            :description="t('submission.waitingText', { mentor: data!.mentor?.name ?? t('roles.mentor') })"
          />

          <section v-if="data!.submissions.length" aria-labelledby="history-title">
            <h2 id="history-title" class="mb-3 text-sm font-semibold text-highlighted">{{ t('submission.history') }}</h2>
            <SubmissionHistory :items="data!.submissions" />
          </section>
        </div>

        <HomeRail>
          <section class="p-4" aria-labelledby="due-title">
            <h2 id="due-title" class="text-sm font-semibold text-highlighted">{{ t('assignment.due') }}</h2>
            <template v-if="data!.dueAt">
              <p class="num mt-3 text-sm text-highlighted">{{ fmt(data!.dueAt) }}</p>
              <p class="num mt-1 text-xs" :class="pastDue ? 'text-muted' : urgent(data!.dueAt) ? 'text-primary' : 'text-muted'">
                {{ pastDue ? t('assignment.pastDue') : t('time.in', { value: left(data!.dueAt) }) }}
              </p>
            </template>
            <p v-else class="mt-3 text-sm text-muted">{{ t('assignment.noDue') }}</p>
          </section>
          <section class="p-4" aria-labelledby="who-title">
            <h2 id="who-title" class="text-sm font-semibold text-highlighted">{{ t('assignment.reviewer') }}</h2>
            <div v-if="data!.mentor" class="mt-3 flex items-center gap-3">
              <UAvatar :src="data!.mentor.avatar" :alt="data!.mentor.name" />
              <div class="min-w-0">
                <p class="truncate text-sm text-highlighted">{{ data!.mentor.name }}</p>
                <p class="num text-xs text-muted">{{ data!.cohortName }}</p>
              </div>
            </div>
            <p v-else class="mt-3 text-sm text-muted">{{ t('home.mentorNone') }}</p>
          </section>
        </HomeRail>
      </div>
    </HomeState>
  </AppPage>
</template>
