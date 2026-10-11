<script setup lang="ts">
definePageMeta({ roles: ['mentee'] })

const { t } = useI18n()
const toast = useToast()
useHead({ title: () => `${t('nav.career')} · dev.house` })

// Career steps live on the mentee dashboard payload; reuse its cache key
const { data, status, refresh } = await useFetch('/api/dashboard/mentee', { key: 'dashboard-mentee' })
const done = computed(() => data.value?.career.filter(s => s.done).length ?? 0)

async function toggle(id: string) {
  const s = data.value?.career.find(x => x.id === id)
  if (!s) return
  s.done = !s.done
  try {
    await $fetch(`/api/career/${id}`, { method: 'PATCH', body: { done: s.done } })
  } catch {
    s.done = !s.done
    toast.add({ title: t('common.saveError'), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}
</script>

<template>
  <AppPage :title="t('nav.career')">
    <HomeState :status="status" :has-data="!!data" @retry="refresh()">
      <div v-if="data" class="mx-auto w-full max-w-2xl space-y-6">
        <header>
          <h1 class="text-xl font-semibold tracking-tight text-highlighted">{{ t('career.title') }}</h1>
          <p class="mt-1 max-w-prose text-sm text-muted">{{ t('career.subtitle') }}</p>
          <p class="num mt-2 text-xs text-muted">{{ t('home.careerDone', { done, total: data.career.length }) }}</p>
        </header>
        <ul class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
          <li v-for="s in data.career" :key="s.id">
            <label class="flex cursor-pointer items-start gap-3 px-4 py-3.5 transition-colors duration-150 ease-out first:rounded-t-lg last:rounded-b-lg hover:bg-elevated">
              <UCheckbox :model-value="s.done" class="mt-0.5" @update:model-value="toggle(s.id)" />
              <span class="min-w-0">
                <span class="block text-sm" :class="s.done ? 'text-muted line-through decoration-dimmed' : 'text-highlighted'">{{ t(`careerSteps.${s.id}`) }}</span>
                <span class="mt-0.5 block text-xs text-muted">{{ t(`careerHints.${s.id}`) }}</span>
              </span>
            </label>
          </li>
        </ul>
      </div>
    </HomeState>
  </AppPage>
</template>
