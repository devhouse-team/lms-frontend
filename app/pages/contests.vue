<script setup lang="ts">
definePageMeta({ roles: ['head'] })

const { t, locale } = useI18n()
const toast = useToast()
const { left } = useCountdown()
useHead({ title: () => `${t('nav.contests')} · dev.house` })

const [{ data, status, refresh }, { data: entries, refresh: refreshEntries }] = await Promise.all([
  useFetch('/api/contests', { key: 'contests' }),
  useFetch('/api/contests/current/entries', { key: 'contest-entries', default: () => [] })
])

const fmt = (iso: string, withTime = true) => new Intl.DateTimeFormat(locale.value, withTime
  ? { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }
  : { day: 'numeric', month: 'long' }).format(new Date(iso))

// Editable copy of solved counts; null = not entered
const solved = ref<Record<string, number | null>>({})
watch(entries, (list) => {
  solved.value = Object.fromEntries((list ?? []).map(e => [e.mentee.id, e.solved]))
}, { immediate: true })

const problems = computed(() => data.value?.current?.problems ?? 4)
const filled = computed(() => Object.values(solved.value).filter(v => v !== null).length)
const saving = ref(false)

async function save() {
  saving.value = true
  try {
    const results = Object.entries(solved.value)
      .filter((e): e is [string, number] => e[1] !== null)
      .map(([menteeId, n]) => ({ menteeId, solved: Math.max(0, Math.min(problems.value, Math.round(n))) }))
    await $fetch('/api/contests/current/results', { method: 'POST', body: { results } })
    await Promise.all([refresh(), refreshEntries()])
    toast.add({ title: t('contest.saved', { n: results.length }), icon: 'i-lucide-check', color: 'success' })
  } catch {
    toast.add({ title: t('common.saveError'), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    saving.value = false
  }
}

const selected = ref(0)
const shown = computed(() => data.value?.past[selected.value])
</script>

<template>
  <AppPage mock :title="t('nav.contests')">
    <HomeState :status="status" :has-data="!!data" @retry="refresh()">
      <div v-if="data" class="mx-auto w-full max-w-4xl space-y-10">
        <section v-if="data.current" aria-labelledby="cur-title">
          <header class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 id="cur-title" class="text-xl font-semibold tracking-tight text-highlighted">{{ data.current.title }}</h1>
              <p class="num mt-1 text-sm text-muted">{{ fmt(data.current.at) }} · {{ t('home.contestIn') }} {{ left(data.current.at) }}</p>
            </div>
            <p class="num text-sm leading-7 text-muted">{{ t('head.contestRegistered', { n: data.current.registrations }) }}</p>
          </header>

          <div class="mt-5 rounded-lg ring-1 ring-inset ring-default">
            <div class="flex flex-wrap items-baseline justify-between gap-2 border-b border-default px-4 py-3">
              <h2 class="text-sm font-semibold text-highlighted">{{ t('contest.enter') }}</h2>
              <p class="num text-xs text-muted">{{ t('contest.filled', { n: filled, total: entries.length, problems }) }}</p>
            </div>
            <ul v-if="entries.length" class="divide-y divide-default">
              <li v-for="e in entries" :key="e.mentee.id" class="flex items-center gap-3 px-4 py-2">
                <UAvatar :src="e.mentee.avatar" :alt="e.mentee.name" size="xs" />
                <span class="min-w-0 flex-1 truncate text-sm text-highlighted">{{ e.mentee.name }}</span>
                <span class="num shrink-0 text-xs text-muted">{{ e.cohortName }}</span>
                <UInputNumber
                  v-model="solved[e.mentee.id]"
                  :min="0"
                  :max="problems"
                  :placeholder="'—'"
                  size="sm"
                  color="neutral"
                  :increment="{ color: 'neutral', variant: 'link' }"
                  :decrement="{ color: 'neutral', variant: 'link' }"
                  class="w-28"
                  :aria-label="t('contest.solvedFor', { name: e.mentee.name })"
                />
              </li>
            </ul>
            <p v-else class="px-4 py-6 text-sm text-muted">{{ t('contest.noEntries') }}</p>
            <div v-if="entries.length" class="flex justify-end border-t border-default px-4 py-3">
              <UButton :label="t('contest.save')" icon="i-lucide-save" color="primary" :loading="saving" :disabled="!filled" @click="save" />
            </div>
          </div>

          <div v-if="data.current.results?.length" class="mt-6">
            <h2 class="mb-3 text-sm font-semibold text-highlighted">{{ t('contest.standings') }}</h2>
            <ContestResults :rows="data.current.results" :problems="data.current.problems" />
          </div>
        </section>

        <section v-if="data.past.length" aria-labelledby="past-title">
          <div class="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="past-title" class="text-sm font-semibold text-highlighted">{{ t('contest.past') }}</h2>
            <div class="flex gap-1" role="tablist" :aria-label="t('contest.past')">
              <UButton
                v-for="(c, i) in data.past"
                :key="c.id"
                role="tab"
                :aria-selected="selected === i"
                :label="fmt(c.at, false)"
                size="xs"
                color="neutral"
                :variant="selected === i ? 'soft' : 'ghost'"
                class="num"
                @click="selected = i"
              />
            </div>
          </div>
          <ContestResults v-if="shown" :rows="shown.results ?? []" :problems="shown.problems" />
        </section>
      </div>
    </HomeState>
  </AppPage>
</template>
