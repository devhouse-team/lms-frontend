import type { InjectionKey, Ref } from 'vue'
import type { components } from '~~/shared/types/api'

export type CourseOutlineApi = components['schemas']['CourseOutline']

export interface PromptField { name: string, label: string, type?: 'text' | 'number', min?: number, max?: number, help?: string }

interface EditorContext {
  courseId: string
  outline: Ref<CourseOutlineApi | undefined>
  refresh: () => Promise<void>
  /**
   * One authoring call through `/api/editor/…`: toast on success (optional) or with the mapped error, then refetch the
   * outline and drop the reader keys. Resolves to the response, or undefined on error.
   */
  call: <T = unknown>(method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: object, done?: string, onError?: (e: unknown) => boolean | void) => Promise<T | undefined>
  /** An item editor page (`materials/1`, `assignments/2`); from the course wizard it carries `?back=` to return there */
  link: (path: string) => { path: string, query: { back?: string } }
}

const KEY: InjectionKey<EditorContext> = Symbol('course-editor')

/** The course editor page provides it; outline, materials and editors tabs use it. `back`: where item pages return */
export function provideCourseEditor(courseId: string, outline: Ref<CourseOutlineApi | undefined>, refresh: () => Promise<void>, back?: () => string) {
  const { t } = useI18n()
  const toast = useToast()
  const { toastError } = useApiErrors('content')
  const call: EditorContext['call'] = async (method, path, body, done, onError) => {
    try {
      const res = await $fetch(`/api/editor/${path}`, { method, body })
      if (done) toast.add({ title: done, icon: 'i-lucide-check', color: 'success' })
      return res as never
    } catch (e) {
      if (!onError?.(e)) toastError(e)
      return undefined
    } finally {
      invalidateContent(`editor-outline:${courseId}`)
      await refresh()
    }
  }
  const link: EditorContext['link'] = path => ({ path: `/editor/${courseId}/${path}`, query: back ? { back: back() } : {} })
  provide(KEY, { courseId, outline, refresh, call, link })
  return { call, t }
}

export const useCourseEditor = () => inject(KEY)!

/** `?back=` of an item editor page, only when it is a course wizard page */
export function wizardBack(back: unknown) {
  const r = typeof back === 'string' ? back : ''
  return /^\/create\/course\/[\w-]+(\?[^#]*)?$/.test(r) ? r : undefined
}

/** Ids with the item at `i` moved one step (`dir` -1 up, +1 down) */
export function moved<T extends { id: number }>(list: T[], i: number, dir: -1 | 1) {
  const ids = list.map(x => x.id)
  ;[ids[i], ids[i + dir]] = [ids[i + dir]!, ids[i]!]
  return ids
}
