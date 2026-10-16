const DERIVED = new Set(['cohort-options', 'cohorts-mine', 'people', 'programs', 'dashboard-head', 'dashboard-mentor'])

/** After any cohort mutation: drop every cached list derived from cohort data; the page refreshes its own keys */
export function invalidateCohorts() {
  clearNuxtData(key => key.startsWith('cohorts:') || key.startsWith('program:') || DERIVED.has(key))
}
