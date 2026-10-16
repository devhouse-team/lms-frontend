<script setup lang="ts">
import type { CourseOption, ProgramCourse } from '~~/shared/types'

/** Pick an existing course and its start week; appended at the end of the curriculum. Spec: programs.md, Add course. */
const props = defineProps<{ programId: string, courses: ProgramCourse[], weeksOfContent: number }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ changed: [] }>()

const { t } = useI18n()
const toast = useToast()
const { toastError, code } = useProgramErrors()

const { data: options, status, error, execute } = useLazyFetch<CourseOption[]>('/api/programs/course-options', {
  key: 'program-course-options', immediate: false, server: false, default: () => []
})
const noAccess = computed(() => error.value?.statusCode === 403)

const items = computed(() => {
  const taken = new Set(props.courses.map(c => c.courseId))
  return options.value.filter(c => !taken.has(c.id)).map(c => ({
    value: c.id,
    label: c.title,
    suffix: c.published ? undefined : t('programs.curriculum.unpublished')
  }))
})

const courseId = ref<string>()
const week = ref(1)
const day = ref(1)
const saving = ref(false)
const valid = computed(() => Number.isInteger(week.value) && week.value >= 1 && week.value <= 104 && Number.isInteger(day.value) && day.value >= 1 && day.value <= 7)

watch(open, (o) => {
  if (!o) return
  courseId.value = undefined
  week.value = props.courses.length ? Math.min(104, props.weeksOfContent + 1) : 1
  day.value = 1
  if (!options.value.length) execute()
})

async function add() {
  const course = options.value.find(c => c.id === courseId.value)
  if (!course || !valid.value) return
  saving.value = true
  try {
    await $fetch(`/api/programs/${props.programId}/courses/${course.id}`, { method: 'PUT', body: { startOffsetDays: (week.value - 1) * 7 + (day.value - 1) } })
    toast.add({ title: t('programs.curriculum.added', { course: course.title }), icon: 'i-lucide-check', color: 'success' })
    open.value = false
    emit('changed')
  } catch (e) {
    toastError(e)
    if (code(e) === 'course_not_found') execute()
    emit('changed')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t('programs.curriculum.addTitle')">
    <template #body>
      <p v-if="noAccess" class="text-sm text-muted">{{ t('programs.curriculum.noAccess') }}</p>
      <div v-else class="space-y-4">
        <UFormField :label="t('programs.curriculum.course')" :help="status === 'success' && !items.length ? t('programs.curriculum.allAdded') : undefined">
          <USelectMenu
            v-model="courseId"
            :items="items"
            value-key="value"
            :loading="status === 'pending'"
            :placeholder="t('programs.curriculum.coursePlaceholder')"
            :search-input="{ placeholder: t('people.search') }"
            class="w-full"
          >
            <template #item-trailing="{ item }">
              <UBadge v-if="item.suffix" :label="item.suffix" color="warning" variant="subtle" size="sm" />
            </template>
          </USelectMenu>
        </UFormField>
        <div class="flex gap-4">
          <UFormField :label="t('programs.curriculum.startWeek')">
            <UInputNumber v-model="week" :min="1" :max="104" class="w-28" />
          </UFormField>
          <UFormField :label="t('programs.curriculum.startDay')">
            <UInputNumber v-model="day" :min="1" :max="7" class="w-24" />
          </UFormField>
        </div>
        <p class="text-xs text-muted">{{ t('programs.curriculum.startHelp') }}</p>
      </div>
    </template>
    <template #footer>
      <UButton :label="t('common.cancel')" color="neutral" variant="ghost" @click="open = false" />
      <UButton v-if="!noAccess" :label="t('cohorts.add')" color="primary" :disabled="!courseId || !valid" :loading="saving" @click="add" />
    </template>
  </UModal>
</template>
