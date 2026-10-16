const DERIVED = new Set(['programs', 'program-options', 'cohort-options', 'cohorts-mine', 'dashboard-head', 'dashboard-mentor'])

/**
 * After a program mutation that changes title, status, lead, cover or order: drop every key that shows programs.
 * `keep` is the open page's own key, which it refreshes instead (clearing it would blank the page first).
 */
export function invalidatePrograms(keep?: string) {
  clearNuxtData(key => key !== keep && (/^(program|cohort|cohorts):/.test(key) || DERIVED.has(key)))
}
