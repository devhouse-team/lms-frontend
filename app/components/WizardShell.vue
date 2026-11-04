<script setup lang="ts">
/**
 * Step rail + body for the create wizards. The route is `base?step=n`; steps past `reach` are not links.
 * `current` above `steps.length` is the done screen: every step shows as done and the rail is inert.
 * Spec: setup-flow.md, Shell.
 */
const props = defineProps<{ title: string, steps: string[], current: number, reach: number, base: string }>()
const { t } = useI18n()
const finished = computed(() => props.current > props.steps.length)
const label = computed(() => props.steps[props.current - 1])
</script>

<template>
  <div class="mx-auto grid w-full max-w-5xl gap-6 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-10">
    <nav :aria-label="title" class="md:sticky md:top-4 md:self-start">
      <p class="text-sm font-semibold text-highlighted">{{ title }}</p>
      <p v-if="!finished" class="mt-1 text-sm text-muted md:hidden">{{ t('wizard.stepOf', { n: current, total: steps.length }) }}: {{ label }}</p>
      <ol class="mt-4 hidden md:block">
        <li v-for="(s, i) in steps" :key="s" class="relative pb-5 last:pb-0">
          <span v-if="i < steps.length - 1" class="absolute start-3 top-7 -bottom-0 w-px bg-accented" aria-hidden="true" />
          <component
            :is="!finished && i + 1 <= reach ? 'NuxtLink' : 'span'"
            :to="!finished && i + 1 <= reach ? { path: base, query: { step: i + 1 } } : undefined"
            :aria-current="i + 1 === current ? 'step' : undefined"
            class="flex items-center gap-3 text-sm"
            :class="[i + 1 === current ? 'font-medium text-highlighted' : i + 1 < current || finished ? 'text-default' : 'text-muted', !finished && i + 1 <= reach ? 'hover:text-highlighted' : '']"
          >
            <span
              class="num grid size-6 shrink-0 place-items-center rounded-full text-xs"
              :class="i + 1 < current || finished ? 'bg-primary text-inverted' : i + 1 === current ? 'bg-default ring-2 ring-primary' : 'bg-default ring-1 ring-accented'"
              aria-hidden="true"
            >
              <UIcon v-if="i + 1 < current || finished" name="i-lucide-check" class="size-3.5" />
              <template v-else>{{ i + 1 }}</template>
            </span>
            {{ s }}
          </component>
        </li>
      </ol>
    </nav>
    <div class="min-w-0 space-y-6">
      <slot />
    </div>
  </div>
</template>
