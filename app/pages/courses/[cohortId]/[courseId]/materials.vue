<script setup lang="ts">
import type { MaterialIndexRow, MaterialTag } from '~~/shared/types'
import { MATERIAL_TAGS } from '~~/shared/types'

/**
 * Materials by type (spec course-content.md): the OCW "week × type" index as a ruled table grouped by module, filtered by
 * one tag (`?tag=`). One call per course; the filter runs on the loaded rows. Locked rows stay, muted, with when they open.
 */
const route = useRoute()
const { t } = useI18n()
const lockText = useLockText()
const NuxtLink = resolveComponent('NuxtLink')
const cohortId = computed(() => String(route.params.cohortId))
const courseId = computed(() => String(route.params.courseId))
const base = computed(() => `/courses/${cohortId.value}/${courseId.value}`)

const { data: rows, status, refresh } = await useFetch<MaterialIndexRow[]>(() => `/api/courses/${cohortId.value}/${courseId.value}/materials`, {
  key: `course-materials:${cohortId.value}:${courseId.value}:all`,
  default: () => []
})
const { data: outline } = await useCourseOutline(cohortId, courseId)
useHead({ title: () => `${t('byType.title')} · ${outline.value?.title ?? t('nav.courses')} · dev.house` })

/** Tags with at least one released material, in the fixed order */
const tags = computed(() => MATERIAL_TAGS.filter(tag => rows.value.some(r => r.isReleased && r.tags.includes(tag))))
const tag = computed(() => {
  const q = String(route.query.tag ?? '') as MaterialTag
  return MATERIAL_TAGS.includes(q) ? q : null
})
/** Course pages first, then each module in outline order (the API's row order) */
const groups = computed(() => {
  const out: { id: string, title: string, rows: MaterialIndexRow[] }[] = []
  for (const r of rows.value.filter(r => !tag.value || r.tags.includes(tag.value))) {
    const id = r.module?.id ?? 'pages'
    let g = out.find(x => x.id === id)
    if (!g) out.push(g = { id, title: r.module?.title ?? t('byType.pages'), rows: [] })
    g.rows.push(r)
  }
  return out
})
const canOpen = (r: MaterialIndexRow) => r.isReleased || !!outline.value?.staff
const href = (r: MaterialIndexRow) => r.lesson ? `${base.value}/lessons/${r.lesson.id}#m-${r.id}` : `${base.value}/pages/${r.id}`
</script>

<template>
  <CourseShell :cohort-id="cohortId" :course-id="courseId" by-type>
    <div class="space-y-6">
      <header class="space-y-4">
        <h1 class="text-[1.75rem] font-semibold leading-tight tracking-tight text-balance text-highlighted">{{ t('byType.title') }}</h1>
        <nav v-if="tags.length" :aria-label="t('byType.filter')" class="flex flex-wrap gap-1.5">
          <UButton
            v-for="x in [null, ...tags]"
            :key="x ?? 'all'"
            :to="{ query: x ? { tag: x } : {} }"
            :label="x ? t(`material.tag.${x}`) : t('byType.all')"
            :color="tag === x ? 'primary' : 'neutral'"
            :variant="tag === x ? 'subtle' : 'ghost'"
            size="sm"
            :aria-current="tag === x ? 'page' : undefined"
          />
        </nav>
      </header>

      <HomeState :status="status" :has-data="rows.length > 0 || status === 'success'" @retry="refresh()">
        <p v-if="!groups.length" class="text-sm text-muted">
          {{ tag ? t('byType.emptyTag', { type: t(`material.tag.${tag}`) }) : t('byType.empty') }}
        </p>
        <div v-else class="overflow-hidden rounded-lg ring-1 ring-inset ring-default">
          <table class="w-full text-sm">
            <thead class="sr-only">
              <tr>
                <th scope="col">{{ t('byType.material') }}</th>
                <th scope="col">{{ t('byType.lesson') }}</th>
              </tr>
            </thead>
            <tbody v-for="g in groups" :key="g.id" class="border-t border-default first-of-type:border-t-0">
              <tr>
                <th scope="colgroup" colspan="2" class="bg-elevated/50 px-4 py-2 text-start text-xs font-medium text-muted">{{ g.title }}</th>
              </tr>
              <tr v-for="r in g.rows" :key="r.id" class="border-t border-default">
                <td class="px-4 py-2.5 align-top">
                  <component
                    :is="canOpen(r) ? NuxtLink : 'div'"
                    :to="canOpen(r) ? href(r) : undefined"
                    class="flex min-w-0 items-start gap-2.5"
                    :class="canOpen(r) && 'group'"
                  >
                    <UIcon
                      :name="r.isReleased ? KIND_ICON[r.kind] : 'i-lucide-lock'"
                      class="mt-0.5 size-4 shrink-0 text-dimmed"
                      :aria-label="r.isReleased ? t(`material.kind.${r.kind}`) : undefined"
                      :aria-hidden="r.isReleased ? undefined : 'true'"
                    />
                    <span class="min-w-0">
                      <span class="block underline-offset-4 group-hover:underline" :class="r.isReleased ? 'text-highlighted' : 'text-muted'">{{ r.title }}</span>
                      <span v-if="!r.isReleased" class="num block text-xs text-muted">{{ lockText(r) }}</span>
                    </span>
                  </component>
                </td>
                <td class="w-2/5 px-4 py-2.5 align-top text-muted">
                  <NuxtLink v-if="r.lesson && canOpen(r)" :to="`${base}/lessons/${r.lesson.id}`" class="underline-offset-4 hover:text-highlighted hover:underline">{{ r.lesson.title }}</NuxtLink>
                  <span v-else-if="r.lesson">{{ r.lesson.title }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </HomeState>
    </div>
  </CourseShell>
</template>
