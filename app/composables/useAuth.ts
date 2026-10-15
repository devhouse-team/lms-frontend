import type { Role } from '~~/shared/types'

export function useAuth() {
  const { user, loggedIn, fetch: refreshSession, clear } = useUserSession()

  async function afterLogin() {
    await refreshSession()
    clearNuxtData()
    const next = useRoute().query.next
    await navigateTo(typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/')
  }

  /** `login` is an email or a username */
  async function login(login: string, password: string) {
    await $fetch('/api/auth/login', { method: 'POST', body: { login, password } })
    await afterLogin()
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await clear()
    clearNuxtData()
    await navigateTo('/login')
  }

  /** Accounts with several views (mentor in one cohort, student in another) switch here */
  async function switchRole(next: Role) {
    await $fetch('/api/auth/role', { method: 'POST', body: { role: next } })
    await refreshSession()
    clearNuxtData()
    await navigateTo('/')
  }

  const role = computed<Role | undefined>(() => user.value?.role)

  return { user, role, loggedIn, login, logout, switchRole, afterLogin }
}
