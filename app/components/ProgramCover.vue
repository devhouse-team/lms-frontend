<script setup lang="ts">
/** Program cover, or a neutral tile with the initials when there is none or it fails to load (the URL expires) */
const props = defineProps<{ src: string | null, title: string }>()
const failed = ref(false)
watch(() => props.src, () => (failed.value = false))
// A server-rendered image can fail before hydration attaches @error
const img = useTemplateRef('img')
onMounted(() => {
  if (img.value?.complete && !img.value.naturalWidth) failed.value = true
})
const initials = computed(() => props.title.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase())
</script>

<template>
  <div class="@container overflow-hidden bg-elevated">
    <img v-if="src && !failed" ref="img" :src="src" alt="" loading="lazy" class="size-full object-cover" @error="failed = true">
    <div v-else class="flex size-full items-center justify-center font-semibold tracking-tight text-dimmed text-[length:min(2.5rem,22cqw)]" aria-hidden="true">
      {{ initials }}
    </div>
  </div>
</template>
