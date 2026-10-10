<template>
  <UApp :locale="uiLocale">
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
import { ru, en } from '@nuxt/ui/locale'

const { locale } = useI18n()
const uiLocale = computed(() => (locale.value === 'ru' ? ru : en))
useHead({ htmlAttrs: { lang: computed(() => locale.value) } })
</script>
