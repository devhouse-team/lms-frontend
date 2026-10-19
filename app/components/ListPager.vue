<script setup lang="ts">
/**
 * Pages under a ruled list: "21–40 of 57" and the page buttons; hidden while everything fits on one page. The buttons
 * are ours (slots) so their names are translated: the pagination primitive's own are English ("Page 2").
 */
const props = defineProps<{ total: number, size: number }>()
const page = defineModel<number>('page', { required: true })
const { t } = useI18n()
const from = computed(() => (page.value - 1) * props.size + 1)
const to = computed(() => Math.min(page.value * props.size, props.total))
const pages = computed(() => Math.ceil(props.total / props.size))
</script>

<template>
  <div v-if="total > size" class="flex flex-wrap items-center justify-between gap-3">
    <p class="num text-xs text-muted" aria-live="polite">{{ t('list.range', { from, to, total }) }}</p>
    <UPagination v-model:page="page" :total="total" :items-per-page="size" :sibling-count="1" size="sm">
      <template #first>
        <UButton icon="i-lucide-chevrons-left" color="neutral" variant="ghost" size="sm" :aria-label="t('list.first')" :disabled="page === 1" />
      </template>
      <template #prev>
        <UButton icon="i-lucide-chevron-left" color="neutral" variant="ghost" size="sm" :aria-label="t('list.prev')" :disabled="page === 1" />
      </template>
      <template #item="{ item }">
        <UButton
          v-if="item.type === 'page'"
          :label="String(item.value)"
          color="neutral"
          :variant="page === item.value ? 'subtle' : 'ghost'"
          size="sm"
          square
          class="num min-w-8 justify-center"
          :aria-label="t('list.page', { n: item.value })"
          :aria-current="page === item.value ? 'page' : undefined"
        />
      </template>
      <template #next>
        <UButton icon="i-lucide-chevron-right" color="neutral" variant="ghost" size="sm" :aria-label="t('list.next')" :disabled="page === pages" />
      </template>
      <template #last>
        <UButton icon="i-lucide-chevrons-right" color="neutral" variant="ghost" size="sm" :aria-label="t('list.last')" :disabled="page === pages" />
      </template>
    </UPagination>
  </div>
</template>
