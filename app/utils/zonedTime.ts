/**
 * Exam times live in the cohort's IANA timezone (backend: opens_at / closes_at are UTC instants plus `timezone`).
 * The browser formats them in that zone and converts the cohort-local inputs of the window override back to UTC.
 */

/** Offset of `tz` from UTC at instant `ms`, in ms (Asia/Almaty → +5 h) */
function offsetAt(ms: number, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(new Date(ms)).map(x => [x.type, x.value]))
  return Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!) - Math.floor(ms / 1000) * 1000
}

/** ISO instant → `YYYY-MM-DDTHH:mm` as a clock in `tz` shows it (for <input type="datetime-local">) */
export function toZonedInput(iso: string, tz: string) {
  const ms = Date.parse(iso)
  return new Date(ms + offsetAt(ms, tz)).toISOString().slice(0, 16)
}

/** `YYYY-MM-DDTHH:mm` read on a clock in `tz` → ISO instant (UTC) */
export function fromZonedInput(local: string, tz: string) {
  const asUtc = Date.parse(`${local}:00Z`)
  let ms = asUtc - offsetAt(asUtc, tz)
  ms = asUtc - offsetAt(ms, tz) // second pass settles DST edges
  return new Date(ms).toISOString()
}

export const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone
