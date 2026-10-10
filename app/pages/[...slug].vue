<script setup lang="ts">
// Unknown route inside the app: show the shared error page
throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
</script>

<template>
  <div />
</template>
