/** One shared "now" per request so SSR and hydration agree. */
export function useNow() {
  return useState('now', () => Date.now())
}
