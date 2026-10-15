<script setup lang="ts">
const { t, locale } = useI18n()
const toast = useToast()
const { data, status, refresh, setCourseStatus, toggleContest } = useStudentDashboard()
const { left } = useCountdown()

const doneCount = computed(() => data.value?.courses.filter(c => c.status === 'done').length ?? 0)
const careerDone = computed(() => data.value?.career.filter(s => s.done).length ?? 0)

const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale.value, opts).format(new Date(iso))

async function onCourse(id: string, next: Parameters<typeof setCourseStatus>[1]) {
  try {
    await setCourseStatus(id, next)
  } catch {
    toast.add({ title: t('home.statusError'), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}

async function onContest() {
  try {
    await toggleContest()
  } catch {
    toast.add({ title: t('common.saveError'), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}
</script>

<template>
  <HomeState :status="status" :has-data="!!data" @retry="refresh()">
    <div v-if="data" class="mx-auto grid w-full max-w-6xl gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div class="min-w-0 space-y-8">
        <header>
          <h1 class="text-balance text-xl font-semibold tracking-tight text-highlighted">
            {{ t('home.greeting', { name: data.student.name }) }}
          </h1>
          <p class="num mt-1 text-sm text-muted">
            {{ data.cohort ? t('home.summary', { week: data.cohort.week, total: data.cohort.totalWeeks, cohort: data.cohort.name }) : t('home.noCohort') }}
          </p>
        </header>

        <NextUp v-if="data.nextUp" :item="data.nextUp" />

        <section aria-labelledby="queue-title">
          <h2 id="queue-title" class="mb-3 text-sm font-semibold text-highlighted">{{ t('home.queue') }}</h2>
          <QueueList :items="data.queue" />
        </section>

        <section aria-labelledby="courses-title">
          <div class="mb-3 flex items-baseline justify-between gap-4">
            <h2 id="courses-title" class="text-sm font-semibold text-highlighted">{{ t('home.courses') }}</h2>
            <p class="num text-xs text-muted">{{ t('home.coursesDone', { done: doneCount, total: data.courses.length }) }}</p>
          </div>
          <p class="mb-3 max-w-prose text-sm text-muted">{{ t('home.coursesHint') }}</p>
          <CoursesList :courses="data.courses" @change="onCourse" />
        </section>
      </div>

      <HomeRail>
        <section class="p-4" aria-labelledby="mentor-title">
          <h2 id="mentor-title" class="text-sm font-semibold text-highlighted">{{ t('home.mentor') }}</h2>
          <template v-if="data.mentor">
            <div class="mt-3 flex items-center gap-3">
              <UAvatar :src="data.mentor.avatar" :alt="data.mentor.name" size="lg" />
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-highlighted">{{ data.mentor.name }}</p>
                <p v-if="data.mentor.role" class="truncate text-xs text-muted">{{ data.mentor.role }}</p>
              </div>
            </div>
            <dl class="mt-4 space-y-2 text-sm">
              <div v-if="data.mentor.nextSessionAt" class="flex justify-between gap-3">
                <dt class="text-muted">{{ t('home.mentorNext') }}</dt>
                <dd class="num text-highlighted">{{ fmtDate(data.mentor.nextSessionAt, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) }}</dd>
              </div>
              <div v-if="data.cohort" class="flex justify-between gap-3">
                <dt class="text-muted">{{ t('home.cohort') }}</dt>
                <dd class="num text-highlighted">{{ data.cohort.name }} · {{ t('home.cohortMembers', { n: data.cohort.members }) }}</dd>
              </div>
            </dl>
          </template>
          <p v-else class="mt-3 text-sm text-muted">{{ t('home.mentorNone') }}</p>
        </section>

        <section class="p-4" aria-labelledby="contest-title">
          <h2 id="contest-title" class="text-sm font-semibold text-highlighted">{{ t('home.contest') }}</h2>
          <template v-if="data.contest">
            <p class="mt-3 text-sm text-highlighted">{{ data.contest.title }}</p>
            <p class="num mt-1 text-xs text-muted">
              {{ fmtDate(data.contest.at, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) }}
              · {{ t('home.contestIn') }} {{ left(data.contest.at) }}
            </p>
            <UButton
              class="mt-4"
              block
              :color="data.contest.registered ? 'neutral' : 'primary'"
              :variant="data.contest.registered ? 'outline' : 'soft'"
              :icon="data.contest.registered ? 'i-lucide-check' : undefined"
              :label="data.contest.registered ? t('home.registered') : t('home.register')"
              @click="onContest"
            />
            <button v-if="data.contest.registered" type="button" class="mt-2 w-full cursor-pointer text-center text-xs text-muted underline-offset-4 hover:text-highlighted hover:underline" @click="onContest">
              {{ t('home.unregister') }}
            </button>
          </template>
          <p v-else class="mt-3 text-sm text-muted">{{ t('home.contestNone') }}</p>
        </section>

        <section class="p-4" aria-labelledby="career-title">
          <div class="flex items-baseline justify-between gap-3">
            <h2 id="career-title" class="text-sm font-semibold text-highlighted">{{ t('home.career') }}</h2>
            <p class="num text-xs text-muted">{{ t('home.careerDone', { done: careerDone, total: data.career.length }) }}</p>
          </div>
          <ul class="mt-3 space-y-2">
            <li v-for="s in data.career" :key="s.id" class="flex items-center gap-2.5 text-sm">
              <UIcon :name="s.done ? 'i-lucide-check' : 'i-lucide-circle-dashed'" class="size-4 shrink-0" :class="s.done ? 'text-success' : 'text-dimmed'" />
              <span :class="s.done ? 'text-muted line-through decoration-dimmed' : 'text-highlighted'">{{ t(`careerSteps.${s.id}`) }}</span>
            </li>
          </ul>
        </section>
      </HomeRail>
    </div>
  </HomeState>
</template>
