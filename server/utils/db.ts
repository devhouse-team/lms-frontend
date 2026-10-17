/**
 * In-memory mock for features the LMS API doesn't have yet:
 * contests, career steps and mentoring sessions (see backend spec/open-items.md).
 * Keyed by the real user id; state resets on restart and isn't shared between
 * server instances. Everything else goes through server/utils/api.ts.
 */
import type { EnrollmentStatus, ProgramSlug, Role, SubmissionStatus } from '~~/shared/types'

const HOUR = 3_600_000
const DAY = 24 * HOUR
const WEEK = 7 * DAY

export const DEMO_PASSWORD = 'devhouse'

export interface DbUser {
  id: string
  role: Role
  name: string
  email: string
  /** Mock only: plain text. Real backend must hash. */
  password: string
  avatar?: string
  title?: string
  telegram?: string
  cohortId?: string
  /** Mentees only; absent means active */
  enrollment?: EnrollmentStatus
}

export interface DbCohort {
  id: string
  name: string
  program: ProgramSlug
  mentorId?: string
  startAt: number
  totalWeeks: number
}

export interface DbSubmission {
  id: string
  menteeId: string
  assignmentId: string
  /** Denormalised assignment title for list views */
  title: string
  url: string
  note?: string
  submittedAt: number
  status: SubmissionStatus
  feedback?: string
  reviewedAt?: number
  reviewerId?: string
}

export interface DbAssignment {
  id: string
  cohortId: string
  title: string
  description: string
  dueAt: number
}

export interface DbInvite {
  token: string
  email: string
  role: Role
  cohortId?: string
  program?: ProgramSlug
  invitedBy: string
  expiresAt: number
  acceptedAt?: number
}

const now = Date.now()

const mentors: DbUser[] = [
  { id: 'm-nurzhan', role: 'mentor', name: 'Нұржан Изимбетов', email: 'nurzhan@demo.devhouse.kz', password: DEMO_PASSWORD, avatar: '/mentors/nurzhan-izimbetov.jpg', title: 'Ex Frontend Developer @TrustMe' },
  { id: 'm-yerassyl', role: 'mentor', name: 'Ерасыл Болат', email: 'yerassyl@demo.devhouse.kz', password: DEMO_PASSWORD, title: 'Frontend Developer' },
  { id: 'm-yedige', role: 'mentor', name: 'Едиге Аширбек', email: 'yedige@demo.devhouse.kz', password: DEMO_PASSWORD, avatar: '/mentors/yedige-ashirbek.jpg', title: 'Ex iOS intern @Yandex' },
  { id: 'm-daulet', role: 'mentor', name: 'Даулет Дандыкулов', email: 'daulet@demo.devhouse.kz', password: DEMO_PASSWORD, avatar: '/mentors/daulet-dandykulov.jpg', title: 'ML Engineer' },
  { id: 'm-abdurroshid', role: 'mentor', name: 'Абдуррошид Жаңаберген', email: 'abdurroshid@demo.devhouse.kz', password: DEMO_PASSWORD, avatar: '/mentors/abdurroshid-zhanabergen.jpg', title: 'ICPC 2x semifinalist' },
  { id: 'm-test', role: 'mentor', name: 'Test Mentor', email: 'test.mentor@devhouse.kz', password: DEMO_PASSWORD, title: 'QA test account' }
]

const head: DbUser = { id: 'h-1', role: 'head', name: 'Сауле Ахметова', email: 'head@demo.devhouse.kz', password: DEMO_PASSWORD }

const cohorts: DbCohort[] = [
  { id: 'c-fe7', name: 'FE-7', program: 'frontend', mentorId: 'm-nurzhan', startAt: now - 5 * WEEK - 2 * DAY, totalWeeks: 26 },
  { id: 'c-fe8', name: 'FE-8', program: 'frontend', mentorId: 'm-yerassyl', startAt: now - 2 * WEEK, totalWeeks: 26 },
  { id: 'c-mob3', name: 'MOB-3', program: 'mobile', mentorId: 'm-yedige', startAt: now - 9 * WEEK, totalWeeks: 26 },
  { id: 'c-ml2', name: 'ML-2', program: 'ml', mentorId: 'm-daulet', startAt: now - 12 * WEEK, totalWeeks: 26 },
  { id: 'c-algo4', name: 'ALGO-4', program: 'algorithms', mentorId: 'm-abdurroshid', startAt: now - 3 * WEEK, totalWeeks: 10 },
  { id: 'c-be1', name: 'BE-1', program: 'backend', startAt: now + 9 * DAY, totalWeeks: 26 }
]

const menteeNames: Record<string, string[]> = {
  'c-fe7': ['Алия Нурланова', 'Данияр Ахметов', 'Камила Серікқызы', 'Тимур Жанибеков', 'Мадина Оспанова', 'Арман Касымов', 'Айгерим Бекова', 'Руслан Ли', 'Жанель Абдрахманова'],
  'c-fe8': ['Ерлан Мусин', 'Сабина Каримова', 'Нурсултан Ермеков', 'Диана Ким', 'Асхат Тулегенов', 'Аружан Сейтова'],
  'c-mob3': ['Бекзат Омаров', 'Алина Петрова', 'Ислам Жумабаев', 'Томирис Алиева', 'Максат Сагинтаев', 'Лаура Есенова', 'Ильяс Нуржанов'],
  'c-ml2': ['Айдана Кенжебаева', 'Самат Байжанов', 'Эльвира Мухаметова', 'Нұрлан Әбдіков', 'Карина Шин'],
  'c-algo4': ['Азамат Ибраев', 'Мирас Тлеубаев', 'Дана Ахмадиева', 'Олжас Бекмуратов', 'Акмарал Сапарова', 'Ернар Калиев', 'Асель Нурмагамбетова', 'Абылай Орынбасаров'],
  'c-be1': []
}

const translit = (s: string) => s.toLowerCase().split(' ')[0]!
  .replace(/[аә]/g, 'a').replace(/б/g, 'b').replace(/в/g, 'v').replace(/[гғ]/g, 'g').replace(/д/g, 'd').replace(/е/g, 'e').replace(/ж/g, 'zh').replace(/з/g, 'z').replace(/[иі]/g, 'i').replace(/й/g, 'y').replace(/[кқ]/g, 'k').replace(/л/g, 'l').replace(/м/g, 'm').replace(/[нң]/g, 'n').replace(/[оө]/g, 'o').replace(/п/g, 'p').replace(/р/g, 'r').replace(/с/g, 's').replace(/т/g, 't').replace(/[уұү]/g, 'u').replace(/ф/g, 'f').replace(/[хһ]/g, 'h').replace(/ц/g, 'ts').replace(/ч/g, 'ch').replace(/ш/g, 'sh').replace(/щ/g, 'sch').replace(/[ыь]/g, '').replace(/э/g, 'e').replace(/ю/g, 'yu').replace(/я/g, 'ya')

const seededMentees: DbUser[] = Object.entries(menteeNames).flatMap(([cohortId, names]) =>
  names.map((name, i) => ({
    id: `s-${cohortId}-${i}`,
    role: 'mentee' as const,
    name,
    email: `${translit(name)}.${cohortId.slice(2)}@demo.devhouse.kz`,
    password: DEMO_PASSWORD,
    cohortId,
    ...(cohortId === 'c-fe7' && i === 0 ? { email: 'aliya@demo.devhouse.kz', telegram: '@aliya_demo' } : {})
  }))
)

const mentees: DbUser[] = [
  ...seededMentees,
  { id: 's-test', role: 'mentee', name: 'Test Student', email: 'test.mentee@devhouse.kz', password: DEMO_PASSWORD, cohortId: 'c-fe7' }
]

// Deterministic pseudo-random so the mock is stable between restarts
let seed = 7
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)


const assignmentTitles: Record<ProgramSlug, string[]> = {
  frontend: ['Ревью кода: корзина на Vue', 'Вёрстка лендинга по макету', 'Fetch API: список репозиториев'],
  backend: ['REST API для заметок'],
  mobile: ['Экран профиля на Flutter', 'Навигация между экранами', 'Кэширование ответов API'],
  ml: ['EDA датасета Titanic', 'Линейная регрессия с нуля'],
  algorithms: ['Бинпоиск: 5 задач', 'Двумерный префиксный массив', 'BFS на сетке']
}

const assignments: DbAssignment[] = cohorts.flatMap(c => [
  {
    id: `a-${c.id}-intro`,
    cohortId: c.id,
    title: 'Вводное задание: репозиторий и README',
    description: 'Создайте публичный репозиторий на GitHub, опишите в README цели на программу и пришлите ссылку.',
    dueAt: now - 5 * DAY
  },
  ...assignmentTitles[c.program].map((title, i) => ({
    id: `a-${c.id}-${i}`,
    cohortId: c.id,
    title,
    description: 'Описание задания (демо). Пришлите ссылку на репозиторий или pull request и коротко опишите, что сделано и где нужна помощь.',
    dueAt: now + (i === 0 ? 2 * DAY + 4 * HOUR : (i + 2) * DAY)
  }))
])

const feedbackSamples = [
  'Хорошая структура. Вынесите запросы к API в отдельный модуль и добавьте обработку ошибок.',
  'Всё работает, принято. Обратите внимание на названия переменных — местами непонятно, что внутри.',
  'Не хватает адаптива на мобильных. Поправьте и пришлите снова.'
]

const submissions: DbSubmission[] = mentees.flatMap((u) => {
  const cohortAssignments = assignments.filter(a => a.cohortId === u.cohortId)
  const mentorId = cohorts.find(c => c.id === u.cohortId)!.mentorId
  const n = Math.floor(rand() * 3)
  return Array.from({ length: n }, (_, i) => {
    const a = cohortAssignments[(i + 1) % cohortAssignments.length]!
    const r = rand()
    const status: SubmissionStatus = r < 0.55 ? 'waiting' : r < 0.8 ? 'accepted' : 'changes'
    const submittedAt = now - Math.floor(rand() * 96 + 2) * HOUR
    return {
      id: `sub-${u.id}-${i}`,
      menteeId: u.id,
      assignmentId: a.id,
      title: a.title,
      url: `https://github.com/demo-student/${a.id}`,
      submittedAt,
      status,
      ...(status === 'waiting'
        ? {}
        : { feedback: feedbackSamples[Math.floor(rand() * feedbackSamples.length)], reviewedAt: submittedAt + 6 * HOUR, reviewerId: mentorId })
    }
  })
})

// Every mentee has handed in the intro assignment; mentor accepted it.
for (const u of mentees) {
  const intro = assignments.find(a => a.cohortId === u.cohortId && a.id.endsWith('-intro'))!
  const mentorId = cohorts.find(c => c.id === u.cohortId)!.mentorId
  submissions.push({
    id: `sub-${u.id}-intro`,
    menteeId: u.id,
    assignmentId: intro.id,
    title: intro.title,
    url: `https://github.com/demo-student/${u.id}`,
    submittedAt: intro.dueAt - DAY,
    status: 'accepted',
    feedback: 'Отличный старт. Цели понятные — вернёмся к ним на середине программы.',
    reviewedAt: intro.dueAt,
    reviewerId: mentorId
  })
}

const invites: DbInvite[] = [
  { token: 'demo-mentee', email: 'new.student@demo.devhouse.kz', role: 'mentee', cohortId: 'c-fe8', invitedBy: head.name, expiresAt: now + 5 * DAY },
  { token: 'demo-mentor', email: 'backend.mentor@demo.devhouse.kz', role: 'mentor', program: 'backend', invitedBy: head.name, expiresAt: now + 2 * DAY },
  { token: 'demo-expired', email: 'late.student@demo.devhouse.kz', role: 'mentee', cohortId: 'c-mob3', invitedBy: head.name, expiresAt: now - 1 * DAY }
]

const contestRegistrations = new Set<string>(mentees.filter(() => rand() < 0.4).map(u => u.id).filter(id => id !== 's-c-fe7-0'))

export const CAREER_STEPS = ['cv', 'github', 'linkedin', 'mock', 'apply'] as const
export type CareerStepId = typeof CAREER_STEPS[number]
const career = new Map<string, Set<CareerStepId>>(
  mentees.map(u => [u.id, new Set(CAREER_STEPS.filter(() => rand() < 0.4))])
)
career.set('s-c-fe7-0', new Set(['cv', 'github']))

export interface DbContestResult {
  menteeId: string
  /** Problems solved, 0..problems */
  solved: number
}

export interface DbContest {
  id: string
  title: string
  at: number
  problems: number
  /** Present once the head has entered results */
  results?: DbContestResult[]
}

const pastContest = (id: string, weeksAgo: number): DbContest => ({
  id,
  title: 'LeetCode Contest',
  at: now - weeksAgo * WEEK,
  problems: 4,
  results: mentees.filter(() => rand() < 0.45).map(u => ({ menteeId: u.id, solved: Math.floor(rand() * 5) }))
})

const contests: DbContest[] = [
  pastContest('lc-2026-09-26', 2),
  pastContest('lc-2026-09-12', 4),
  { id: 'lc-2026-10-24', title: 'LeetCode Contest', at: new Date('2026-10-24T18:00:00+05:00').getTime(), problems: 4 }
]

export const db = {
  now,
  users: [head, ...mentors, ...mentees],
  cohorts,
  assignments,
  submissions,
  invites,
  contest: contests[contests.length - 1]!,
  contests,
  contestRegistrations,
  career
}

export const WEEK_MS = WEEK
export const DAY_MS = DAY
export const HOUR_MS = HOUR

export function cohortWeek(c: DbCohort, at = Date.now()) {
  return Math.min(c.totalWeeks, Math.max(0, Math.floor((at - c.startAt) / WEEK) + 1))
}
