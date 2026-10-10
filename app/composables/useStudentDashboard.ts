import type { CourseStatus, StudentDashboard } from '~~/shared/types'

export function useStudentDashboard() {
  const { data, status, error, refresh } = useFetch<StudentDashboard>('/api/dashboard/mentee', { key: 'dashboard-mentee' })

  async function setCourseStatus(id: string, next: CourseStatus) {
    const course = data.value?.courses.find(c => c.id === id)
    if (!course || course.status === next) return
    const prev = course.status
    course.status = next // optimistic
    try {
      await $fetch(`/api/courses/${id}/status`, { method: 'PATCH', body: { status: next } })
    } catch (e) {
      course.status = prev
      throw e
    }
  }

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

  return { data, status, error, refresh, setCourseStatus, toggleContest }
}
