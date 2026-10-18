<script setup lang="ts">
export interface CoursePagerLink {
  title: string
  /** null: not open yet (shown, not a link) */
  to: string | null
  /** Why it isn't a link, e.g. "opens 24 Oct" */
  note?: string
}
export interface CoursePagerLinks { prev: CoursePagerLink | null, next: CoursePagerLink | null }

/**
 * Previous / next at the end of a lesson or course page (spec course-content.md, Lesson page 5). `bar`: the phone
 * version, a sticky bottom bar with the two buttons and "Contents".
 */
const props = defineProps<{ links: CoursePagerLinks, bar?: boolean }>()
const emit = defineEmits<{ contents: [] }>()
const { t } = useI18n()
const NuxtLink = resolveComponent('NuxtLink')
const sides = computed(() => ([['prev', props.links.prev], ['next', props.links.next]] as const))
</script>

<template>
  <nav v-if="bar" :aria-label="t('pager.label')" class="flex items-center gap-2 border-t border-default bg-default px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
    <UButton
      :to="links.prev?.to ?? undefined"
      :disabled="!links.prev?.to"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      :aria-label="links.prev ? t('pager.prevTitle', { title: links.prev.title }) : t('pager.prev')"
    />
    <UButton :label="t('course.contents')" icon="i-lucide-list" color="neutral" variant="outline" class="flex-1 justify-center" @click="emit('contents')" />
    <UButton
      :to="links.next?.to ?? undefined"
      :disabled="!links.next?.to"
      trailing-icon="i-lucide-arrow-right"
      color="neutral"
      variant="ghost"
      :aria-label="links.next ? (links.next.to ? t('pager.nextTitle', { title: links.next.title }) : `${t('pager.nextTitle', { title: links.next.title })}, ${links.next.note}`) : t('pager.next')"
    />
  </nav>

  <nav v-else-if="links.prev || links.next" :aria-label="t('pager.label')" class="grid grid-cols-2 divide-x divide-default overflow-hidden rounded-lg ring-1 ring-inset ring-default">
    <template v-for="[side, l] in sides" :key="side">
      <component
        :is="l?.to ? NuxtLink : 'div'"
        v-if="l"
        :to="l.to ?? undefined"
        class="group flex min-w-0 flex-col gap-1 px-4 py-3"
        :class="[side === 'next' && 'col-start-2 items-end text-end', l.to && 'transition-colors duration-150 ease-out hover:bg-elevated']"
        :rel="l.to ? side : undefined"
      >
        <span class="inline-flex items-center gap-1 text-xs text-muted">
          <UIcon v-if="side === 'prev'" name="i-lucide-arrow-left" class="size-3.5 transition-transform duration-150 ease-out group-hover:-translate-x-0.5" aria-hidden="true" />
          {{ t(`pager.${side}`) }}
          <UIcon v-if="side === 'next'" :name="l.to ? 'i-lucide-arrow-right' : 'i-lucide-lock'" class="size-3.5 transition-transform duration-150 ease-out group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
        <span class="w-full truncate text-sm" :class="l.to ? 'text-highlighted' : 'text-muted'">{{ l.title }}</span>
        <span v-if="!l.to && l.note" class="num text-xs text-muted">{{ l.note }}</span>
      </component>
      <div v-else :class="side === 'next' && 'col-start-2'" />
    </template>
  </nav>
</template>
