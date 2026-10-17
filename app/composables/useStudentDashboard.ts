export function useStudentDashboard() {
  const { data, status, error, refresh } = useFetch('/api/dashboard/mentee', { key: 'dashboard-mentee' })

  async function toggleContest() {
    const c = data.value?.contest
    if (!c) return
    c.registered = !c.registered
    try {
      await $fetch('/api/contest/registration', { method: 'POST', body: { registered: c.registered } })
    } catch (e) {
      c.registered = !c.registered
      throw e
    }
  }

  return { data, status, error, refresh, toggleContest }
}
