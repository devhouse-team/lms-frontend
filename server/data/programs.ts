import type { Program } from '~~/shared/types'

// Shared across all mentorship programs (everything except the standalone algorithms course)
const ALGO_LECTURES = 'Общие лекции: алгоритмы и структуры данных для технических интервью'

// Module titles copied from devhouse-client/src/data/<program>/syllabusItems.ts
export const programs: Program[] = [
  {
    slug: 'frontend',
    title: 'Frontend Development',
    months: 6,
    modules: ['Верстка: основы HTML и CSS', 'Основы JavaScript для начинающих', 'JavaScript на практике: API и асинхронность', 'Проект: сайт на HTML, CSS и JS', 'Введение в React', 'Управление состоянием: Redux', 'TypeScript и фреймворк Next.js', 'Проект: сайт на React, Next.js и TypeScript', 'Инструменты разработчика', 'Собственный проект', ALGO_LECTURES, 'Подготовка к интервью']
  },
  {
    slug: 'backend',
    title: 'Backend Development',
    months: 6,
    modules: ['Основы языка Python', 'Инструменты: Git, Linux, Docker', 'Базы данных', 'HTTP, REST и проектирование API', 'Аутентификация и безопасность', 'Архитектура и паттерны', 'Очереди и распределенные системы', 'Тестирование, CI/CD и деплой', ALGO_LECTURES, 'Подготовка к техническим интервью', 'Финальный Pet-проект']
  },
  {
    slug: 'mobile',
    title: 'Mobile Development',
    months: 6,
    modules: ['Основы языка Dart', 'Инструменты: Flutter SDK, IDE, Git', 'Flutter UI & Layouts', 'Управление состоянием (State Management)', 'Архитектура и навигация', 'Работа с сетью и API', 'Хранение данных и безопасность', 'Углубленный Flutter и оптимизация', ALGO_LECTURES, 'Подготовка к техническим интервью', 'Финальный Pet-проект']
  },
  {
    slug: 'ml',
    title: 'Machine Learning',
    months: 6,
    modules: ['Python, NumPy & Pandas для Data Science', 'Supervised Machine Learning', 'Advanced Learning Algorithms', 'Unsupervised Machine Learning', 'Исследовательский проект (Open Topic & Research Papers)', 'Нейронные сети и Deep Learning', 'Оптимизация глубоких нейросетей (Improving DNN)', ALGO_LECTURES, 'Bootcamp, хакатоны и алгоритмическая подготовка', 'Финальный Pet-проект и подготовка резюме', 'Подготовка к собеседованиям и трудоустройство']
  },
  {
    slug: 'algorithms',
    title: 'Algorithms & Data Structures',
    months: 2.5,
    modules: ['Основы и сложность алгоритмов', 'Сортировки и поиск', 'Базовые структуры данных', 'Рекурсия и перебор', 'Деревья и графы', 'Динамическое программирование', 'Продвинутые структуры', 'Подготовка к интервью и контестам']
  }
]
