<script setup lang="ts">
/**
 * A 16:9 video player from an allowlisted embed URL (YouTube no-cookie, Vimeo, Drive, Loom), sandboxed and lazy.
 * Anything else renders nothing, so an unexpected URL is never framed.
 */
const props = defineProps<{ src: string, title: string }>()
const allowed = computed(() => isEmbedUrl(props.src))
</script>

<template>
  <div v-if="allowed" class="aspect-video max-w-3xl overflow-hidden rounded-lg bg-black ring-1 ring-inset ring-default">
    <iframe
      :src="src"
      :title="title"
      class="size-full"
      loading="lazy"
      sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
      allow="fullscreen; picture-in-picture"
      allowfullscreen
      referrerpolicy="strict-origin-when-cross-origin"
    />
  </div>
</template>
