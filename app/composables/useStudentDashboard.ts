export function useStudentDashboard() {
  const { data, status, error, refresh } = useFetch('/api/dashboard/mentee', { key: 'dashboard-mentee' })

  async function toggleContest() {
    const d = data.value
    const c = d?.contest
    if (!d || !c) return
    // `data` is a shallow ref: replace the contest, don't edit it
    const set = (registered: boolean) => { data.value = { ...d, contest: { ...c, registered } } }
    set(!c.registered)
    try {
      await $fetch(`/api/contests/saved/${c.slug}/registration`, { method: c.registered ? 'DELETE' : 'PUT' })
      clearNuxtData('contests-saved')
    } catch (e) {
      set(c.registered)
      throw e
    }
  }

  return { data, status, error, refresh, toggleContest }
}
