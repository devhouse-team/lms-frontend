import type { RouterConfig } from '@nuxt/schema'

/**
 * Pages scroll inside the dashboard panel, not the window, so the router's own hash scroll misses: once the page has
 * loaded (at once for a hash on the same page), scroll the anchor (`#m-<id>`, `#week-<n>`) into view in whatever
 * box scrolls it. Content above it still grows after that (markdown renders async, a PDF card becomes an 80vh
 * viewer on mount), so the anchor is kept in place while the page resizes, until the reader scrolls or 2 s pass.
 */
function reveal(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ block: 'start' })
  const page = el.closest('[data-slot="body"]')?.firstElementChild
  if (!page) return
  const keep = new ResizeObserver(() => el.scrollIntoView({ block: 'start' }))
  const stop = () => {
    keep.disconnect()
    for (const e of ['wheel', 'touchstart', 'keydown', 'pointerdown']) removeEventListener(e, stop, true)
  }
  keep.observe(page)
  for (const e of ['wheel', 'touchstart', 'keydown', 'pointerdown']) addEventListener(e, stop, { capture: true, once: true })
  setTimeout(stop, 2000)
}

export default <RouterConfig>{
  scrollBehavior(to, from, savedPosition) {
    if (!to.hash) return savedPosition ?? { top: 0 }
    const id = decodeURIComponent(to.hash.slice(1))
    if (to.path === from.path) nextTick(() => reveal(id))
    else useNuxtApp().hooks.hookOnce('page:loading:end', () => nextTick(() => reveal(id)))
    return false
  }
}
