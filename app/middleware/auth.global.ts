import type { Role } from '~~/shared/types'

declare module '#app' {
  interface PageMeta {
    /** Roles allowed on this page. Omit for any signed-in user. */
    roles?: Role[]
    /** Page is reachable without a session (login, invite). */
    public?: boolean
  }
}

export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn, user } = useUserSession()

  if (to.meta.public) {
    if (loggedIn.value && to.path === '/login') return navigateTo('/')
    return
  }
  if (!loggedIn.value) {
    return navigateTo({ path: '/login', query: to.fullPath !== '/' ? { next: to.fullPath } : undefined })
  }
  if (to.meta.roles && user.value && !to.meta.roles.includes(user.value.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden', fatal: true })
  }
})
