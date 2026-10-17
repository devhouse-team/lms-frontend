/**
 * API error codes → messages under `<ns>.err.<code>` (specs cohorts.md and programs.md, Errors). Pages switch on the
 * code, never on the HTTP status: Nitro turns some 422s into 409. Unknown codes fall back to common.saveError.
 */
export function useApiErrors(ns: 'cohorts' | 'programs' | 'content') {
  const { t, te } = useI18n()
  const toast = useToast()

  /** The cohort or program is gone: back to its list. toastError does it; inline error displays call it themselves. */
  function leaveIfGone(e: unknown) {
    if (ns !== 'content' && apiError(e).code === `${ns.slice(0, -1)}_not_found`) navigateTo(`/${ns}`)
  }

  function message(e: unknown, params: Record<string, string | number> = {}) {
    const { code, message } = apiError(e)
    if (code && te(`${ns}.err.${code}`)) return t(`${ns}.err.${code}`, params)
    if (code === 'validation_error' && message) return message
    return t('common.saveError')
  }

  function toastError(e: unknown, params: Record<string, string | number> = {}) {
    toast.add({ title: message(e, params), color: 'error', icon: 'i-lucide-circle-alert' })
    leaveIfGone(e)
  }

  return { message, toastError, leaveIfGone, code: (e: unknown) => apiError(e).code }
}

export const useCohortErrors = () => useApiErrors('cohorts')
export const useProgramErrors = () => useApiErrors('programs')
