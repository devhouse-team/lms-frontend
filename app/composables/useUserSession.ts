import { loadUser } from '~/api/utils/auth'

/** The signed-in user (null when signed out); same surface the pages used with nuxt-auth-utils */
export function useUserSession() {
  return {
    user: sessionUser as Readonly<typeof sessionUser>,
    loggedIn: computed(() => !!sessionUser.value),
    ready: sessionReady,
    /** Reload the user from the API (after a profile edit) */
    fetch: async () => { await loadUser() },
    clear: () => clearUserSession()
  }
}
