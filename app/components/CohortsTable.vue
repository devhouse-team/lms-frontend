<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { CohortRow } from '~~/shared/types'

/** `compact` (head home) drops the Status column: the Week cell already says planned / finished there */
const props = defineProps<{ rows: CohortRow[], compact?: boolean }>()
const { t, locale } = useI18n()
const { short, statusBadge } = useCohortFormat()

const UButton = resolveComponent('UButton')
const UAvatar = resolveComponent('UAvatar')
const UBadge = resolveComponent('UBadge')
const NuxtLink = resolveComponent('NuxtLink')

const pct = (v: number) => new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 0 }).format(v)
const sorting = ref([{ id: 'atRisk', desc: true }])

function sortHeader(label: string) {
  // TanStack header context; typed loosely to avoid importing table-core types
  return ({ column }: { column: { getIsSorted: () => false | 'asc' | 'desc', toggleSorting: (desc?: boolean) => void } }) => {
    const dir = column.getIsSorted()
    return h(UButton, {
      'color': 'neutral',
      'variant': 'ghost',
      'size': 'xs',
      'label': label,
      'class': '-mx-2 font-medium',
      // Only the sorted column shows an arrow: idle arrows cost the narrow columns their width
      'trailingIcon': dir === 'asc' ? 'i-lucide-arrow-up' : dir === 'desc' ? 'i-lucide-arrow-down' : undefined,
      'aria-label': `${label}: ${t('head.sort')}`,
      'onClick': () => column.toggleSorting(dir === 'asc')
    })
  }
}

const num = (v: string | number, cls = '') => h('span', { class: `num ${cls}` }, String(v))
// Name and mentors truncate (full text on hover) so long names can't push the numbers out of the box;
// numbers are right-aligned like the roster
const text = (cls: string) => ({ class: { th: cls, td: cls } })
const numeric = text('px-3 text-end')

/** Up to two mentor names, then "+N"; a warning line counts current students without a mentor */
function mentorsCell(r: CohortRow) {
  const shown = r.mentors.slice(0, 2)
  const more = r.mentors.length - shown.length
  const names = shown.map(m => m.name).join(', ') + (more ? ` +${more}` : '')
  return h('div', { class: 'min-w-0', title: r.mentors.map(m => m.name).join(', ') || undefined }, [
    r.mentors.length
      ? h('div', { class: 'flex min-w-0 items-center gap-2' }, [
          h('div', { class: 'flex shrink-0 -space-x-1.5' }, shown.map(m => h(UAvatar, { src: m.avatar, alt: m.name, size: 'xs', class: 'ring-2 ring-(--ui-bg)' }))),
          h('span', { class: 'truncate text-highlighted' }, names)
        ])
      : h(UBadge, { label: t('head.noMentor'), color: 'warning', variant: 'subtle', size: 'sm' }),
    r.unassigned && r.mentors.length ? h('p', { class: 'mt-0.5 truncate text-xs text-warning' }, t('cohorts.withoutMentor', { n: r.unassigned })) : null
  ])
}

/** Planned: "starts 12 Jan" · active: "3/26" (API week / total_weeks) · finished: "finished 3 Mar", muted */
function weekCell(r: CohortRow) {
  if (r.status === 'planned') return h('span', { class: 'text-xs whitespace-nowrap text-muted' }, t('cohortStatus.startsOn', { date: short(r.startsOn) }))
  if (r.status === 'finished') return h('span', { class: 'text-xs whitespace-nowrap text-dimmed' }, t('cohortStatus.finishedOn', { date: short(r.finishedAt ?? r.endsOn) }))
  return num(`${r.week}/${r.totalWeeks}`)
}

const columns = computed<TableColumn<CohortRow>[]>(() => [
  {
    accessorKey: 'name',
    header: sortHeader(t('head.col.cohort')),
    // Phones scroll the numbers sideways; the name stays put (sticky only there, so desktop hover stays intact)
    meta: text('w-full max-w-0 min-w-36 max-sm:sticky max-sm:left-0 max-sm:z-1 max-sm:bg-default max-sm:shadow-[inset_-1px_0_0_var(--ui-border)]'),
    cell: ({ row }) => h(NuxtLink, { to: `/cohorts/${row.original.id}`, title: row.original.name, class: 'block min-w-0 rounded-sm hover:underline underline-offset-4' }, () => [
      h('p', { class: 'num truncate font-medium text-highlighted' }, row.original.name),
      h('p', { class: 'truncate text-xs text-muted' }, row.original.programTitle)
    ])
  },
  ...(props.compact
    ? []
    : [{
        accessorKey: 'status',
        header: t('cohorts.col.status'),
        meta: text('px-3'),
        cell: ({ row }: { row: { original: CohortRow } }) => h(UBadge, statusBadge(row.original.status))
      }]),
  { id: 'mentors', accessorFn: r => r.mentors[0]?.name ?? '', header: t('cohorts.col.mentors'), meta: text('max-w-48'), cell: ({ row }) => mentorsCell(row.original) },
  { accessorKey: 'mentees', header: sortHeader(t('head.col.mentees')), meta: numeric, cell: ({ row }) => num(row.original.mentees) },
  {
    // Planned first, then active by week, then finished
    id: 'week',
    accessorFn: r => (r.status === 'planned' ? -1 : r.status === 'finished' ? 10_000 : r.week),
    header: sortHeader(t('head.col.week')),
    meta: numeric,
    cell: ({ row }) => weekCell(row.original)
  },
  { accessorKey: 'progress', header: sortHeader(t('head.col.progress')), meta: numeric, cell: ({ row }) => num(row.original.studentsTotal ? pct(row.original.progress) : '—', 'text-muted') },
  {
    accessorKey: 'atRisk',
    header: sortHeader(t('head.col.atRisk')),
    meta: numeric,
    cell: ({ row }) => num(row.original.atRisk || '—', row.original.atRisk ? 'text-error' : 'text-dimmed')
  },
  {
    accessorKey: 'backlog',
    header: sortHeader(t('head.col.backlog')),
    meta: text('px-3 pe-4 text-end'),
    cell: ({ row }) => num(row.original.backlog || '—', row.original.backlog >= 5 ? 'text-primary' : row.original.backlog ? 'text-highlighted' : 'text-dimmed')
  }
])
</script>

<template>
  <div class="overflow-hidden rounded-lg ring-1 ring-inset ring-default">
    <UTable
      v-model:sorting="sorting"
      :data="rows"
      :columns="columns"
      :ui="{ base: `w-full ${compact ? 'min-w-[44rem]' : 'min-w-[48rem]'}`, th: 'text-xs text-muted font-medium py-2', td: 'py-2.5 text-sm', tr: 'hover:bg-elevated/60 transition-colors' }"
    >
      <template #empty>
        <slot name="empty">
          <UEmpty icon="i-lucide-users" :description="t('head.noCohorts')" variant="naked" />
        </slot>
      </template>
    </UTable>
  </div>
</template>
