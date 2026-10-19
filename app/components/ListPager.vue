<script setup lang="ts">
/** Pages under a ruled list: "21–40 of 57" and the page buttons; hidden while everything fits on one page */
const props = defineProps<{ total: number, size: number }>()
const page = defineModel<number>('page', { required: true })
const { t } = useI18n()
const from = computed(() => (page.value - 1) * props.size + 1)
const to = computed(() => Math.min(page.value * props.size, props.total))
</script>

<template>
  <div v-if="total > size" class="flex flex-wrap items-center justify-between gap-3">
    <p class="num text-xs text-muted" aria-live="polite">{{ t('list.range', { from, to, total }) }}</p>
    <UPagination v-model:page="page" :total="total" :items-per-page="size" :sibling-count="1" size="sm" color="neutral" variant="ghost" active-color="neutral" active-variant="subtle" />
  </div>
</template>
