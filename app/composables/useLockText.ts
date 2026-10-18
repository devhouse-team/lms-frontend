/** Why a locked material is locked and when it opens (spec course-content.md, Lesson page: any locked) */
export function useLockText() {
  const { t } = useI18n()
  const { long } = useCohortFormat()
  return (m: { releaseHint: string | null, releasesOn: string | null }) => {
    if (m.releaseHint === 'after_due' && m.releasesOn) return t('material.lock.afterDue', { date: long(m.releasesOn) })
    if (m.releaseHint === 'after_submit') return t('material.lock.afterSubmit')
    if (m.releaseHint === 'manual') return t('material.lock.manual')
    return m.releasesOn ? t('material.lock.on', { date: long(m.releasesOn) }) : t('material.lock.later')
  }
}
