<script setup lang="ts">
import type { CourseOutlineView } from '~~/shared/types'

/**
 * The course's contents rail (DESIGN.md, Course Contents Rail): course pages, then modules as disclosures with their
 * lessons, then "Materials by type" and "Calendar". Locked lessons aren't links for students; staff read ahead.
 * State comes from the outline only.
 */
const props = defineProps<{ outline: CourseOutlineView, lessonId?: string, pageId?: string, byType?: boolean }>()
const emit = defineEmits<{ navigate: [] }>()
const { t, locale } = useI18n()
const NuxtLink = resolveComponent('NuxtLink')
const examTime = (iso: string) => new Intl.DateTimeFormat(locale.value, { timeZone: props.outline.cohort.timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const { short } = useCohortFormat()

const base = computed(() => `/courses/${props.outline.cohort.id}/${props.outline.id}`)
const footer = computed(() => [
  { to: `${base.value}/materials`, icon: 'i-lucide-layers', label: t('byType.title'), current: props.byType },
  { to: `/calendar?cohort=${props.outline.cohort.id}`, icon: 'i-lucide-calendar-days', label: t('calendar.title'), current: false }
])
/**
 * Expanded: the current module and the next one (else the last open module and the next); what the reader opened or
 * closed is kept per course for the tab's session, and the current lesson's module always opens.
 */
const open = ref(new Set<string>())
/** sessionStorage only after mount: the server and the hydrating client render the defaults alike */
const mounted = ref(false)
const storeKey = computed(() => `course-open:${props.outline.id}`)
function stored(): string[] | null {
  try {
    return JSON.parse(sessionStorage.getItem(storeKey.value) ?? 'null')
  } catch {
    return null
  }
}
function restore() {
  const mods = props.outline.modules
  const current = mods.findIndex(m => m.lessons.some(l => l.id === props.lessonId))
  const i = current >= 0 ? current : Math.max(0, mods.findLastIndex(m => m.lessons.some(l => l.isReleased)))
  const kept = mounted.value ? stored() : null
  open.value = new Set([...(kept ?? [mods[i]?.id, mods[i + 1]?.id]), current >= 0 ? mods[current]!.id : undefined].filter((x): x is string => !!x))
}
watch(() => [props.outline, props.lessonId], restore, { immediate: true })
onMounted(() => {
  mounted.value = true
  restore()
})
function toggle(id: string) {
  if (open.value.has(id)) open.value.delete(id)
  else open.value.add(id)
  try {
    sessionStorage.setItem(storeKey.value, JSON.stringify([...open.value]))
  } catch { /* private mode: not remembered */ }
}
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
            <span v-if="l.isReleased && openDeadline(l)" class="num shrink-0 text-xs text-muted">
              {{ openDeadline(l)!.kind === 'exam' ? t('course.examAt', { time: examTime(openDeadline(l)!.at) }) : t('course.due', { date: short(openDeadline(l)!.at) }) }}
            </span>
          </component>
        </li>
      </ul>
    </div>

    <ul class="space-y-0.5 border-t border-default pt-3">
      <li v-for="l in footer" :key="l.to">
        <NuxtLink
          :to="l.to"
          class="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors duration-150 ease-out hover:bg-elevated"
          :class="l.current ? 'bg-elevated text-highlighted' : 'text-default'"
          :aria-current="l.current ? 'page' : undefined"
          @click="emit('navigate')"
        >
          <UIcon :name="l.icon" class="size-4 shrink-0" :class="l.current ? 'text-primary' : 'text-dimmed'" aria-hidden="true" />
          <span class="min-w-0 truncate">{{ l.label }}</span>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
