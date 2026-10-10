import type { Role } from '~~/shared/types'

export function useAuth() {
  const { user, loggedIn, fetch: refreshSession, clear } = useUserSession()

  async function afterLogin() {
    await refreshSession()
    const next = useRoute().query.next
    await navigateTo(typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/')
  }

  async function login(email: string, password: string) {
    await $fetch('/api/auth/login', { method: 'POST', body: { email, password } })
    await afterLogin()
  }

  async function loginWithTelegram() {
    await $fetch('/api/auth/telegram', { method: 'POST' })
    await afterLogin()
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await clear()
    clearNuxtData()
    await navigateTo('/login')
  }

  const role = computed<Role | undefined>(() => user.value?.role)

  return { user, role, loggedIn, login, loginWithTelegram, logout, afterLogin }
}
