<script setup lang="ts">
import type { CourseOutlineView } from '~~/shared/types'

/**
 * The course's contents rail (DESIGN.md, Course Contents Rail): course pages, then modules as disclosures with their
 * lessons. Locked lessons aren't links for students; staff read ahead. State comes from the outline only.
 */
const props = defineProps<{ outline: CourseOutlineView, lessonId?: string, pageId?: string }>()
const emit = defineEmits<{ navigate: [] }>()
const { t } = useI18n()
const NuxtLink = resolveComponent('NuxtLink')
const { short } = useCohortFormat()

const base = computed(() => `/courses/${props.outline.cohort.id}/${props.outline.id}`)
/** Expanded: the current module and the next one (else the first open module and the next) */
const open = ref(new Set<string>())
watch(() => [props.outline, props.lessonId], () => {
  const mods = props.outline.modules
  let i = mods.findIndex(m => m.lessons.some(l => l.id === props.lessonId))
  if (i < 0) i = Math.max(0, mods.findLastIndex(m => m.lessons.some(l => l.isReleased)))
  open.value = new Set([mods[i]?.id, mods[i + 1]?.id].filter((x): x is string => !!x))
}, { immediate: true })
const toggle = (id: string) => (open.value.has(id) ? open.value.delete(id) : open.value.add(id))
</script>

<template>
  <nav :aria-label="t('course.contents')" class="space-y-4 text-sm">
    <ul v-if="outline.pages.length" class="space-y-0.5">
      <li v-for="p in outline.pages" :key="p.id">
        <NuxtLink
          v-if="p.isReleased || outline.staff"
          :to="`${base}/pages/${p.id}`"
          class="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors duration-150 ease-out hover:bg-elevated"
          :class="p.id === pageId ? 'bg-elevated text-highlighted' : 'text-default'"
          :aria-current="p.id === pageId ? 'page' : undefined"
          @click="emit('navigate')"
        >
          <UIcon name="i-lucide-file-text" class="size-4 shrink-0" :class="p.id === pageId ? 'text-primary' : 'text-dimmed'" aria-hidden="true" />
          <span class="min-w-0 truncate">{{ p.title }}</span>
        </NuxtLink>
      </li>
    </ul>

    <div v-for="m in outline.modules" :key="m.id">
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start font-medium text-highlighted hover:bg-elevated"
        :aria-expanded="open.has(m.id)"
        @click="toggle(m.id)"
      >
        <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed transition-transform duration-150 ease-out" :class="open.has(m.id) && 'rotate-90'" aria-hidden="true" />
        <span class="min-w-0 flex-1 truncate">{{ m.title }}</span>
        <span v-if="m.releasedOn > todayUtc()" class="num shrink-0 text-xs font-normal text-muted">{{ t('course.opensShort', { date: short(m.releasedOn) }) }}</span>
      </button>
      <ul v-show="open.has(m.id)" class="mt-0.5 space-y-0.5">
        <li v-for="l in m.lessons" :key="l.id">
          <component
            :is="l.isReleased || outline.staff ? NuxtLink : 'div'"
            :to="l.isReleased || outline.staff ? `${base}/lessons/${l.id}` : undefined"
            class="flex items-start gap-2 rounded-md py-1.5 ps-8 pe-2"
            :class="[
              l.id === lessonId ? 'bg-elevated text-highlighted' : l.isReleased ? 'text-default' : 'text-muted',
              (l.isReleased || outline.staff) && 'transition-colors duration-150 ease-out hover:bg-elevated'
            ]"
            :aria-current="l.id === lessonId ? 'page' : undefined"
            :aria-disabled="!l.isReleased && !outline.staff ? 'true' : undefined"
            @click="emit('navigate')"
          >
            <UIcon
              :name="!l.isReleased ? 'i-lucide-lock' : l.completed ? 'i-lucide-circle-check' : 'i-lucide-circle'"
              class="mt-0.5 size-4 shrink-0"
              :class="l.id === lessonId ? 'text-primary' : l.completed ? 'text-success' : 'text-dimmed'"
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1">
              <span class="block truncate">{{ l.title }}</span>
              <span v-if="!l.isReleased" class="num block text-xs text-muted">
                {{ outline.staff ? t('course.notOpenForStudents') : t('course.opensOn', { date: short(l.releasedOn) }) }}
              </span>
              <span v-else-if="l.completed" class="sr-only">{{ t('course.done') }}</span>
            </span>
            <span v-if="l.isReleased && openDeadline(l)" class="num shrink-0 text-xs text-muted">{{ t('course.due', { date: short(openDeadline(l)!.dueOn!) }) }}</span>
          </component>
        </li>
      </ul>
    </div>
  </nav>
</template>
