<script setup lang="ts">
import type { MaterialView } from '~~/shared/types'

/**
 * One material in the reading column, viewer by kind (spec course-content.md, Lesson page). `base` is the Nitro file
 * route of this material. A locked material stays visible as a muted row with when it opens.
 */
/** `bare`: no title row (a course page shows its title as the page heading) */
const props = defineProps<{ material: MaterialView, base: string, bare?: boolean }>()
const { t } = useI18n()
const m = computed(() => props.material)
const file = computed(() => m.value.files[0])

/** PDF inline only with a fine pointer from md, never on iOS/Android (one page / no viewer there) */
const inlinePdf = ref(false)
onMounted(() => {
  inlinePdf.value = matchMedia('(pointer: fine) and (min-width: 768px)').matches && !/iPad|iPhone|iPod|Android/.test(navigator.userAgent)
})

const lock = useLockText()
const lockText = computed(() => lock(m.value))
const host = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}
</script>

<template>
  <section :id="`m-${m.id}`" class="scroll-mt-20 space-y-3" :aria-labelledby="bare ? undefined : `mt-${m.id}`">
    <div v-if="!bare" class="flex flex-wrap items-center gap-2">
      <h2 :id="`mt-${m.id}`" class="text-sm font-semibold text-highlighted">{{ m.title }}</h2>
      <UBadge v-for="tag in m.tags" :key="tag" :label="t(`material.tag.${tag}`)" color="neutral" variant="subtle" size="sm" />
    </div>

    <div v-if="!m.isReleased" class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted ring-1 ring-inset ring-default">
      <UIcon name="i-lucide-lock" class="size-4 shrink-0" aria-hidden="true" />
      {{ lockText }}
    </div>

    <MarkdownView v-else-if="m.kind === 'markdown'" :source="m.body ?? ''" :files="m.files" :base="base" />

    <template v-else-if="m.kind === 'pdf' && file">
      <div v-if="inlinePdf" class="max-w-3xl overflow-hidden rounded-lg ring-1 ring-inset ring-default">
        <div class="flex items-center gap-2 border-b border-default px-3 py-1.5 text-xs text-muted">
          <span class="min-w-0 flex-1 truncate">{{ file.filename }}</span>
          <UButton :to="`${base}/${file.id}`" target="_blank" external :label="t('content.openTab')" color="neutral" variant="ghost" size="xs" />
          <UButton :to="`${base}/${file.id}?download=1`" external :label="t('content.download')" icon="i-lucide-download" color="neutral" variant="ghost" size="xs" />
        </div>
        <iframe :src="`${base}/${file.id}`" :title="m.title" class="h-[80vh] w-full bg-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary" loading="lazy" />
      </div>
      <FileCard v-else :file="file" :base="base" class="max-w-3xl" />
      <MarkdownView v-if="m.body" :source="m.body" :files="m.files" :base="base" />
    </template>

    <template v-else-if="m.kind === 'video'">
      <VideoEmbed v-if="m.embedUrl && isEmbedUrl(m.embedUrl)" :src="m.embedUrl" :title="m.title" />
      <UButton v-else-if="m.url" :to="m.url" target="_blank" external :label="t('material.openVideo')" icon="i-lucide-play" color="neutral" variant="outline" />
      <div v-if="m.files.length" class="max-w-3xl space-y-2">
        <FileCard v-for="f in m.files" :key="f.id" :file="f" :base="base" />
      </div>
      <MarkdownView v-if="m.body" :source="m.body" :files="m.files" :base="base" />
    </template>

    <template v-else-if="m.kind === 'file'">
      <div class="max-w-3xl space-y-2">
        <FileCard v-for="f in m.files" :key="f.id" :file="f" :base="base" />
      </div>
      <MarkdownView v-if="m.body" :source="m.body" :files="m.files" :base="base" />
    </template>

    <template v-else-if="m.kind === 'link' && m.url">
      <a
        :href="m.url"
        target="_blank"
        rel="noopener noreferrer"
        class="group flex max-w-3xl items-center gap-3 rounded-lg px-3 py-2.5 ring-1 ring-inset ring-default transition-colors duration-150 ease-out hover:bg-elevated"
      >
        <UIcon name="i-lucide-link" class="size-5 shrink-0 text-muted" aria-hidden="true" />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm text-highlighted">{{ m.title }}</span>
          <span class="num block truncate text-xs text-muted">{{ host(m.url) }}</span>
        </span>
        <UIcon name="i-lucide-arrow-up-right" class="size-4 shrink-0 text-dimmed transition-transform duration-150 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </a>
      <MarkdownView v-if="m.body" :source="m.body" />
    </template>

    <template v-else-if="m.kind === 'image' && file">
      <a :href="`${base}/${file.id}`" target="_blank" rel="noopener" class="block max-w-3xl">
        <img :src="`${base}/${file.id}`" :alt="m.title" loading="lazy" class="max-w-full rounded-md">
      </a>
      <MarkdownView v-if="m.body" :source="m.body" class="text-sm text-muted" />
    </template>
  </section>
</template>
