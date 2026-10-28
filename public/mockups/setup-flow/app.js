/* Mockup of the guided setup flow: program → courses (import) → cohort → people. Fake data, no network. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    return `${n} ${m100 >= 11 && m100 <= 14 ? many : m10 === 1 ? one : m10 >= 2 && m10 <= 4 ? few : many}`;
  };
  const W = n => plural(n, 'неделя', 'недели', 'недель');
  // Shared surface for the wizard scripts (wizard-*.js), filled at the bottom
  const M = window.M = { wizards: {}, hooks: { click: [], input: [], change: [], submit: [] }, acts: {} };

  // ---------- dates ----------
  const parseDay = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const isoDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const fmtShort = d => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(d);
  const fmtLong = d => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  const nextMonday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return d; };

  // ---------- fake data ----------
  const MENTORS = ['Алишер Казтаев', 'Даулет Дандыков', 'Едиге Аширбек', 'Алмансур Максым', 'Абдурроший Жанаберген'];
  const EXISTING = [
    { id: 'git', title: 'Git и командная работа', modules: 3, lessons: 9 },
    { id: 'docker', title: 'Docker для разработчика', modules: 4, lessons: 11 },
    { id: 'algo', title: 'Алгоритмы и структуры данных', modules: 8, lessons: 28 },
    { id: 'clean', title: 'Чистый код и ревью', modules: 3, lessons: 7 }
  ];
  const initials = n => n.split(' ').map(x => x[0]).slice(0, 2).join('');

  const BASE_PROGRAM = { title: 'Backend на Python', weeks: 26, desc: 'Шесть месяцев от основ языка до готового API с базой данных и деплоем.', lead: MENTORS[0] };
  const BASE_COURSES = [
    { id: 'c1', title: 'Основы Python', start: 1, len: 6, modules: 6, lessons: 18 },
    { id: 'c2', title: 'Базы данных и SQL', start: 7, len: 5, modules: 5, lessons: 14 },
    { id: 'c3', title: 'Web API на FastAPI', start: 12, len: 8, modules: 8, lessons: 24 }
  ];
  const baseCohort = () => ({ name: 'Backend на Python · поток 1', start: isoDay(nextMonday()), tz: 'Asia/Almaty', mentors: [MENTORS[1]], emails: 12 });
  const SCENARIOS = {
    empty: () => ({ program: null, courses: [], cohort: null }),
    program: () => ({ program: { ...BASE_PROGRAM }, courses: [], cohort: null }),
    courses: () => ({ program: { ...BASE_PROGRAM }, courses: BASE_COURSES.map(c => ({ ...c })), cohort: null }),
    ready: () => ({ program: { ...BASE_PROGRAM }, courses: BASE_COURSES.map(c => ({ ...c })), cohort: baseCohort() })
  };

  const SAMPLES = {
    md: `# Основы Python
## Переменные и типы данных
- [video](https://video.devhouse.kz/py/types) Видео: типы данных
- [pdf](https://cdn.devhouse.kz/py/types.pdf) Конспект лекции
> task: Домашка 1. Калькулятор
## Условия и циклы
- [video](https://video.devhouse.kz/py/loops) Видео: if и for
> task: Домашка 2. Угадай число

# Функции и модули
## Функции
- [link](https://docs.python.org/3/tutorial/controlflow.html) Документация
- [video](https://video.devhouse.kz/py/functions) Разбор функций
> task: Домашка 3. Функции
## Модули и пакеты
- [pdf](https://cdn.devhouse.kz/py/modules.pdf) Шпаргалка по импортам

# Работа с файлами
## Чтение и запись
- [video](https://video.devhouse.kz/py/files) Файлы в Python
> task: Практика. Парсер логов
`,
    mdBad: `# Основы Python
## Переменные
- [video](video.devhouse.kz/py/types) Видео без https
- [pdf](https://cdn.devhouse.kz/py/types.pdf) Конспект
> task:
## Переменные
- [link](https://docs.python.org) Документация
## Пустой урок

# Модуль без уроков

# Циклы
- [video](https://video.devhouse.kz/py/loops) Материал вне урока
## For и while
- [gif](https://x.dev/a.gif) Неизвестный тип
> task: Домашка 2
`,
    csv: `module,lesson,type,title,url
Основы SQL,SELECT и фильтры,video,Видео: SELECT,https://video.devhouse.kz/sql/select
Основы SQL,SELECT и фильтры,task,Задача: выборка клиентов,
Основы SQL,JOIN,pdf,Шпаргалка по JOIN,https://cdn.devhouse.kz/sql/join.pdf
Основы SQL,JOIN,task,Задача: заказы и клиенты,
Индексы,Как работает индекс,video,Видео: B-tree,https://video.devhouse.kz/sql/index
Индексы,EXPLAIN,link,Документация PostgreSQL,https://www.postgresql.org/docs/current/sql-explain.html
Индексы,EXPLAIN,task,Задача: ускорить запрос,
`,
    json: JSON.stringify({
      modules: [
        { title: 'Основы FastAPI', lessons: [
          { title: 'Первый эндпоинт', items: [{ type: 'video', title: 'Видео: hello world', url: 'https://video.devhouse.kz/api/hello' }, { type: 'task', title: 'Задача: ping-сервис' }] },
          { title: 'Валидация через Pydantic', items: [{ type: 'pdf', title: 'Конспект', url: 'https://cdn.devhouse.kz/api/pydantic.pdf' }] }
        ] },
        { title: 'Авторизация', lessons: [
          { title: 'JWT', items: [{ type: 'video', title: 'Видео: токены', url: 'https://video.devhouse.kz/api/jwt' }, { type: 'task', title: 'Задача: логин и refresh' }] }
        ] }
      ]
    }, null, 2)
  };
  const FORMATS = { md: 'Markdown', csv: 'CSV / таблица', json: 'JSON', copy: 'Из курса' };
  const SYNTAX = {
    md: `<b>#</b> Модуль\n<b>##</b> Урок\n<b>- [video|pdf|link](url)</b> Название материала\n<b>&gt; task:</b> Название задания`,
    csv: `Первая строка: <b>module,lesson,type,title,url</b>\ntype: video, pdf, link или task (у task url не нужен)`,
    json: `{ "modules": [ { "title", "lessons": [ { "title", "items": [ { "type", "title", "url" } ] } ] } ] }`,
    copy: ''
  };

  // ---------- state ----------
  let S = SCENARIOS.empty();
  let scenario = 'empty';
  let F = {};                // form drafts
  let I = null;              // import session
  let panel = null;          // courses page: 'existing' | 'blank' | null

  const resetDrafts = () => {
    F = {
      program: S.program ? { ...S.program } : { title: '', weeks: 26, desc: '', lead: MENTORS[0] },
      cohort: S.cohort ? { ...S.cohort } : { ...baseCohort(), name: `${S.program ? S.program.title : 'Программа'} · поток 1`, mentors: [], emails: 0 },
      blankTitle: ''
    };
  };
  const newImport = () => ({
    fmt: 'md', texts: { md: '', csv: '', json: '', copy: '' }, copyId: null, error: '', tree: null, imported: false,
    s: { courseTitle: '', target: 'new', startWeek: 1, cadence: 1, publish: 'draft', taskMode: 'homework', maxScore: 100, deadline: 7, conflict: 'append' }
  });
  const setScenario = name => {
    scenario = name; S = SCENARIOS[name](); I = null; panel = null; resetDrafts();
    if (M.onScenario) M.onScenario(name);
    location.hash = '#/hub'; render();
  };

  // ---------- derived ----------
  const STEPS = [
    { id: 'program', name: 'Программа', hash: '#/program' },
    { id: 'courses', name: 'Курсы', hash: '#/courses' },
    { id: 'cohort', name: 'Поток', hash: '#/cohort' },
    { id: 'people', name: 'Люди', hash: '#/people' }
  ];
  const isDone = id => ({ program: !!S.program, courses: S.courses.length > 0, cohort: !!S.cohort, people: !!(S.cohort && S.cohort.mentors.length) })[id];
  const lockedWhy = id => {
    if (id !== 'program' && !S.program) return 'Сначала создайте программу';
    if (id === 'people' && !S.cohort) return 'Сначала запустите поток';
    return '';
  };
  const nextStep = () => STEPS.find(s => !isDone(s.id) && !lockedWhy(s.id));
  const subOf = id => {
    if (id === 'program') return S.program ? `${S.program.title}` : 'Не создана';
    if (id === 'courses') return S.courses.length ? plural(S.courses.length, 'курс', 'курса', 'курсов') : 'Пока нет';
    if (id === 'cohort') return S.cohort ? S.cohort.name : 'Не запущен';
    return S.cohort && S.cohort.mentors.length ? `${plural(S.cohort.mentors.length, 'ментор', 'ментора', 'менторов')} · ${S.cohort.emails} студ.` : 'Не назначены';
  };
  const maxEnd = () => S.courses.reduce((m, c) => Math.max(m, c.start + c.len - 1), 0);
  const nextFreeWeek = () => Math.min(104, (maxEnd() || 0) + 1);

  // ---------- toast ----------
  let toastTimer;
  const toast = msg => {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  };

  // ---------- stepper ----------
  function renderSteps(route) {
    const cur = route.name === 'import' ? 'courses' : route.name;
    $('#steps').innerHTML = `
      <p class="steps-title">Настройка обучения</p>
      <a class="step-link steps-hub ${route.name === 'hub' ? '' : ''}" href="#/hub" ${route.name === 'hub' ? 'aria-current="step"' : ''}>
        <span class="step-dot" aria-hidden="true">←</span>
        <span class="step-text"><span class="step-name">Что создать</span></span>
      </a>
      ${STEPS.map((s, i) => {
        const why = lockedWhy(s.id), done = isDone(s.id);
        return `${i ? '<div class="step-line" aria-hidden="true"></div>' : ''}
        <a class="step-link ${done ? 'done' : ''}" href="${why ? '#/hub' : s.hash}" ${why ? 'aria-disabled="true" title="' + esc(why) + '"' : ''} ${cur === s.id ? 'aria-current="step"' : ''}>
          <span class="step-dot" aria-hidden="true">${done ? '✓' : i + 1}</span>
          <span class="step-text"><span class="step-name">${s.name}</span><span class="step-sub">${esc(subOf(s.id))}</span></span>
        </a>`;
      }).join('')}`;
    $$('.chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.scenario === scenario)));
  }

  // ---------- views ----------
  function viewHub() {
    const n = nextStep();
    const copy = {
      program: ['Начнём с программы', 'Программа — маршрут обучения: длительность и набор курсов. Потоки запускаются из программы, поэтому без неё остальные шаги закрыты.', 'Создать программу', '#/program'],
      courses: [`Добавьте курсы в «${S.program?.title}»`, 'В программе пока нет курсов. Импортируйте план из Markdown или таблицы: это быстрее, чем собирать модули и уроки вручную.', 'Импортировать курс', '#/import/1'],
      cohort: ['Запустите первый поток', 'Курсы готовы. Выберите дату старта, и недели учебного плана превратятся в реальные даты.', 'Создать поток', '#/cohort'],
      people: ['Назначьте менторов и добавьте студентов', 'Поток создан. Осталось собрать команду: без ментора студентам некому сдавать работы.', 'Назначить людей', '#/people']
    };
    const c = n ? copy[n.id] : ['Всё настроено', 'Программа, курсы и поток готовы. Студенты получат приглашения, а недели плана откроются по расписанию.', 'Открыть сводку', '#/done'];
    return `<div class="page">
      <div class="page-head"><span class="eyebrow">Шаг ${n ? STEPS.indexOf(n) + 1 : 4} из 4</span><h1>${c[0]}</h1></div>
      <section class="panel next">
        <p>${c[1]}</p>
        <div class="actions">
          <a class="btn primary" href="${c[3]}">${c[2]} →</a>
          ${n && n.id === 'courses' ? '<a class="btn" href="#/courses">Другие способы</a>' : ''}
        </div>
      </section>
      <section>
        <h3 style="margin-bottom:8px">Чек-лист</h3>
        <ul class="checklist outline">
          ${STEPS.map((s, i) => {
            const why = lockedWhy(s.id), done = isDone(s.id), now = n && n.id === s.id;
            return `<li class="${why ? 'locked' : ''}">
              <span class="check-dot ${done ? 'done' : now ? 'now' : ''}">${done ? '✓' : i + 1}</span>
              <div class="grow"><div class="hi">${s.name}</div><div class="small muted">${esc(why || subOf(s.id))}</div></div>
              ${why ? '<span class="badge">Закрыто</span>' : `<a class="btn sm ${now ? 'soft' : ''}" href="${s.hash}">${done ? 'Изменить' : 'Открыть'}</a>`}
            </li>`;
          }).join('')}
        </ul>
      </section>
    </div>`;
  }

  function programPreview() {
    const p = F.program, t = p.title.trim();
    const months = Math.round(p.weeks / 4.345);
    return `<div class="pcard-cover" aria-hidden="true">${esc((t || 'DH').split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase())}</div>
      <div class="pcard-body">
        <div class="title">${esc(t || 'Название программы')}</div>
        <div class="small muted">${W(p.weeks || 0)}${months >= 1 ? ` · ${plural(months, 'месяц', 'месяца', 'месяцев')}` : ''} · ${S.courses.length ? plural(S.courses.length, 'курс', 'курса', 'курсов') : 'курсов пока нет'}</div>
        <dl><div class="row-i"><span class="avatar">${esc(initials(p.lead))}</span><span>${esc(p.lead)}</span></div></dl>
      </div>`;
  }
  function viewProgram() {
    const p = F.program, exists = !!S.program;
    return `<div class="page wide">
      <div class="page-head"><span class="eyebrow">Шаг 1 из 4</span><h1>${exists ? 'Программа' : 'Создайте программу'}</h1>
        <p>Название, длительность и ответственный. Курсы добавите на следующем шаге, обложку можно загрузить позже.</p></div>
      <div class="split">
        <form class="form" id="program-form" novalidate>
          <div class="field"><label for="p-title">Название</label>
            <input id="p-title" type="text" data-model="program.title" value="${esc(p.title)}" placeholder="Например, Backend на Python" autocomplete="off">
            <span class="help" id="p-title-err"></span></div>
          <div class="grid2">
            <div class="field"><label for="p-weeks">Длительность, недель</label>
              <input id="p-weeks" type="number" min="1" max="104" data-model="program.weeks" value="${p.weeks}">
              <span class="help" id="p-weeks-help"></span></div>
            <div class="field"><label for="p-lead">Ответственный за программу</label>
              <select id="p-lead" data-model="program.lead">${MENTORS.map(m => `<option ${m === p.lead ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
          </div>
          <div class="field"><label for="p-desc">Описание</label>
            <textarea id="p-desc" style="min-height:120px;font-family:var(--sans);font-size:14px" data-model="program.desc" placeholder="Чему научится студент">${esc(p.desc)}</textarea></div>
          <div class="footer-bar">
            <a class="btn ghost" href="#/hub">Отмена</a><span class="spacer"></span>
            <button type="submit" class="btn primary">${exists ? 'Сохранить' : 'Создать и перейти к курсам'} →</button>
          </div>
        </form>
        <aside><p class="label" style="margin-bottom:8px">Так программа выглядит в списке</p><div class="pcard" id="program-preview">${programPreview()}</div></aside>
      </div>
    </div>`;
  }

  function timeline() {
    const weeks = S.program.weeks;
    const pct = n => `${(n / weeks) * 100}%`;
    const head = Array.from({ length: weeks }, (_, i) => `<div class="tl-cell">${(i + 1) % 4 === 1 || weeks <= 12 ? i + 1 : ''}</div>`).join('');
    const cols = `style="grid-template-columns:repeat(${weeks},1fr)"`;
    return `<div class="tl"><div class="tl-in" style="min-width:${Math.max(640, 180 + weeks * 22)}px">
      <div class="tl-row tl-head"><div class="tl-name dim small">Неделя</div><div class="tl-track" ${cols}>${head}</div></div>
      ${S.courses.map(c => {
        const over = c.start + c.len - 1 > weeks;
        return `<div class="tl-row"><div class="tl-name" title="${esc(c.title)}">${esc(c.title)}</div>
          <div class="tl-track" ${cols}>${Array.from({ length: weeks }, () => '<div class="tl-cell"></div>').join('')}
            <div class="tl-bar ${over ? 'over' : ''} ${c.modules ? '' : 'empty'}" style="left:${pct(c.start - 1)};width:${pct(Math.min(c.len, weeks - c.start + 1))}">${c.start}–${c.start + c.len - 1}</div>
          </div></div>`;
      }).join('')}
    </div></div>`;
  }
  function coursesList() {
    return `<ol class="courses outline">${S.courses.map((c, i) => `<li>
      <span class="idx num">${i + 1}</span>
      <div class="grow"><div class="hi">${esc(c.title)}</div>
        <div class="small ${c.modules ? 'muted' : ''}" style="${c.modules ? '' : 'color:var(--warn)'}">${c.modules ? `${plural(c.modules, 'модуль', 'модуля', 'модулей')} · ${plural(c.lessons, 'урок', 'урока', 'уроков')} · ${W(c.len)}` : 'Нет модулей: добавьте содержимое в редакторе'}</div></div>
      <label class="week-in">Старт, неделя <input type="number" min="1" max="104" value="${c.start}" data-act-change="start" data-i="${i}" aria-label="Неделя старта: ${esc(c.title)}"></label>
      <span class="actions">
        <button class="btn ghost icon" data-act="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Выше">↑</button>
        <button class="btn ghost icon" data-act="down" data-i="${i}" ${i === S.courses.length - 1 ? 'disabled' : ''} aria-label="Ниже">↓</button>
        <button class="btn ghost icon danger" data-act="remove" data-i="${i}" aria-label="Убрать из программы">✕</button>
      </span></li>`).join('')}</ol>`;
  }
  function lengthNote() {
    const end = maxEnd(), w = S.program.weeks;
    if (!S.courses.length) return '';
    if (end > w) return `<div class="alert warn" role="alert">⚠ Контент длиннее программы: курсы занимают ${W(end)}, а в программе ${W(w)}. Подвиньте старт или увеличьте длительность.</div>`;
    if (w - end >= 2) return `<p class="small muted">Курсы занимают ${end} из ${W(w)}: ещё ${W(w - end)} свободно.</p>`;
    return '';
  }
  function addPanel() {
    if (panel === 'existing') {
      const taken = new Set(S.courses.map(c => c.title));
      const list = EXISTING.filter(e => !taken.has(e.title));
      return `<div class="panel way-panel">${list.length ? `<h3 style="margin-bottom:12px">Существующие курсы</h3><ul class="courses outline" style="background:var(--bg)">${list.map(e => `<li>
        <div class="grow"><div class="hi">${esc(e.title)}</div><div class="small muted">${plural(e.modules, 'модуль', 'модуля', 'модулей')} · ${plural(e.lessons, 'урок', 'урока', 'уроков')}</div></div>
        <button class="btn sm" data-act="add-existing" data-id="${e.id}">Добавить в конец</button></li>`).join('')}</ul>` : '<p class="muted">Все существующие курсы уже в программе.</p>'}</div>`;
    }
    if (panel === 'blank') {
      return `<form class="panel way-panel form" data-form="blank"><h3>Пустой курс</h3>
        <div class="field"><label for="b-title">Название курса</label><input id="b-title" type="text" data-model="blankTitle" value="${esc(F.blankTitle)}" placeholder="Например, Тестирование на pytest" autocomplete="off"></div>
        <p class="help">Курс создастся без модулей. Структуру добавите в редакторе, но для больших курсов быстрее импорт.</p>
        <div class="actions"><button class="btn primary" type="submit">Создать курс</button><button class="btn ghost" type="button" data-act="close-panel">Отмена</button></div></form>`;
    }
    return '';
  }
  function viewCourses() {
    const has = S.courses.length > 0;
    return `<div class="page wide">
      <div class="page-head"><span class="eyebrow">Шаг 2 из 4 · ${esc(S.program.title)}</span><h1>Курсы программы</h1>
        <p>Выберите, как собрать учебный план. Изменения влияют только на новые потоки: у запущенных своя копия.</p></div>
      <section>
        <div class="ways">
          <a class="way main" href="#/import/1" style="text-decoration:none"><span class="badge yellow">Быстрее всего</span>
            <span class="w-title">Импортировать</span><span class="w-desc">Вставьте план из Markdown, CSV или JSON. Увидите предпросмотр до создания.</span></a>
          <button class="way" data-act="panel" data-p="existing" aria-pressed="${panel === 'existing'}"><span class="w-title">Выбрать существующий</span><span class="w-desc">Подключить готовый курс и задать неделю старта.</span></button>
          <button class="way" data-act="panel" data-p="blank" aria-pressed="${panel === 'blank'}"><span class="w-title">Создать пустой</span><span class="w-desc">Только название. Модули и уроки добавите вручную.</span></button>
        </div>
        <div id="add-panel">${addPanel()}</div>
      </section>
      ${has ? `<section style="display:flex;flex-direction:column;gap:12px">
        <h2>Учебный план <span class="num muted" style="font-weight:400">${S.courses.length}</span></h2>
        ${timeline()}${lengthNote()}${coursesList()}</section>
        <div class="footer-bar"><a class="btn ghost" href="#/program">← Программа</a><span class="spacer"></span><a class="btn primary" href="#/cohort">Дальше: запустить поток →</a></div>`
      : `<section class="outline empty"><h2>В программе пока нет курсов</h2><p>Без курсов поток создастся пустым, и студентам нечего будет изучать. Начните с импорта: подготовленный план превращается в модули и уроки за минуту.</p>
        <a class="btn primary" href="#/import/1">Импортировать курс →</a></section>
        <div class="footer-bar"><a class="btn ghost" href="#/program">← Программа</a></div>`}
    </div>`;
  }

  // ---------- import: parsers ----------
  const KINDS = ['video', 'pdf', 'link', 'task'];
  const mkMod = (title, ln) => ({ title, lessons: [], on: true, ln });
  const mkLes = (title, ln) => ({ title, items: [], on: true, ln });

  function parseMd(text) {
    const modules = [], stray = [];
    let m = null, l = null;
    text.split('\n').forEach((raw, i) => {
      const line = raw.trim(), ln = i + 1;
      if (!line) return;
      let x;
      if ((x = line.match(/^#\s+(.*)$/))) { m = mkMod(x[1].trim(), ln); modules.push(m); l = null; }
      else if ((x = line.match(/^##\s+(.*)$/))) {
        if (!m) { m = mkMod('', ln); modules.push(m); }
        l = mkLes(x[1].trim(), ln); m.lessons.push(l);
      } else if ((x = line.match(/^[-*]\s*\[(\w+)\]\(([^)]*)\)\s*(.*)$/))) {
        if (!l) return stray.push({ ln, text: line });
        l.items.push({ kind: x[1].toLowerCase(), url: x[2].trim(), title: x[3].trim(), ln });
      } else if ((x = line.match(/^>\s*task:\s*(.*)$/i))) {
        if (!l) return stray.push({ ln, text: line });
        l.items.push({ kind: 'task', url: '', title: x[1].trim(), ln });
      } else stray.push({ ln, text: line });
    });
    return { modules, stray };
  }
  function parseCsv(text) {
    const modules = [], stray = [];
    const split = s => { const out = []; let cur = '', q = false; for (const ch of s) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(v => v.trim()); };
    const rows = text.split('\n').map((r, i) => ({ r: r.trim(), ln: i + 1 })).filter(x => x.r);
    rows.slice(1).forEach(({ r, ln }) => {
      const [mt = '', lt = '', type = '', title = '', url = ''] = split(r);
      let m = modules.find(x => x.title === mt); if (!m) { m = mkMod(mt, ln); modules.push(m); }
      if (!lt) return;
      let l = m.lessons.find(x => x.title === lt); if (!l) { l = mkLes(lt, ln); m.lessons.push(l); }
      if (type) l.items.push({ kind: type.toLowerCase(), url, title, ln });
    });
    return { modules, stray };
  }
  function parseJson(text) {
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.modules)) throw new Error('Ожидался объект с массивом "modules"');
    return { stray: [], modules: data.modules.map((m, mi) => {
      const mod = mkMod(m.title ?? '', mi + 1);
      mod.lessons = (m.lessons ?? []).map((l, li) => {
        const les = mkLes(l.title ?? '', li + 1);
        les.items = (l.items ?? []).map((it, k) => ({ kind: String(it.type ?? '').toLowerCase(), url: it.url ?? '', title: it.title ?? '', ln: k + 1 }));
        return les;
      });
      return mod;
    }) };
  }
  function genMd(c) {
    const out = [];
    for (let m = 1; m <= c.modules; m++) {
      out.push(`# Модуль ${m}`);
      const n = Math.max(1, Math.round(c.lessons / c.modules));
      for (let l = 1; l <= n; l++) out.push(`## Урок ${m}.${l}`, `- [video](https://video.devhouse.kz/${c.id}/${m}-${l}) Видео`, `> task: Задание ${m}.${l}`);
      out.push('');
    }
    return out.join('\n');
  }

  function validate(tree) {
    const seen = new Map();
    tree.modules.forEach((m, mi) => {
      m.issues = []; m.id = mi;
      if (!m.title.trim()) m.issues.push({ sev: 'err', msg: 'Нет названия модуля' });
      if (!m.lessons.length) m.issues.push({ sev: 'warn', msg: 'В модуле нет уроков: он будет пропущен' });
      m.lessons.forEach((l, li) => {
        l.issues = []; l.id = li;
        if (!l.title.trim()) l.issues.push({ sev: 'err', msg: 'Нет названия урока' });
        else {
          const key = l.title.trim().toLowerCase();
          if (seen.has(key)) l.issues.push({ sev: 'warn', msg: `Повтор названия (строка ${seen.get(key)})` });
          else seen.set(key, l.ln);
        }
        if (!l.items.length) l.issues.push({ sev: 'warn', msg: 'Пустой урок: ни материалов, ни заданий' });
        l.items.forEach((it) => {
          it.issues = [];
          if (!KINDS.includes(it.kind)) it.issues.push({ sev: 'err', msg: `Неизвестный тип «${it.kind || '—'}». Допустимо: ${KINDS.join(', ')}` });
          else if (it.kind === 'task') { if (!it.title.trim()) it.issues.push({ sev: 'err', msg: 'У задания нет названия' }); }
          else {
            if (!/^https?:\/\/\S+$/.test(it.url)) it.issues.push({ sev: 'err', msg: 'Ссылка должна начинаться с http:// или https://' });
            if (!it.title.trim()) it.issues.push({ sev: 'warn', msg: 'Нет названия: возьмём адрес ссылки' });
          }
        });
      });
    });
  }
  const live = tree => tree.modules.filter(m => m.on && m.lessons.length).map(m => ({ m, lessons: m.lessons.filter(l => l.on) }));
  function stats(tree) {
    const r = { modules: 0, lessons: 0, materials: 0, tasks: 0, errors: 0, warns: 0, skipped: 0 };
    const count = (arr) => arr.forEach(i => { if (i.sev === 'err') r.errors++; else r.warns++; });
    tree.modules.forEach((m) => {
      if (!m.on) { r.skipped++; return; }
      count(m.issues);
      if (m.lessons.length) r.modules++;
      m.lessons.forEach((l) => {
        if (!l.on) { r.skipped++; return; }
        r.lessons++; count(l.issues);
        l.items.forEach((it) => { count(it.issues); it.kind === 'task' ? r.tasks++ : r.materials++; });
      });
    });
    return r;
  }

  // ---------- import: views ----------
  const isteps = n => {
    const names = ['Источник', 'Настройки', 'Предпросмотр', 'Результат'];
    return `<ol class="isteps" aria-label="Шаги импорта">${names.map((t, i) => `<li class="${i + 1 === n ? 'cur' : i + 1 < n ? 'done' : ''}" ${i + 1 === n ? 'aria-current="step"' : ''}><span class="step-dot">${i + 1 < n ? '✓' : i + 1}</span>${t}</li>`).join('')}</ol>`;
  };
  function importHead(n, title, lead) {
    return `<div class="page-head"><span class="eyebrow"><a href="#/courses">← Курсы</a> · Импорт</span><h1>${title}</h1><p>${lead}</p></div>${isteps(n)}`;
  }

  function importSource() {
    const f = I.fmt;
    return `<div class="page wide">
      ${importHead(1, 'Откуда взять план курса?', 'Вставьте текст, загрузите файл или скопируйте структуру из существующего курса. На следующих шагах настроите правила и проверите результат.')}
      <div class="tabs" role="tablist">${Object.entries(FORMATS).map(([k, v]) => `<button class="tab" role="tab" aria-selected="${k === f}" data-act="fmt" data-f="${k}">${v}</button>`).join('')}</div>
      ${f === 'copy' ? `<div class="opts">${EXISTING.concat([{ id: 'py', title: 'Основы Python (из этой программы)', modules: 6, lessons: 18 }]).map(c => `<label class="opt"><input type="radio" name="copy" ${I.copyId === c.id ? 'checked' : ''} data-act-change="copy" data-id="${c.id}"><div><b>${esc(c.title)}</b><span>${plural(c.modules, 'модуль', 'модуля', 'модулей')} · ${plural(c.lessons, 'урок', 'урока', 'уроков')}. Скопируем структуру в виде черновика.</span></div></label>`).join('')}</div>`
      : `<div class="split src">
        <div class="field"><label for="src">Текст плана</label>
          <textarea id="src" data-src spellcheck="false" placeholder="Вставьте сюда план курса в формате ${FORMATS[f]}">${esc(I.texts[f])}</textarea>
          <div class="actions">
            <button class="btn sm" data-act="sample">Вставить пример</button>
            ${f === 'md' ? '<button class="btn sm" data-act="sample-bad">Пример с ошибками</button>' : ''}
            <label class="btn sm" style="cursor:pointer">Загрузить файл<input type="file" data-file accept=".md,.txt,.csv,.json" hidden></label>
            <button class="btn sm ghost" data-act="template">Скачать шаблон</button>
          </div></div>
        <aside style="display:flex;flex-direction:column;gap:8px"><span class="label">Формат</span><div class="syntax">${SYNTAX[f]}</div>
          <p class="help">Файл не уходит на сервер: разбор идёт в браузере, и ничего не создаётся, пока вы не подтвердите на шаге 4.</p></aside>
      </div>`}
      ${I.error ? `<div class="alert err" role="alert">✕ ${esc(I.error)}</div>` : ''}
      <div class="footer-bar"><a class="btn ghost" href="#/courses">Отмена</a><span class="spacer"></span>
        <button class="btn primary" data-act="to-settings" ${currentText().trim() ? '' : 'disabled'}>Дальше: настройки →</button></div>
    </div>`;
  }
  const currentText = () => I.texts[I.fmt === 'copy' ? 'md' : I.fmt];

  function importSettings() {
    const s = I.s;
    return `<div class="page wide">
      ${importHead(2, 'Настройки импорта', 'Эти правила применятся ко всему плану. Всё можно будет поправить в предпросмотре.')}
      <form class="form" id="settings-form" novalidate>
        <section class="panel form">
          <h3>Куда импортируем</h3>
          <div class="grid2">
            <div class="field"><label for="s-title">Название нового курса</label><input id="s-title" type="text" data-model="s.courseTitle" value="${esc(s.courseTitle)}" placeholder="Например, Основы Python" autocomplete="off"></div>
            <div class="field"><label for="s-target">Назначение</label><select id="s-target" data-model="s.target" data-rerender><option value="new" ${s.target === 'new' ? 'selected' : ''}>Новый курс</option>${EXISTING.map(e => `<option value="${e.id}" ${s.target === e.id ? 'selected' : ''}>В курс «${esc(e.title)}»</option>`).join('')}</select></div>
          </div>
          ${s.target !== 'new' ? `<div class="field"><span class="label">Если в курсе уже есть содержимое</span><div class="opts">${[['append', 'Добавить в конец', 'Существующее не трогаем'], ['skip', 'Пропустить дубликаты', 'Уроки с совпадающим названием не создаются'], ['replace', 'Заменить всё', 'Старые модули удалятся. Действие необратимо']].map(([v, t, d]) => `<label class="opt"><input type="radio" name="conflict" value="${v}" data-model="s.conflict" ${s.conflict === v ? 'checked' : ''}><div><b>${t}</b><span>${d}</span></div></label>`).join('')}</div></div>` : ''}
        </section>
        <section class="panel form">
          <h3>Расписание открытия</h3>
          <div class="grid3">
            <div class="field"><label for="s-cad">Открывать модули</label><select id="s-cad" data-model="s.cadence" data-num><option value="1" ${s.cadence === 1 ? 'selected' : ''}>Раз в неделю</option><option value="2" ${s.cadence === 2 ? 'selected' : ''}>Раз в 2 недели</option><option value="0" ${s.cadence === 0 ? 'selected' : ''}>Все сразу</option></select></div>
            <div class="field"><label for="s-start">Первый модуль, неделя</label><input id="s-start" type="number" min="1" max="104" data-model="s.startWeek" data-num value="${s.startWeek}"></div>
            <div class="field"><label for="s-pub">Уроки после импорта</label><select id="s-pub" data-model="s.publish"><option value="draft" ${s.publish === 'draft' ? 'selected' : ''}>Черновики</option><option value="now" ${s.publish === 'now' ? 'selected' : ''}>Сразу опубликованы</option></select></div>
          </div>
          <p class="help">Неделя считается от старта потока. Пример: «раз в неделю, с 1-й» → модуль 1 открывается на 1-й неделе, модуль 2 на 2-й и так далее.</p>
        </section>
        <section class="panel form">
          <h3>Задания по умолчанию</h3>
          <div class="grid3">
            <div class="field"><label for="s-mode">Тип</label><select id="s-mode" data-model="s.taskMode"><option value="homework" ${s.taskMode === 'homework' ? 'selected' : ''}>Домашка</option><option value="exam" ${s.taskMode === 'exam' ? 'selected' : ''}>Экзамен</option></select></div>
            <div class="field"><label for="s-max">Максимум баллов</label><input id="s-max" type="number" min="1" max="1000" data-model="s.maxScore" data-num value="${s.maxScore}"></div>
            <div class="field"><label for="s-dl">Дедлайн, дней после открытия</label><input id="s-dl" type="number" min="1" max="90" data-model="s.deadline" data-num value="${s.deadline}"></div>
          </div>
        </section>
        <div class="footer-bar"><button type="button" class="btn ghost" data-act="go" data-to="#/import/1">← Источник</button><span class="spacer"></span>
          <button type="submit" class="btn primary">Дальше: предпросмотр →</button></div>
      </form>
    </div>`;
  }

  const issuesHtml = arr => (arr || []).map(i => `<span class="issue ${i.sev}">${i.sev === 'err' ? '✕' : '⚠'} ${esc(i.msg)}</span>`).join(' ');
  function weekOf(idx) {
    const { cadence, startWeek } = I.s;
    return startWeek + idx * cadence;
  }
  function previewTree() {
    const t = I.tree;
    let idx = -1;
    return `<div class="tree">${t.modules.map((m, mi) => {
      if (m.on && m.lessons.length) idx++;
      const err = m.on && (m.issues.some(i => i.sev === 'err') || m.lessons.some(l => l.on && (l.issues.some(i => i.sev === 'err') || l.items.some(it => it.issues.some(i => i.sev === 'err')))));
      return `<div class="tmod ${m.on ? '' : 'off'} ${err ? 'has-err' : ''}">
        <div class="tmod-head">
          <input type="checkbox" ${m.on ? 'checked' : ''} data-act-change="tog-mod" data-m="${mi}" aria-label="Включить модуль">
          <input type="text" value="${esc(m.title)}" placeholder="Название модуля" data-act-change="title-mod" data-m="${mi}" aria-label="Название модуля">
          ${m.on && m.lessons.length ? `<span class="badge yellow num">неделя ${weekOf(idx)}</span>` : ''}
          <span class="small muted num" style="margin-left:auto">${plural(m.lessons.length, 'урок', 'урока', 'уроков')}</span>
        </div>
        ${m.issues.length ? `<div style="padding:6px 16px">${issuesHtml(m.issues)}</div>` : ''}
        ${m.lessons.map((l, li) => `<div class="tless ${m.on && l.on ? '' : 'off'}">
          <div class="tless-head">
            <input type="checkbox" ${l.on ? 'checked' : ''} ${m.on ? '' : 'disabled'} data-act-change="tog-les" data-m="${mi}" data-l="${li}" aria-label="Включить урок">
            <input type="text" value="${esc(l.title)}" placeholder="Название урока" data-act-change="title-les" data-m="${mi}" data-l="${li}" aria-label="Название урока">
            <span class="ln">стр. ${l.ln}</span>
          </div>
          ${l.issues.length ? `<div style="margin-left:26px">${issuesHtml(l.issues)}</div>` : ''}
          ${l.items.length ? `<ul class="titems">${l.items.map(it => `<li><span class="kind ${it.kind === 'task' ? 'task' : ''}">${esc(it.kind || '?')}</span><span>${esc(it.title || it.url || '—')}</span>${it.kind === 'task' ? `<span class="small dim">${I.s.taskMode === 'exam' ? 'экзамен' : 'домашка'} · ${I.s.maxScore} б. · дедлайн +${I.s.deadline} дн.</span>` : ''}${issuesHtml(it.issues)}</li>`).join('')}</ul>` : ''}
        </div>`).join('')}
      </div>`;
    }).join('')}</div>${t.stray.length ? `<div class="alert warn">⚠ Не распознано и пропущено: ${t.stray.map(s => `<span class="mono">стр. ${s.ln}</span>`).join(', ')}</div>` : ''}`;
  }
  function summaryBar() {
    const r = stats(I.tree);
    return `<div class="stat"><b>${r.modules}</b> ${plural(r.modules, 'модуль', 'модуля', 'модулей').split(' ')[1]}</div><div class="stat"><b>${r.lessons}</b> ${plural(r.lessons, 'урок', 'урока', 'уроков').split(' ')[1]}</div><div class="stat"><b>${r.materials}</b> ${plural(r.materials, 'материал', 'материала', 'материалов').split(' ')[1]}</div><div class="stat"><b>${r.tasks}</b> ${plural(r.tasks, 'задание', 'задания', 'заданий').split(' ')[1]}</div>
      ${r.errors ? `<span class="badge err">${plural(r.errors, 'ошибка', 'ошибки', 'ошибок')}</span>` : '<span class="badge ok">Ошибок нет</span>'}
      ${r.warns ? `<span class="badge warn">${plural(r.warns, 'предупреждение', 'предупреждения', 'предупреждений')}</span>` : ''}`;
  }
  function importPreview() {
    return `<div class="page wide">
      ${importHead(3, 'Предпросмотр', 'Проверьте структуру. Названия можно править, лишнее выключить галочкой. Ошибки блокируют импорт, предупреждения нет.')}
      <div class="summary" id="summary">${summaryBar()}</div>
      <div id="tree">${previewTree()}</div>
      <div class="footer-bar"><button class="btn ghost" data-act="go" data-to="#/import/2">← Настройки</button><span class="spacer"></span>
        <span class="small muted" id="blocked"></span>
        <button class="btn primary" id="run-import" data-act="run-import">Импортировать →</button></div>
    </div>`;
  }
  function refreshPreview() {
    validate(I.tree);
    $('#summary').innerHTML = summaryBar();
    $('#tree').innerHTML = previewTree();
    const r = stats(I.tree);
    $('#run-import').disabled = r.errors > 0 || r.lessons === 0;
    $('#blocked').textContent = r.errors ? 'Исправьте ошибки или выключите строки с ними' : r.lessons === 0 ? 'Нечего импортировать' : '';
  }

  function importResult() {
    const r = stats(I.tree);
    return `<div class="page wide">
      ${importHead(4, I.imported ? 'Курс импортирован' : 'Создаём курс…', I.imported ? 'Структура создана. Теперь курс можно открыть в редакторе или сразу добавить в программу.' : 'Не закрывайте вкладку: создаём модули, уроки и задания.')}
      <div class="progress" aria-hidden="true"><i id="bar"></i></div>
      <ul class="log" id="log" aria-live="polite"></ul>
      <div id="report" hidden>
        <div class="report">
          <div><div class="big">${r.modules}</div><div class="small muted">модулей создано</div></div>
          <div><div class="big">${r.lessons}</div><div class="small muted">уроков создано</div></div>
          <div><div class="big">${r.materials + r.tasks}</div><div class="small muted">материалов и заданий</div></div>
          <div><div class="big">${r.skipped}</div><div class="small muted">пропущено вручную</div></div>
        </div>
      </div>
      <div class="footer-bar" id="result-actions" hidden>
        <button class="btn ghost" data-act="toast" data-m="В макете редактор не подключён">Открыть в редакторе</button><span class="spacer"></span>
        <button class="btn primary" data-act="add-imported">Добавить в программу →</button></div>
    </div>`;
  }
  function runImportAnim() {
    const r = stats(I.tree);
    const steps = [];
    live(I.tree).forEach(({ m, lessons }) => {
      steps.push(`Модуль «${m.title}»`);
      lessons.forEach(l => steps.push(`  Урок «${l.title}» · ${plural(l.items.length, 'элемент', 'элемента', 'элементов')}`));
    });
    steps.push(`Готово: ${plural(r.lessons, 'урок', 'урока', 'уроков')} в курсе «${I.s.courseTitle || 'Новый курс'}»`);
    const log = $('#log'), bar = $('#bar');
    let i = 0;
    const tick = () => {
      if (!$('#log')) return;
      if (i < steps.length) {
        const li = document.createElement('li'); li.textContent = `✓ ${steps[i]}`; log.append(li); log.scrollTop = log.scrollHeight;
        bar.style.width = `${Math.round(((i + 1) / steps.length) * 100)}%`; i++;
        setTimeout(tick, 110);
      } else {
        I.imported = true;
        $('h1').textContent = 'Курс импортирован';
        $('.page-head p').textContent = 'Структура создана. Теперь курс можно открыть в редакторе или сразу добавить в программу.';
        $('#report').hidden = false; $('#result-actions').hidden = false;
      }
    };
    tick();
  }

  function viewImport(n) {
    if (!I) I = newImport();
    if (n >= 3 && !I.tree) return viewImport(1);
    return [importSource, importSettings, importPreview, importResult][n - 1]();
  }

  // ---------- cohort ----------
  function cohortPlan() {
    const c = F.cohort, start = c.start ? parseDay(c.start) : null;
    if (!start) return '<p class="muted" style="padding:16px">Выберите дату старта, и здесь появится план по неделям.</p>';
    const end = addDays(start, S.program.weeks * 7 - 1);
    const rows = S.courses.map(co => {
      const a = addDays(start, (co.start - 1) * 7), b = addDays(a, co.len * 7 - 1);
      return `<li><div><div class="hi">${esc(co.title)}</div><div class="small muted">${co.modules ? plural(co.modules, 'модуль', 'модуля', 'модулей') : 'без модулей'} · недели ${co.start}–${co.start + co.len - 1}</div></div><div class="when">${fmtShort(a)} — ${fmtShort(b)}<br><span class="dim">${new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(a)}</span></div></li>`;
    }).join('');
    return `<ul class="plan">${rows || '<li><span class="muted">В программе нет курсов, поток создастся пустым.</span></li>'}
      <li><div class="hi">Завершение потока</div><div class="when">${fmtLong(end)}</div></li></ul>`;
  }
  function viewCohort() {
    const c = F.cohort, exists = !!S.cohort;
    return `<div class="page wide">
      <div class="page-head"><span class="eyebrow">Шаг 3 из 4</span><h1>${exists ? 'Поток' : 'Запустите поток'}</h1>
        <p>Поток — группа студентов с ментором, которая проходит программу «${esc(S.program.title)}» с выбранной даты.</p></div>
      ${S.courses.length ? '' : '<div class="alert warn" role="alert">⚠ В программе нет курсов, поток создастся пустым. <a href="#/courses">Добавить курсы</a></div>'}
      <div class="split cohort">
        <form class="form" id="cohort-form" novalidate>
          <div class="field"><label for="c-name">Название потока</label><input id="c-name" type="text" data-model="cohort.name" value="${esc(c.name)}" autocomplete="off"><span class="help" id="c-name-err"></span></div>
          <div class="field"><span class="label">Программа</span><div class="hi" style="padding:8px 0">${esc(S.program.title)} <span class="badge">${W(S.program.weeks)}</span></div></div>
          <div class="grid2">
            <div class="field"><label for="c-start">Старт</label><input id="c-start" type="date" data-model="cohort.start" value="${c.start}"><span class="help">Лучше начинать в понедельник</span></div>
            <div class="field"><label for="c-end">Окончание</label><input id="c-end" type="date" value="${c.start ? isoDay(addDays(parseDay(c.start), S.program.weeks * 7 - 1)) : ''}" disabled><span class="help" id="c-end-help">Старт + ${W(S.program.weeks)}</span></div>
          </div>
          <div class="field"><label for="c-tz">Часовой пояс</label><select id="c-tz" data-model="cohort.tz"><option>Asia/Almaty</option><option>Asia/Tashkent</option><option>Europe/Moscow</option><option>UTC</option></select><span class="help">По нему считаются дедлайны и окна экзаменов</span></div>
          <div class="footer-bar"><a class="btn ghost" href="#/courses">← Курсы</a><span class="spacer"></span>
            <button class="btn primary" type="submit">${exists ? 'Сохранить' : 'Создать поток'} →</button></div>
        </form>
        <aside><p class="label" style="margin-bottom:8px">План потока по датам</p><div class="outline" id="cohort-plan">${cohortPlan()}</div>
          <p class="help" style="margin-top:8px">У потока своя копия учебного плана: последующие правки программы его не изменят.</p></aside>
      </div>
    </div>`;
  }

  // ---------- people ----------
  function viewPeople() {
    const c = S.cohort;
    return `<div class="page">
      <div class="page-head"><span class="eyebrow">Шаг 4 из 4 · ${esc(c.name)}</span><h1>Менторы и студенты</h1><p>Назначьте хотя бы одного ментора. Студентов можно добавить сейчас или позже из страницы потока.</p></div>
      <form class="form" id="people-form" novalidate>
        <section class="panel form"><h3>Менторы потока</h3>
          <div class="mentors">${MENTORS.map(m => `<label class="mentor"><input type="checkbox" value="${esc(m)}" ${c.mentors.includes(m) ? 'checked' : ''} data-mentor><span class="avatar">${esc(initials(m))}</span><span><b>${esc(m)}</b><span class="small muted">Ментор</span></span></label>`).join('')}</div></section>
        <section class="panel form"><h3>Студенты</h3>
          <div class="field"><label for="emails">Почты, по одной в строке или через запятую</label>
            <textarea id="emails" style="min-height:120px" data-emails placeholder="student1@example.com&#10;student2@example.com"></textarea>
            <span class="help" id="emails-help">${c.emails ? `Уже в потоке: ${c.emails}` : 'Пока никого'}</span></div>
          <p class="help">Каждый получит приглашение на почту. Для списка из таблицы подойдёт загрузка CSV на странице потока.</p></section>
        <div class="footer-bar"><a class="btn ghost" href="#/cohort">← Поток</a><span class="spacer"></span><button class="btn primary" type="submit">Завершить настройку →</button></div>
      </form></div>`;
  }

  function viewDone() {
    const c = S.cohort;
    return `<div class="page">
      <div class="page-head"><span class="eyebrow">Готово</span><h1>Обучение настроено</h1><p>Первая неделя откроется ${fmtLong(parseDay(c.start)).replace(/ г\.$/, '')}. Приглашения уйдут студентам автоматически.</p></div>
      <ul class="done-list outline">
        <li><span class="check-dot done">✓</span><div class="grow" style="flex:1"><div class="hi">Программа «${esc(S.program.title)}»</div><div class="small muted">${W(S.program.weeks)} · ${esc(S.program.lead)}</div></div><a class="btn sm" href="#/program">Изменить</a></li>
        <li><span class="check-dot done">✓</span><div style="flex:1"><div class="hi">${plural(S.courses.length, 'курс', 'курса', 'курсов')}</div><div class="small muted">${S.courses.map(x => esc(x.title)).join(', ') || '—'}</div></div><a class="btn sm" href="#/courses">Изменить</a></li>
        <li><span class="check-dot done">✓</span><div style="flex:1"><div class="hi">${esc(c.name)}</div><div class="small muted">${fmtShort(parseDay(c.start))} — ${fmtShort(addDays(parseDay(c.start), S.program.weeks * 7 - 1))}</div></div><a class="btn sm" href="#/cohort">Изменить</a></li>
        <li><span class="check-dot done">✓</span><div style="flex:1"><div class="hi">${esc(c.mentors.join(', ') || 'Менторы не назначены')}</div><div class="small muted">${c.emails} студентов приглашено</div></div><a class="btn sm" href="#/people">Изменить</a></li>
      </ul>
      <div class="actions"><button class="btn primary" data-act="toast" data-m="В макете страница потока не подключена">Открыть поток</button><a class="btn" href="#/hub">К чек-листу</a></div></div>`;
  }

  // ---------- router ----------
  function route() {
    const h = (location.hash || '#/hub').slice(2).split('/');
    const name = h[0] || 'hub';
    if (M.wizards[name]) return { name, n: Math.min(M.wizards[name].steps.length + 1, Math.max(1, Number(h[1]) || 1)) };
    if (!['hub', 'all', 'program', 'courses', 'import', 'cohort', 'people', 'done'].includes(name)) return { name: 'hub' };
    if (name === 'import') return { name, n: Math.min(4, Math.max(1, Number(h[1]) || 1)) };
    return { name };
  }
  function render() {
    let r = route();
    const lock = (r.name === 'hub' || r.name === 'all' || M.wizards[r.name]) ? '' : r.name === 'import' ? lockedWhy('courses') : r.name === 'done' ? (S.cohort ? '' : 'x') : lockedWhy(r.name);
    if (lock) { location.replace('#/hub'); r = { name: 'hub' }; }
    if (r.name !== 'import' && r.name !== 'hub') { /* keep import session while navigating */ }
    if (r.name === 'program' || r.name === 'cohort') { if (!F.program) resetDrafts(); }
    if (M.wizards[r.name]) {
      M.cur = r;
      const wz = M.wizards[r.name];
      M.W.reach[r.name] = Math.max(M.W.reach[r.name] || 1, r.n);
      $('#view').innerHTML = wz.view(r.n);
      $('#steps').innerHTML = M.rail(r.name, r.n);
      $$('.chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.scenario === scenario)));
      if (wz.after) wz.after(r.n);
      return window.scrollTo(0, 0);
    }
    M.cur = r;
    const views = { hub: () => M.hubView(), all: viewHub, program: viewProgram, courses: viewCourses, cohort: viewCohort, people: viewPeople, done: viewDone, import: () => viewImport(r.n) };
    const html = views[r.name]();
    $('#view').innerHTML = html;
    renderSteps(r);
    if (r.name === 'hub') $('#steps').innerHTML = M.hubRail();
    if (r.name === 'import' && r.n === 4 && I && !I.imported) runImportAnim();
    if (r.name === 'import' && r.n === 4 && I && I.imported) { $('#log').innerHTML = ''; runImportAnim(); }
    if (r.name === 'program') updateProgramHelp();
    if (r.name === 'import' && r.n === 3) refreshPreview();
    window.scrollTo(0, 0);
  }

  // ---------- events ----------
  const setPath = (root, path, val) => { const keys = path.split('.'); let o = root; keys.slice(0, -1).forEach(k => (o = o[k])); o[keys.at(-1)] = val; };
  const ROOT = () => ({ program: F.program, cohort: F.cohort, blankTitle: F.blankTitle, s: I?.s });
  function updateProgramHelp() {
    const w = F.program.weeks, el = $('#p-weeks-help');
    if (el) el.textContent = w >= 1 && w <= 104 ? `${Math.round(w / 4.345) >= 1 ? '≈ ' + plural(Math.round(w / 4.345), 'месяц', 'месяца', 'месяцев') : 'меньше месяца'}` : 'От 1 до 104 недель';
  }

  document.addEventListener('input', (e) => {
    if (M.hooks.input.some(h => h(e))) return;
    const t = e.target;
    if (t.dataset.model) {
      const root = ROOT(), key = t.dataset.model;
      const val = t.type === 'radio' ? t.value : (t.type === 'number' || 'num' in t.dataset) ? Number(t.value) : t.value;
      if (key === 'blankTitle') F.blankTitle = val; else setPath(root, key, val);
      if (key.startsWith('program.')) { const p = $('#program-preview'); if (p) p.innerHTML = programPreview(); updateProgramHelp(); }
      if (key.startsWith('cohort.')) {
        const p = $('#cohort-plan'); if (p) p.innerHTML = cohortPlan();
        const ce = $('#c-end'); if (ce && F.cohort.start) ce.value = isoDay(addDays(parseDay(F.cohort.start), S.program.weeks * 7 - 1));
      }
    }
    if (t.matches('[data-src]')) { I.texts[I.fmt] = t.value; I.error = ''; const b = $('[data-act="to-settings"]'); if (b) b.disabled = !t.value.trim(); }
    if (t.matches('[data-emails]')) {
      const n = new Set(t.value.split(/[\s,;]+/).filter(x => /^\S+@\S+\.\S+$/.test(x))).size;
      $('#emails-help').textContent = n ? `Распознано адресов: ${n}` : 'Пока никого';
      t.dataset.n = n;
    }
  });

  document.addEventListener('change', (e) => {
    if (M.hooks.change.some(h => h(e))) return;
    const t = e.target, a = t.dataset.actChange;
    if (t.dataset.model && 'rerender' in t.dataset) render();
    if (t.matches('[data-file]')) {
      const f = t.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        const ext = f.name.split('.').pop().toLowerCase();
        I.fmt = ext === 'csv' ? 'csv' : ext === 'json' ? 'json' : 'md';
        I.texts[I.fmt] = String(rd.result); I.error = ''; render(); toast(`Загружено: ${f.name}`);
      };
      rd.readAsText(f);
    }
    if (!a) return;
    const m = Number(t.dataset.m), l = Number(t.dataset.l), i = Number(t.dataset.i);
    if (a === 'start') {
      const v = Math.min(104, Math.max(1, Number(t.value) || 1));
      S.courses[i].start = v; render();
    }
    if (a === 'copy') {
      const c = EXISTING.concat([{ id: 'py', title: 'Основы Python', modules: 6, lessons: 18 }]).find(x => x.id === t.dataset.id);
      I.copyId = c.id; I.texts.md = genMd(c); I.s.courseTitle = `${c.title} (копия)`; toast('Структура скопирована в Markdown');
      $('[data-act="to-settings"]').disabled = false;
    }
    if (a === 'tog-mod') { I.tree.modules[m].on = t.checked; refreshPreview(); }
    if (a === 'tog-les') { I.tree.modules[m].lessons[l].on = t.checked; refreshPreview(); }
    if (a === 'title-mod') { I.tree.modules[m].title = t.value; refreshPreview(); }
    if (a === 'title-les') { I.tree.modules[m].lessons[l].title = t.value; refreshPreview(); }
    if (t.matches('[data-mentor]')) { /* read on submit */ }
  });

  document.addEventListener('click', (e) => {
    if (M.hooks.click.some(h => h(e))) return;
    const sc = e.target.closest('[data-scenario]'); if (sc) return setScenario(sc.dataset.scenario);
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act, i = Number(b.dataset.i);
    switch (a) {
      case 'go': location.hash = b.dataset.to; break;
      case 'toast': toast(b.dataset.m); break;
      case 'panel': panel = panel === b.dataset.p ? null : b.dataset.p; render(); break;
      case 'close-panel': panel = null; render(); break;
      case 'up': case 'down': {
        const j = a === 'up' ? i - 1 : i + 1; [S.courses[i], S.courses[j]] = [S.courses[j], S.courses[i]]; render(); break;
      }
      case 'remove': { const [c] = S.courses.splice(i, 1); toast(`«${c.title}» убран из программы`); render(); break; }
      case 'add-existing': {
        const e2 = EXISTING.find(x => x.id === b.dataset.id);
        S.courses.push({ id: e2.id, title: e2.title, start: nextFreeWeek(), len: e2.modules, modules: e2.modules, lessons: e2.lessons });
        toast(`«${e2.title}» добавлен`); render(); break;
      }
      case 'fmt': I.fmt = b.dataset.f; I.error = ''; render(); break;
      case 'sample': I.texts[I.fmt] = I.fmt === 'copy' ? '' : (SAMPLES[I.fmt]); render(); break;
      case 'sample-bad': I.texts.md = SAMPLES.mdBad; render(); break;
      case 'template': {
        const f = I.fmt === 'copy' ? 'md' : I.fmt;
        const blob = new Blob([SAMPLES[f]], { type: 'text/plain' }), a2 = document.createElement('a');
        a2.href = URL.createObjectURL(blob); a2.download = `course-template.${f === 'md' ? 'md' : f}`; a2.click(); URL.revokeObjectURL(a2.href); break;
      }
      case 'to-settings': {
        try {
          const f = I.fmt === 'copy' ? 'md' : I.fmt;
          I.tree = (f === 'md' ? parseMd : f === 'csv' ? parseCsv : parseJson)(currentText());
          if (!I.tree.modules.length) throw new Error('Не нашли ни одного модуля. Проверьте формат: модуль начинается с «# » (Markdown) или значения в колонке module.');
          validate(I.tree); I.error = '';
          if (!I.s.courseTitle) I.s.courseTitle = I.tree.modules[0]?.title || '';
          location.hash = '#/import/2';
        } catch (err) { I.error = `Не удалось разобрать файл: ${err.message}`; render(); }
        break;
      }
      case 'run-import': location.hash = '#/import/4'; break;
      case 'add-imported': {
        const r = stats(I.tree), cad = I.s.cadence;
        S.courses.push({ id: `i${Date.now()}`, title: I.s.courseTitle.trim() || 'Новый курс', start: Math.min(104, I.s.startWeek), len: Math.max(1, cad ? r.modules * cad : 1), modules: r.modules, lessons: r.lessons });
        I = null; toast('Курс добавлен в программу'); location.hash = '#/courses'; break;
      }
    }
  });

  document.addEventListener('submit', (e) => {
    e.preventDefault();
    if (M.hooks.submit.some(h => h(e))) return;
    const f = e.target;
    if (f.id === 'program-form') {
      const p = F.program, err = $('#p-title-err');
      if (p.title.trim().length < 2) { err.textContent = 'Введите название (от 2 символов)'; err.style.color = 'var(--risk)'; $('#p-title').focus(); return; }
      if (!(p.weeks >= 1 && p.weeks <= 104)) { $('#p-weeks').focus(); return; }
      const first = !S.program; S.program = { ...p, title: p.title.trim() };
      if (!S.cohort) F.cohort.name = `${S.program.title} · поток 1`;
      toast(first ? 'Программа создана' : 'Сохранено'); location.hash = first ? '#/courses' : '#/hub'; render();
    }
    if (f.id === 'settings-form') {
      if (I.s.target === 'new' && !I.s.courseTitle.trim()) { $('#s-title').focus(); toast('Введите название курса'); return; }
      location.hash = '#/import/3';
    }
    if (f.dataset.form === 'blank') {
      if (F.blankTitle.trim().length < 2) return $('#b-title').focus();
      S.courses.push({ id: `b${Date.now()}`, title: F.blankTitle.trim(), start: nextFreeWeek(), len: 1, modules: 0, lessons: 0 });
      F.blankTitle = ''; panel = null; toast('Пустой курс создан'); render();
    }
    if (f.id === 'cohort-form') {
      const c = F.cohort, err = $('#c-name-err');
      if (c.name.trim().length < 2) { err.textContent = 'Введите название потока'; err.style.color = 'var(--risk)'; $('#c-name').focus(); return; }
      if (!c.start) { $('#c-start').focus(); return; }
      const first = !S.cohort; S.cohort = { ...c, name: c.name.trim() };
      toast(first ? 'Поток создан' : 'Сохранено'); location.hash = first ? '#/people' : '#/hub'; render();
    }
    if (f.id === 'people-form') {
      const ms = $$('[data-mentor]:checked').map(x => x.value), add = Number($('[data-emails]').dataset.n || 0);
      if (!ms.length) { toast('Назначьте хотя бы одного ментора'); return; }
      S.cohort.mentors = ms; S.cohort.emails += add; location.hash = '#/done'; render();
    }
  });

  window.addEventListener('hashchange', render);
  Object.assign(M, {
    esc, plural, weeks: W, toast, initials, MENTORS, EXISTING, SAMPLES, render,
    parse: { md: parseMd, csv: parseCsv, json: parseJson, validate, stats },
    date: { parse: parseDay, iso: isoDay, add: addDays, short: fmtShort, long: fmtLong, nextMonday }
  });
  M.boot = () => { resetDrafts(); if (M.onScenario) M.onScenario('empty'); render(); };
})();
