/** When the API session can't be refreshed, the server clears it and answers 401: send the user to sign in */
export default defineNuxtPlugin(() => {
  const { clear } = useUserSession()
  globalThis.$fetch = $fetch.create({
    async onResponseError({ request, response }) {
      if (response.status !== 401 || String(request).includes('/api/auth/')) return
      await clear()
      const route = useRoute()
      if (!route.meta.public) await navigateTo({ path: '/login', query: { next: route.fullPath, expired: '1' } })
    }
  }) as typeof $fetch
})
