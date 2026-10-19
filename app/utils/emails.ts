/**
 * A pasted list of emails → unique addresses in first-seen order. Splits on commas, semicolons and whitespace, strips
 * `<…>` (a pasted "Name <a@b.kz>" leaves `a@b.kz`, its name words become entries the API reports as invalid),
 * lowercases. No email check: the API decides what's valid, so there's one rule for it.
 */
export function parseEmails(text: string): { emails: string[], dupes: number } {
  const all = text.split(/[\s,;]+/).map(s => s.replace(/^<+|>+$/g, '').trim().toLowerCase()).filter(Boolean)
  const emails = [...new Set(all)]
  return { emails, dupes: all.length - emails.length }
}
