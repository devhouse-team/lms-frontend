/**
 * A notification link (API `link`, also the path in its email) → a path this app serves, or null when it would leave the
 * site. Rows and emails from before 2026-10-19 carry the API's old paths; newer ones pass through unchanged.
 */
const LEGACY: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^\/mentor\/submissions\/(\d+)\/?$/, m => `/reviews/${m[1]}`],
  [/^\/app\/cohorts\/(\d+)\/courses\/(\d+)\/?$/, m => `/courses/${m[1]}/${m[2]}`],
  // The resolver page sends an old lesson link to the lesson's first assignment
  [/^\/app\/cohorts\/(\d+)\/lessons\/(\d+)\/?$/, m => `/assignments/${m[1]}-${m[2]}`]
]

export function fixLink(path: string | null | undefined): string | null {
  // `//x` and `/\x` leave the site in browsers; control characters have no place in a path
  if (!path || !path.startsWith('/') || /^\/[/\\]/.test(path) || /[\u0000-\u001f\u007f]/.test(path)) return null
  for (const [re, to] of LEGACY) {
    const m = path.match(re)
    if (m) return to(m)
  }
  return path
}

/** The path is one of the old ones (the email redirect middleware answers only these) */
export const isLegacyLink = (path: string) => LEGACY.some(([re]) => re.test(path))
