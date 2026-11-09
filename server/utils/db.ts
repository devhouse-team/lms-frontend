/**
 * In-memory mock for features the LMS API doesn't have yet:
 * career steps and mentoring sessions (see backend spec/open-items.md).
 * Keyed by the real user id; state resets on restart and isn't shared between
 * server instances. The rest talks to the API straight from the browser (app/api).
 */

const HOUR = 3_600_000
const DAY = 24 * HOUR
const WEEK = 7 * DAY

interface DbUser {
  id: string
  name: string
  cohortId?: string
}

interface DbCohort {
  id: string
  name: string
  mentorId?: string
  startAt: number
}

const now = Date.now()

const cohorts: DbCohort[] = [
  { id: 'c-fe7', name: 'FE-7', mentorId: 'm-nurzhan', startAt: now - 5 * WEEK - 2 * DAY },
  { id: 'c-fe8', name: 'FE-8', mentorId: 'm-yerassyl', startAt: now - 2 * WEEK },
  { id: 'c-mob3', name: 'MOB-3', mentorId: 'm-yedige', startAt: now - 9 * WEEK },
  { id: 'c-ml2', name: 'ML-2', mentorId: 'm-daulet', startAt: now - 12 * WEEK },
  { id: 'c-algo4', name: 'ALGO-4', mentorId: 'm-abdurroshid', startAt: now - 3 * WEEK },
  { id: 'c-be1', name: 'BE-1', startAt: now + 9 * DAY }
]

const menteeNames: Record<string, string[]> = {
  'c-fe7': ['Алия Нурланова', 'Данияр Ахметов', 'Камила Серікқызы', 'Тимур Жанибеков', 'Мадина Оспанова', 'Арман Касымов', 'Айгерим Бекова', 'Руслан Ли', 'Жанель Абдрахманова'],
  'c-fe8': ['Ерлан Мусин', 'Сабина Каримова', 'Нурсултан Ермеков', 'Диана Ким', 'Асхат Тулегенов', 'Аружан Сейтова'],
  'c-mob3': ['Бекзат Омаров', 'Алина Петрова', 'Ислам Жумабаев', 'Томирис Алиева', 'Максат Сагинтаев', 'Лаура Есенова', 'Ильяс Нуржанов'],
  'c-ml2': ['Айдана Кенжебаева', 'Самат Байжанов', 'Эльвира Мухаметова', 'Нұрлан Әбдіков', 'Карина Шин'],
  'c-algo4': ['Азамат Ибраев', 'Мирас Тлеубаев', 'Дана Ахмадиева', 'Олжас Бекмуратов', 'Акмарал Сапарова', 'Ернар Калиев', 'Асель Нурмагамбетова', 'Абылай Орынбасаров'],
  'c-be1': []
}

const mentees: DbUser[] = Object.entries(menteeNames).flatMap(([cohortId, names]) =>
  names.map((name, i) => ({ id: `s-${cohortId}-${i}`, name, cohortId }))
)

// Deterministic pseudo-random so the mock is stable between restarts
let seed = 7
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)



export const CAREER_STEPS = ['cv', 'github', 'linkedin', 'mock', 'apply'] as const
export type CareerStepId = typeof CAREER_STEPS[number]
const career = new Map<string, Set<CareerStepId>>(
  mentees.map(u => [u.id, new Set(CAREER_STEPS.filter(() => rand() < 0.4))])
)
career.set('s-c-fe7-0', new Set(['cv', 'github']))



export const db = {
  users: mentees,
  cohorts,
  career
}

export const WEEK_MS = WEEK
export const HOUR_MS = HOUR
