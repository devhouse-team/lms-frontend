/** "week 3 of 12", or just "week 3" for a cohort without an end date (the API's ends_on is optional) */
export function useWeekLabel() {
  const { t } = useI18n()
  return (week: number, total: number) => (total ? t('mentor.week', { week, total }) : t('mentor.weekOpen', { week }))
}
