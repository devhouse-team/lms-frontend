<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const { t } = useI18n()
const forbidden = computed(() => props.error.statusCode === 403)
const notFound = computed(() => props.error.statusCode === 404)
</script>

<template>
  <UApp>
    <div class="flex min-h-dvh items-center justify-center bg-default px-5">
      <div class="max-w-sm">
        <p class="num text-sm text-muted">{{ error.statusCode }}</p>
        <h1 class="mt-2 text-2xl font-semibold tracking-tight text-highlighted">
          {{ forbidden ? t('errors.forbidden') : notFound ? t('errors.notFound') : t('errors.generic') }}
        </h1>
        <p class="mt-2 text-sm text-muted">{{ forbidden ? t('errors.forbiddenText') : t('errors.genericText') }}</p>
        <UButton class="mt-6" :label="t('common.toHome')" color="neutral" variant="outline" @click="clearError({ redirect: '/' })" />
      </div>
    </div>
  </UApp>
</template>
