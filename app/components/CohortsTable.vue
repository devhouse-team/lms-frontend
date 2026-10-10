<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { CohortRow } from '~~/shared/types'

defineProps<{ rows: CohortRow[] }>()
const { t, locale } = useI18n()

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
      'trailingIcon': dir === 'asc' ? 'i-lucide-arrow-up' : dir === 'desc' ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up-down',
      'aria-label': `${label}: ${t('head.sort')}`,
      'onClick': () => column.toggleSorting(dir === 'asc')
    })
  }
}

const num = (v: string | number, cls = '') => h('span', { class: `num ${cls}` }, String(v))

const columns = computed<TableColumn<CohortRow>[]>(() => [
  {
    accessorKey: 'name',
    header: sortHeader(t('head.col.cohort')),
    cell: ({ row }) => h(NuxtLink, { to: `/cohorts/${row.original.id}`, class: 'block min-w-0 rounded-sm hover:underline underline-offset-4' }, () => [
      h('p', { class: 'num font-medium text-highlighted' }, row.original.name),
      h('p', { class: 'truncate text-xs text-muted' }, row.original.programTitle)
    ])
  },
  {
    id: 'mentor',
    accessorFn: r => r.mentor?.name ?? '',
    header: t('head.col.mentor'),
    cell: ({ row }) => row.original.mentor
      ? h('div', { class: 'flex items-center gap-2' }, [
          h(UAvatar, { src: row.original.mentor.avatar, alt: row.original.mentor.name, size: 'xs' }),
          h('span', { class: 'truncate text-highlighted' }, row.original.mentor.name)
        ])
      : h(UBadge, { label: t('head.noMentor'), color: 'warning', variant: 'subtle', size: 'sm' })
  },
  { accessorKey: 'mentees', header: sortHeader(t('head.col.mentees')), cell: ({ row }) => num(row.original.mentees) },
  {
    accessorKey: 'week',
    header: sortHeader(t('head.col.week')),
    cell: ({ row }) => row.original.week === 0
      ? h('span', { class: 'text-xs text-muted' }, t('head.notStarted'))
      : num(`${row.original.week}/${row.original.totalWeeks}`)
  },
  { accessorKey: 'progress', header: sortHeader(t('head.col.progress')), cell: ({ row }) => num(row.original.mentees ? pct(row.original.progress) : '—', 'text-muted') },
  {
    accessorKey: 'atRisk',
    header: sortHeader(t('head.col.atRisk')),
    cell: ({ row }) => num(row.original.atRisk || '—', row.original.atRisk ? 'text-error' : 'text-dimmed')
  },
  {
    accessorKey: 'backlog',
    header: sortHeader(t('head.col.backlog')),
    cell: ({ row }) => num(row.original.backlog || '—', row.original.backlog >= 5 ? 'text-primary' : row.original.backlog ? 'text-highlighted' : 'text-dimmed')
  }
])
</script>

<template>
  <div class="overflow-x-auto rounded-lg ring-1 ring-inset ring-default">
    <UTable
      v-model:sorting="sorting"
      :data="rows"
      :columns="columns"
      :ui="{ base: 'min-w-[44rem]', th: 'text-xs text-muted font-medium py-2', td: 'py-2.5 text-sm', tr: 'hover:bg-elevated/60 transition-colors' }"
    >
      <template #empty>
        <UEmpty icon="i-lucide-users" :description="t('head.noCohorts')" variant="naked" />
      </template>
    </UTable>
  </div>
</template>
