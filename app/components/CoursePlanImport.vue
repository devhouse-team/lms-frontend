<script setup lang="ts">
import type { ImportIssue, ImportResult, PlanFormat, PlanTree } from '~/utils/planImport'

/**
 * Course wizard, structure step: paste or upload a plan (Markdown, CSV or JSON), see what it would create and what is
 * wrong, then apply it. Syntax is checked here, content by the API's dry run (spec plan-import-api.md). Applying adds
 * to the course or replaces its structure. Everything imported is unpublished.
 */
const emit = defineEmits<{ applied: [] }>()
const { t, te } = useI18n()
const toast = useToast()
const { courseId, call } = useCourseEditor()
const { message } = useApiErrors('content')

const SAMPLES: Record<PlanFormat, string> = {
  md: '# Basics\n## Variables\n- [video](https://www.youtube.com/watch?v=dQw4w9WgXcQ) Intro\n- [link](https://docs.python.org/3/tutorial/) Tutorial\n> task: Homework 1\n## Loops\n- [video](https://youtu.be/dQw4w9WgXcQ) Loops explained\n\n# Functions\n## Defining functions\n- [pdf](https://example.com/functions.pdf) Cheat sheet\n> task: Write three functions\n',
  csv: 'module,lesson,type,title,url\nBasics,Variables,video,Intro,https://www.youtube.com/watch?v=dQw4w9WgXcQ\nBasics,Variables,task,Homework 1,\nBasics,Loops,link,Tutorial,https://docs.python.org/3/tutorial/\nFunctions,Defining functions,task,Write three functions,\n',
  json: '{\n  "modules": [\n    {\n      "title": "Basics",\n      "lessons": [\n        { "title": "Variables", "items": [\n          { "type": "video", "title": "Intro", "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },\n          { "type": "task", "title": "Homework 1" }\n        ] }\n      ]\n    }\n  ]\n}\n'
}

/** Code, not copy: kept out of i18n, where `{` starts a placeholder */
const SYNTAX: Record<PlanFormat, string> = {
  md: '# Module\n## Lesson\n- [video|pdf|link](url) Title\n> task: Title',
  csv: 'module,lesson,type,title,url\ntype: video, pdf, link, task',
  json: '{ "modules": [ { "title",\n  "lessons": [ { "title",\n    "items": [ { "type",\n      "title", "url" } ] } ] } ] }'
}

const format = ref<PlanFormat>('md')
const text = ref('')
const mode = ref<'append' | 'replace'>('append')
const tree = ref<PlanTree>()
const parseError = ref<string>()
const result = ref<ImportResult>()
const serverError = ref<string>()
const busy = ref(false)
const formats = computed(() => [
  { value: 'md', label: 'Markdown' },
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' }
])

/** Edited text or format makes the last preview stale */
watch([text, format], () => {
  tree.value = undefined
  result.value = undefined
  parseError.value = undefined
  serverError.value = undefined
})

async function readFile(file: File | null | undefined) {
  if (!file) return
  const ext = file.name.split('.').pop()?.toLowerCase()
  format.value = ext === 'csv' ? 'csv' : ext === 'json' ? 'json' : 'md'
  await nextTick()
  text.value = await file.text()
}

/** The API's answer for the tree: a dry run, or the real run. Errors come back as a message, not a toast. */
async function send(dryRun: boolean) {
  serverError.value = undefined
  const res = await call<ImportResult>('POST', `courses/${courseId}/import`, toRequest(tree.value!, mode.value, dryRun), undefined, (e) => {
    serverError.value = te(`content.err.${apiError(e).code}`) ? message(e) : t('wizard.course.import.err.unavailable')
    return true
  })
  return res
}

async function parse() {
  busy.value = true
  parseError.value = undefined
  result.value = undefined
  try {
    tree.value = parsePlan(format.value, text.value)
  } catch (e) {
    tree.value = undefined
    parseError.value = e instanceof PlanParseError ? t(`wizard.course.import.err.${e.code}`) : t('wizard.course.import.err.json_invalid')
    busy.value = false
    return
  }
  if (!tree.value.modules.length) {
    parseError.value = t('wizard.course.import.err.nothing')
    tree.value = undefined
  } else if (!localIssues(tree.value).some(i => i.severity === 'error')) {
    result.value = await send(true)
  }
  busy.value = false
}

// The replace rules are checked by the API: ask again when the mode changes
watch(mode, async () => {
  if (!tree.value || localIssues(tree.value).some(i => i.severity === 'error')) return
  busy.value = true
  result.value = await send(true)
  busy.value = false
})

const issues = computed<ImportIssue[]>(() => (tree.value ? [...localIssues(tree.value), ...(result.value?.issues ?? [])] : []))
const errors = computed(() => issues.value.filter(i => i.severity === 'error').length)
const counts = computed(() => result.value?.counts ?? (tree.value ? planCounts(tree.value) : undefined))
const issueText = (i: ImportIssue) => (te(`wizard.course.import.issue.${i.code}`) ? t(`wizard.course.import.issue.${i.code}`) : i.message)
/** "modules[1].lessons[0].items[2]" → "Functions › Defining functions › item 3" */
function where(i: ImportIssue) {
  const line = i.path.match(/^line\[(\d+)\]$/)
  if (line) return t('wizard.course.import.line', { n: line[1]! })
  const [mi, li, k] = [...i.path.matchAll(/\[(\d+)\]/g)].map(x => Number(x[1]))
  const m = mi === undefined ? undefined : tree.value?.modules[mi]
  const l = li === undefined ? undefined : m?.lessons[li]
  return [m && (m.title || t('wizard.course.import.untitled')), l && (l.title || t('wizard.course.import.untitled')), k === undefined ? undefined : t('wizard.course.import.item', { n: k + 1 })].filter(Boolean).join(' › ')
}

async function apply() {
  busy.value = true
  const res = await send(false)
  busy.value = false
  if (!res) return
  result.value = res
  if (!res.applied) return
  toast.add({ title: t('wizard.course.import.done', { m: res.counts.modules, l: res.counts.lessons }), icon: 'i-lucide-check', color: 'success' })
  text.value = ''
  emit('applied')
}
</script>

<template>
  <div class="space-y-4">
    <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
      <UFormField :label="t('wizard.course.import.text')">
        <UTextarea v-model="text" :rows="12" autoresize :maxrows="22" spellcheck="false" autocapitalize="none" class="w-full font-mono" :placeholder="t('wizard.course.import.placeholder')" />
      </UFormField>
      <aside class="space-y-3">
        <UFormField :label="t('wizard.course.import.format')">
          <USelect v-model="format" :items="formats" class="w-full" />
        </UFormField>
        <pre class="overflow-x-auto rounded-md bg-elevated p-3 text-xs text-muted" aria-label="Syntax">{{ SYNTAX[format] }}</pre>
      </aside>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <UButton :label="t('wizard.course.import.sample')" color="neutral" variant="outline" size="sm" @click="text = SAMPLES[format]" />
      <UFileUpload v-slot="{ open }" accept=".md,.txt,.csv,.json" @update:model-value="(f: File | File[] | null | undefined) => readFile(Array.isArray(f) ? f[0] : f)">
        <UButton :label="t('wizard.course.import.upload')" icon="i-lucide-upload" color="neutral" variant="outline" size="sm" @click="open()" />
      </UFileUpload>
      <UButton :label="t('wizard.course.import.parse')" trailing-icon="i-lucide-arrow-right" size="sm" :disabled="!text.trim()" :loading="busy && !tree" @click="parse" />
    </div>

    <UAlert v-if="parseError" color="error" variant="subtle" icon="i-lucide-circle-alert" :description="parseError" />

    <section v-if="tree && counts" aria-labelledby="preview-title" class="space-y-4 rounded-lg p-4 ring-1 ring-inset ring-default">
      <h3 id="preview-title" class="text-sm font-semibold text-highlighted">{{ t('wizard.course.import.preview') }}</h3>
      <dl class="num flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div v-for="k in (['modules', 'lessons', 'materials', 'assignments'] as const)" :key="k">
          <dt class="text-muted">{{ t(`wizard.course.review.stat.${k}`) }}</dt>
          <dd class="font-medium text-highlighted">{{ counts[k] }}</dd>
        </div>
      </dl>
      <UAlert v-if="serverError" color="warning" variant="subtle" icon="i-lucide-triangle-alert" :description="serverError" />
      <ul v-if="issues.length" class="divide-y divide-default rounded-md ring-1 ring-inset ring-default" aria-live="polite">
        <li v-for="(i, n) in issues" :key="n" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
          <UBadge :label="t(`wizard.course.review.severity.${i.severity === 'error' ? 'error' : 'warn'}`)" :color="i.severity === 'error' ? 'error' : 'warning'" variant="subtle" size="sm" />
          <span class="min-w-0 flex-1 basis-56 text-sm text-default">{{ issueText(i) }}</span>
          <span class="text-xs text-muted">{{ where(i) }}</span>
        </li>
      </ul>
      <UAlert v-else-if="result" color="success" variant="subtle" icon="i-lucide-check" :description="t('wizard.course.import.noIssues')" />

      <URadioGroup
        v-model="mode"
        :items="[{ value: 'append', label: t('wizard.course.import.append'), description: t('wizard.course.import.appendHelp') }, { value: 'replace', label: t('wizard.course.import.replace'), description: t('wizard.course.import.replaceHelp') }]"
        variant="card"
      />
      <div class="flex flex-wrap items-center gap-3">
        <UButton :label="t('wizard.course.import.apply')" icon="i-lucide-check" :disabled="!!errors || !counts.lessons || !!serverError" :loading="busy" @click="apply" />
        <span v-if="errors" class="text-sm text-muted">{{ t('wizard.course.import.fixFirst') }}</span>
      </div>
    </section>
  </div>
</template>
