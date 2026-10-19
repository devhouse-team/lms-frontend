/**
 * Client-side pages over a list the page already holds in full (the cohort's roster, assignments, solutions come in
 * one call each). `page` stays in range when the list shrinks after a refetch.
 */
export function usePaged<T>(list: MaybeRefOrGetter<T[]>, size: number) {
  const page = ref(1)
  const total = computed(() => toValue(list).length)
  watch(total, (n) => {
    page.value = Math.min(page.value, Math.max(1, Math.ceil(n / size)))
  })
  const items = computed(() => toValue(list).slice((page.value - 1) * size, page.value * size))
  return { page, items, total, size }
}
