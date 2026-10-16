<script setup lang="ts">
import type { ProgramCourse } from '~~/shared/types'

/**
 * The program's courses in order, each with its start week. Changes apply to new cohorts only (cohorts keep a copy).
 * Spec: programs.md, Curriculum.
 */
const props = defineProps<{
  programId: string
  courses: ProgramCourse[]
  weeksOfContent: number
  durationWeeks: number
  cohortsTotal: number
  editable: boolean
}>()
const emit = defineEmits<{ changed: [] }>()

const { t } = useI18n()
const toast = useToast()
const { toastError } = useProgramErrors()

/** Local order so a reorder shows at once; the page refetch brings the server's */
const rows = ref<ProgramCourse[]>([])
watch(() => props.courses, c => (rows.value = [...c]), { immediate: true })

/** offset → week (1-based) and day (1-7) */
const split = (offset: number) => ({ w: Math.floor(offset / 7) + 1, d: (offset % 7) + 1 })
function startLabel(offset: number) {
  if (offset === 0) return t('programs.curriculum.weekFirst')
  const { w, d } = split(offset)
  return d === 1 ? t('programs.curriculum.week', { w }) : t('programs.curriculum.weekDay', { w, d })
}

const busy = ref(false)
async function run(call: () => Promise<unknown>, done?: string) {
  busy.value = true
  try {
    await call()
    if (done) toast.add({ title: done, icon: 'i-lucide-check', color: 'success' })
  } catch (e) {
    toastError(e)
  } finally {
    busy.value = false
    emit('changed')
  }
}

function move(i: number, dir: -1 | 1) {
  const next = [...rows.value]
  ;[next[i], next[i + dir]] = [next[i + dir]!, next[i]!]
  rows.value = next
  run(() => $fetch(`/api/programs/${props.programId}/courses/order`, { method: 'PUT', body: { courseIds: next.map(c => c.courseId) } }))
}

// ---- change start (one popover open at a time) ---------------------------------
const editing = ref<string>()
const week = ref(1)
const day = ref(1)
function openStart(c: ProgramCourse, open: boolean) {
  editing.value = open ? c.courseId : undefined
  if (open) ({ w: week.value, d: day.value } = split(c.startOffsetDays))
}
const validStart = computed(() => Number.isInteger(week.value) && week.value >= 1 && week.value <= 104 && Number.isInteger(day.value) && day.value >= 1 && day.value <= 7)
function saveStart(c: ProgramCourse) {
  if (!validStart.value) return
  editing.value = undefined
  const offset = (week.value - 1) * 7 + (day.value - 1)
  if (offset === c.startOffsetDays) return
  run(() => $fetch(`/api/programs/${props.programId}/courses/${c.courseId}`, { method: 'PUT', body: { startOffsetDays: offset } }), t('programs.curriculum.startSaved'))
}

// ---- remove ---------------------------------------------------------------------
const removing = ref<ProgramCourse>()
const removeOpen = computed({ get: () => !!removing.value, set: (v) => { if (!v) removing.value = undefined } })
async function confirmRemove() {
  const c = removing.value!
  // Typed as a plain string: the typed-route match picks the sibling `courses/order` route, which has no DELETE
  const url: string = `/api/programs/${props.programId}/courses/${c.courseId}`
  await run(() => $fetch(url, { method: 'DELETE' }), t('programs.curriculum.removed'))
  removing.value = undefined
}

const adding = ref(false)

/** Content longer than the program, or 2+ weeks shorter */
const length = computed(() => {
  if (!props.courses.length) return undefined
  const x = props.weeksOfContent
  const d = props.durationWeeks
  return x > d ? 'longer' : d - x >= 2 ? 'shorter' : undefined
})
</script>

<template>
  <section class="space-y-4" aria-labelledby="curriculum-title">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 id="curriculum-title" class="text-base font-semibold text-highlighted">
        {{ t('programs.curriculum.title') }} <span class="num font-normal text-muted">{{ courses.length }}</span>
      </h2>
      <UButton v-if="editable" :label="t('programs.curriculum.add')" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" @click="adding = true" />
    </div>
    <p v-if="editable" class="max-w-prose text-sm text-muted">
      {{ [t('programs.curriculum.note'), cohortsTotal ? t('programs.curriculum.noteCohorts', cohortsTotal) : ''].join(' ') }}
    </p>

    <div v-if="!rows.length" class="rounded-lg px-4 py-8 text-center ring-1 ring-inset ring-default">
      <p class="mx-auto max-w-prose text-sm text-muted">{{ t('programs.curriculum.empty') }}</p>
      <UButton v-if="editable" :label="t('programs.curriculum.add')" icon="i-lucide-plus" class="mt-4" @click="adding = true" />
    </div>
    <ol v-else class="divide-y divide-default rounded-lg ring-1 ring-inset ring-default">
      <li v-for="(c, i) in rows" :key="c.courseId" class="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 sm:flex-nowrap">
        <span class="num w-5 shrink-0 text-end text-sm text-dimmed">{{ i + 1 }}</span>
        <div class="min-w-0 flex-1 basis-48">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-medium text-highlighted">{{ c.title }}</span>
            <UBadge v-if="!c.published" :label="t('programs.curriculum.unpublished')" color="warning" variant="subtle" size="sm" />
          </div>
          <p class="mt-0.5 text-xs" :class="c.modules ? 'text-muted' : 'text-warning'">
            {{ c.modules ? `${t('programs.modules', c.modules)} · ${t('programs.lessons', c.lessons)}` : t('programs.curriculum.noModules') }}
          </p>
        </div>
        <span class="ms-9 shrink-0 text-sm text-default sm:ms-0 sm:w-44">{{ startLabel(c.startOffsetDays) }}</span>
        <div v-if="editable" class="ms-auto flex shrink-0 items-center gap-0.5">
          <UButton icon="i-lucide-arrow-up" color="neutral" variant="ghost" size="xs" :aria-label="`${t('programs.moveUp')}: ${c.title}`" :disabled="i === 0 || busy" @click="move(i, -1)" />
          <UButton icon="i-lucide-arrow-down" color="neutral" variant="ghost" size="xs" :aria-label="`${t('programs.moveDown')}: ${c.title}`" :disabled="i === rows.length - 1 || busy" @click="move(i, 1)" />
          <UPopover :open="editing === c.courseId" @update:open="o => openStart(c, o)">
            <UButton icon="i-lucide-calendar-clock" color="neutral" variant="ghost" size="xs" :aria-label="`${t('programs.curriculum.changeStart')}: ${c.title}`" :disabled="busy" />
            <template #content>
              <form class="flex items-end gap-3 p-3" @submit.prevent="saveStart(c)">
                <UFormField :label="t('programs.curriculum.startWeek')">
                  <UInputNumber v-model="week" :min="1" :max="104" class="w-24" autofocus />
                </UFormField>
                <UFormField :label="t('programs.curriculum.startDay')">
                  <UInputNumber v-model="day" :min="1" :max="7" class="w-20" />
                </UFormField>
                <UButton type="submit" :label="t('common.save')" size="sm" :disabled="!validStart" />
              </form>
            </template>
          </UPopover>
          <UButton icon="i-lucide-trash-2" color="neutral" variant="ghost" size="xs" :aria-label="`${t('programs.curriculum.remove')}: ${c.title}`" :disabled="busy" @click="removing = c" />
        </div>
      </li>
    </ol>

    <UAlert
      v-if="length === 'longer'"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :description="t('programs.curriculum.longer', { x: weeksOfContent, d: durationWeeks })"
    />
    <p v-else-if="length === 'shorter'" class="text-sm text-muted">{{ t('programs.curriculum.shorter', { x: weeksOfContent, d: durationWeeks }) }}</p>

    <AddCourseModal v-if="editable" v-model:open="adding" :program-id="programId" :courses="courses" :weeks-of-content="weeksOfContent" @changed="emit('changed')" />
    <UModal v-model:open="removeOpen" :title="t('programs.curriculum.removeTitle')">
      <template #body>
        <p class="text-sm text-default">{{ t('programs.curriculum.removeConfirm', { course: removing?.title ?? '' }) }}</p>
      </template>
      <template #footer>
        <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="removeOpen = false" />
        <UButton :label="t('programs.curriculum.remove')" color="error" :loading="busy" @click="confirmRemove" />
      </template>
    </UModal>
  </section>
</template>
