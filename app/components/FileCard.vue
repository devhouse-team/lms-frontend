<script setup lang="ts">
import type { FileMeta } from '~~/shared/types'

/** A file as a ruled card: type icon, name, size, "View" when it opens inline, "Download" always. Links go to Nitro. */
const props = defineProps<{ file: FileMeta, base: string }>()
const { t, locale } = useI18n()
const kind = computed(() => fileKind(props.file.filename))
const href = computed(() => `${props.base}/${props.file.id}`)
const size = computed(() => formatBytes(props.file.size, locale.value))
</script>

<template>
  <div class="flex items-center gap-3 rounded-lg px-3 py-2.5 ring-1 ring-inset ring-default">
    <UIcon :name="kind.icon" class="size-5 shrink-0 text-muted" aria-hidden="true" />
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm text-highlighted" :title="file.filename">{{ file.filename }}</p>
      <p class="text-xs text-muted"><span class="num">{{ size }}</span> · {{ kind.label }}</p>
    </div>
    <UButton v-if="file.viewable" :to="href" target="_blank" external :label="t('content.view')" color="neutral" variant="ghost" size="xs" />
    <UButton :to="`${href}?download=1`" external :label="t('content.download')" icon="i-lucide-download" color="neutral" variant="outline" size="xs" />
  </div>
</template>
