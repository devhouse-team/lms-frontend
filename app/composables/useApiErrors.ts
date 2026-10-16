/**
 * API error codes → messages under `<ns>.err.<code>` (specs cohorts.md and programs.md, Errors). Pages switch on the
 * code, never on the HTTP status: Nitro turns some 422s into 409. Unknown codes fall back to common.saveError.
 */
export function useApiErrors(ns: 'cohorts' | 'programs') {
  const { t, te } = useI18n()
  const toast = useToast()

  function message(e: unknown, params: Record<string, string | number> = {}) {
    const { code, message } = apiError(e)
    // The cohort or program is gone: every mutation error goes through here, so one redirect covers them all
    if (code === `${ns.slice(0, -1)}_not_found`) navigateTo(`/${ns}`)
    if (code && te(`${ns}.err.${code}`)) return t(`${ns}.err.${code}`, params)
    if (code === 'validation_error' && message) return message
    return t('common.saveError')
  }

  const toastError = (e: unknown, params: Record<string, string | number> = {}) =>
    toast.add({ title: message(e, params), color: 'error', icon: 'i-lucide-circle-alert' })

  return { message, toastError, code: (e: unknown) => apiError(e).code }
}

export const useCohortErrors = () => useApiErrors('cohorts')
export const useProgramErrors = () => useApiErrors('programs')
