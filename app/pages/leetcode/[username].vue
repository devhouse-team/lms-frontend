<script setup lang="ts">
import type { ContestProfile } from '~~/shared/types'

definePageMeta({ roles: ['mentee', 'mentor', 'head'] })

const { t } = useI18n()
const route = useRoute()
const username = computed(() => String(route.params.username))
// Same key as ContestProgress: one request feeds both
const { data: profile } = useFetch<ContestProfile>(() => `/api/contests/users/${encodeURIComponent(username.value)}`, {
  key: () => `contest-profile-${username.value}`, server: false, lazy: true
})
useHead({ title: () => `${profile.value?.name ?? username.value} · ${t('contest.profileTitle')} · dev.house` })
</script>

<template>
  <AppPage :title="t('contest.profileTitle')">
    <div class="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <NuxtLink to="/contest" class="text-sm text-muted hover:text-highlighted">← {{ t('nav.contest') }}</NuxtLink>
        <h1 class="mt-2 text-2xl font-semibold tracking-tight text-highlighted">{{ profile?.name ?? username }}</h1>
        <p class="num mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted">
          <span>@{{ username }}</span>
          <a
            v-if="profile"
            :href="`https://leetcode.com/u/${encodeURIComponent(profile.leetcodeId)}`"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-1 hover:text-highlighted hover:underline"
          >{{ t('contest.leetcodeProfile') }}: {{ profile.leetcodeId }}<UIcon name="i-lucide-external-link" class="size-3.5" /></a>
          <span v-if="profile?.place">{{ t('contest.lmsPlace', { n: profile.place }) }}</span>
        </p>
      </header>
      <ContestProgress :username="username" />
    </div>
  </AppPage>
</template>
