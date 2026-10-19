<script setup lang="ts">
import type { NotificationItem } from '~~/shared/types'

/** Rows of notifications (panel and page): icon, our type label, the API's title, time; unread: dot, bold, spoken */
defineProps<{ items: NotificationItem[] }>()
const emit = defineEmits<{ open: [item: NotificationItem] }>()
const { t, te, locale } = useI18n()
const { relative } = useCountdown()
const { short } = useCohortFormat()

const ICON: Record<string, string> = {
  submission_created: 'i-lucide-inbox',
  review_completed: 'i-lucide-message-square-check',
  lesson_released: 'i-lucide-book-open',
  deadline_soon: 'i-lucide-alarm-clock',
  enrollment_created: 'i-lucide-user-plus',
  exam_opens_soon: 'i-lucide-timer',
  solution_released: 'i-lucide-lightbulb'
}
const label = (type: string) => (te(`notifications.type.${type}`) ? t(`notifications.type.${type}`) : t('notifications.type.unknown'))
/** Words under a week ("5 минут назад", "вчера"), then the date; the viewer's own clock (moments, not deadlines) */
const when = (iso: string) => (Date.now() - Date.parse(iso) < 7 * 86_400_000 ? relative(iso) : short(iso))
const absolute = (iso: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
</script>

<template>
  <ul class="divide-y divide-default">
    <li v-for="n in items" :key="n.id">
      <button
        type="button"
        class="flex min-h-14 w-full items-start gap-3 px-4 py-3 text-start transition-colors duration-150 ease-out hover:bg-elevated focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        :class="!n.read && 'bg-elevated/50'"
        @click="emit('open', n)"
      >
        <UIcon :name="ICON[n.type] ?? 'i-lucide-bell'" class="mt-0.5 size-4 shrink-0" :class="n.read ? 'text-dimmed' : 'text-primary'" aria-hidden="true" />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm" :class="n.read ? 'text-default' : 'font-semibold text-highlighted'">{{ label(n.type) }}</span>
          <span class="block truncate text-xs text-muted" :title="n.title">{{ n.title }}</span>
        </span>
        <span class="flex shrink-0 items-center gap-2">
          <time class="num text-xs text-muted" :datetime="n.createdAt" :title="absolute(n.createdAt)">{{ when(n.createdAt) }}</time>
          <span v-if="!n.read" class="size-2 rounded-full bg-primary" aria-hidden="true" />
          <span v-if="!n.read" class="sr-only">{{ t('notifications.unreadMark') }}</span>
        </span>
      </button>
    </li>
  </ul>
</template>
