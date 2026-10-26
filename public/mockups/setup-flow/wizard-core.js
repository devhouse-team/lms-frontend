/* Wizard framework: state, generic bindings, rail, hub. Loaded after app.js. */
(() => {
  'use strict';
  const M = window.M;
  const { esc, plural } = M;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  let uid = 100;
  M.nid = p => `${p}${++uid}`;
  M.$ = $; M.$$ = $$;

  // ---------- catalogs ----------
  M.KINDS = { markdown: 'Текст', pdf: 'PDF', video: 'Видео', file: 'Файл', link: 'Ссылка', image: 'Картинка' };
  M.TAGS = { lecture: 'Лекция', slides: 'Слайды', reading: 'Чтение', code: 'Код', practice: 'Практика', solution: 'Решение' };
  M.MODES = { homework: 'Домашка', exam: 'Экзамен', practice: 'Практика' };
  M.RELEASE = { after_due: 'После дедлайна', after_submit: 'После первой попытки', manual: 'Вручную' };

  const TRANSLIT = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya' };
  M.slugify = s => s.toLowerCase().split('').map(c => TRANSLIT[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);

  // ---------- fake library ----------
  function seedCourse(id, title, nm, nl, published = true) {
    const modules = Array.from({ length: nm }, (_, m) => ({
      id: `${id}m${m}`, title: `Модуль ${m + 1}`, week: m + 1,
      lessons: Array.from({ length: nl }, (_, l) => ({
        id: `${id}m${m}l${l}`, title: `Урок ${m + 1}.${l + 1}`,
        materials: [
          { id: `${id}m${m}l${l}a`, kind: 'video', title: 'Видео-лекция', url: 'https://video.devhouse.kz/demo', tags: ['lecture'], pub: true },
          { id: `${id}m${m}l${l}b`, kind: 'pdf', title: 'Конспект', file: 'notes.pdf', tags: ['slides'], pub: true }
        ],
        tasks: [{ id: `${id}m${m}l${l}t`, mode: 'homework', title: `Домашка ${m + 1}.${l + 1}`, statement: '', due: 7, max: 100, formats: ['files'], limit: 3, solOn: true, solRelease: 'after_due' }]
      }))
    }));
    const last = modules.at(-1).lessons.at(-1);
    last.tasks.push({ id: `${id}exam`, mode: 'exam', title: 'Итоговый экзамен', statement: '', windowDay: 5, windowTime: '14:00', duration: 120, trial: true, max: 100, formats: ['files'], limit: 1, solOn: true, solRelease: 'after_due' });
    return { id, title, slug: M.slugify(title), desc: '', editors: [], modules, pages: {}, published };
  }
  M.courseStats = c => {
    const r = { modules: c.modules.length, lessons: 0, materials: 0, tasks: 0, exams: 0 };
    c.modules.forEach(m => m.lessons.forEach(l => { r.lessons++; r.materials += l.materials.length; r.tasks += l.tasks.length; r.exams += l.tasks.filter(t => t.mode === 'exam').length; }));
    r.len = Math.max(1, r.modules);
    return r;
  };
  const SEEDS = {
    empty: () => ({ courses: [], programs: [], cohorts: [] }),
    program: () => ({ courses: [], programs: [{ id: 'p1', title: 'Backend на Python', weeks: 26, desc: '', lead: M.MENTORS[0], status: 'draft', courses: [] }], cohorts: [] }),
    courses: () => {
      const courses = [seedCourse('c1', 'Основы Python', 6, 3), seedCourse('c2', 'Базы данных и SQL', 5, 3), seedCourse('c3', 'Web API на FastAPI', 8, 3, false)];
      return { courses, programs: [{ id: 'p1', title: 'Backend на Python', weeks: 26, desc: '', lead: M.MENTORS[0], status: 'active', courses: [{ id: 'c1', start: 1, len: 6 }, { id: 'c2', start: 7, len: 5 }, { id: 'c3', start: 12, len: 8 }] }], cohorts: [] };
    },
    ready: () => {
      const d = SEEDS.courses();
      d.cohorts = [{ id: 'k1', name: 'Backend на Python · поток 1', progId: 'p1', start: M.date.iso(M.date.nextMonday()), students: 12 }];
      return d;
    }
  };

  M.W = { lib: SEEDS.empty(), course: null, prog: null, cohort: null, returnTo: null, reach: {} };
  M.onScenario = (name) => { Object.assign(M.W, { lib: SEEDS[name](), course: null, prog: null, cohort: null, returnTo: null, reach: {} }); };
  M.courseById = id => M.W.lib.courses.find(c => c.id === id);
  M.progById = id => M.W.lib.programs.find(p => p.id === id);

  // ---------- helpers ----------
  const getPath = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setPath = (o, path, v) => { const ks = path.split('.'); ks.slice(0, -1).reduce((a, k) => (a[k] ??= {}), o)[ks.at(-1)] = v; };
  M.getPath = (p) => getPath(M.W, p);
  M.go = h => { location.hash = h; };

  M.head = (eyebrow, title, lead) => `<div class="page-head"><span class="eyebrow">${eyebrow}</span><h1>${title}</h1>${lead ? `<p>${lead}</p>` : ''}</div>`;
  M.footer = (name, n, nextLabel, opts = {}) => `<div class="footer-bar">
    ${n > 1 ? `<a class="btn ghost" href="#/${name}/${n - 1}">← Назад</a>` : `<a class="btn ghost" href="#/hub">Отмена</a>`}<span class="spacer"></span>
    ${opts.hint ? `<span class="small muted">${opts.hint}</span>` : ''}
    <button class="btn primary" data-w="next" ${opts.disabled ? 'disabled' : ''}>${nextLabel} →</button></div>`;
  M.empty = (title, text, actions) => `<section class="outline empty"><h2>${title}</h2><p>${text}</p><div class="actions">${actions}</div></section>`;
  M.alert = (kind, text) => `<div class="alert ${kind}" role="${kind === 'err' ? 'alert' : 'status'}">${kind === 'err' ? '✕' : kind === 'warn' ? '⚠' : kind === 'ok' ? '✓' : 'ℹ'} <div>${text}</div></div>`;

  M.timeline = (weeks, rows) => {
    const cols = `style="grid-template-columns:repeat(${weeks},1fr)"`;
    const pct = n => `${(n / weeks) * 100}%`;
    const head = Array.from({ length: weeks }, (_, i) => `<div class="tl-cell">${(i + 1) % 4 === 1 || weeks <= 12 ? i + 1 : ''}</div>`).join('');
    return `<div class="tl"><div class="tl-in" style="min-width:${Math.max(640, 180 + weeks * 22)}px">
      <div class="tl-row tl-head"><div class="tl-name dim small">Неделя</div><div class="tl-track" ${cols}>${head}</div></div>
      ${rows.map(r => {
        const over = r.start + r.len - 1 > weeks;
        return `<div class="tl-row"><div class="tl-name" title="${esc(r.title)}">${esc(r.title)}</div><div class="tl-track" ${cols}>${Array.from({ length: weeks }, () => '<div class="tl-cell"></div>').join('')}
          <div class="tl-bar ${over ? 'over' : ''} ${r.empty ? 'empty' : ''}" style="left:${pct(Math.max(0, r.start - 1))};width:${pct(Math.max(0.5, Math.min(r.len, weeks - r.start + 1)))}">${r.start}–${r.start + r.len - 1}</div></div></div>`;
      }).join('')}</div></div>`;
  };

  // ---------- rail ----------
  M.rail = (name, n) => {
    const w = M.wizards[name], reach = M.W.reach[name] || 1, doneAll = n > w.steps.length;
    return `<p class="steps-title">${w.title}</p>
      <a class="step-link steps-hub" href="#/hub"><span class="step-dot" aria-hidden="true">←</span><span class="step-text"><span class="step-name">Что создать</span></span></a>
      ${w.steps.map((s, i) => {
        const done = doneAll || i + 1 < n, can = doneAll ? false : i + 1 <= reach;
        return `${i ? '<div class="step-line" aria-hidden="true"></div>' : ''}
        <a class="step-link ${done ? 'done' : ''}" href="${can ? `#/${name}/${i + 1}` : '#/' + name + '/' + n}" ${can ? '' : 'aria-disabled="true"'} ${i + 1 === n ? 'aria-current="step"' : ''}>
          <span class="step-dot" aria-hidden="true">${done ? '✓' : i + 1}</span>
          <span class="step-text"><span class="step-name">${s}</span></span></a>`;
      }).join('')}`;
  };

  M.hubRail = () => {
    const L = M.W.lib;
    const item = (name, label, sub) => `<a class="step-link" href="#" data-w="start" data-name="${name}"><span class="step-dot" aria-hidden="true">+</span><span class="step-text"><span class="step-name">${label}</span><span class="step-sub">${sub}</span></span></a>`;
    return `<p class="steps-title">Создание</p>
      <a class="step-link" href="#/hub" aria-current="step"><span class="step-dot" aria-hidden="true">←</span><span class="step-text"><span class="step-name">Что создать</span></span></a><div class="step-line" aria-hidden="true"></div>
      ${item('course', 'Курс', plural(L.courses.length, 'курс', 'курса', 'курсов'))}<div class="step-line" aria-hidden="true"></div>
      ${item('programme', 'Программа', plural(L.programs.length, 'программа', 'программы', 'программ'))}<div class="step-line" aria-hidden="true"></div>
      ${item('cohort-new', 'Поток', plural(L.cohorts.length, 'поток', 'потока', 'потоков'))}`;
  };

  // ---------- hub ----------
  M.hubView = () => {
    const L = M.W.lib, active = L.programs.filter(p => p.status === 'active');
    let rec;
    if (!L.programs.length) rec = ['Создайте программу', 'Программа — маршрут обучения. Без неё не запустить поток, поэтому начните с неё: курсы добавите на втором шаге.', 'Создать программу', 'programme'];
    else if (!L.courses.length) rec = ['Добавьте первый курс', 'Программа есть, но курсов пока нет. Соберите курс по шагам: структура, материалы, задания. План можно импортировать из Markdown или таблицы.', 'Создать курс', 'course'];
    else if (!active.length) rec = ['Активируйте программу', 'Потоки запускаются только из активных программ. Откройте мастер программы и завершите последний шаг.', 'Настроить программу', 'programme'];
    else if (!L.cohorts.length) rec = ['Запустите первый поток', 'Программа и курсы готовы. Выберите дату старта, и недели учебного плана превратятся в реальные даты.', 'Создать поток', 'cohort-new'];
    const card = (name, t, d, count, cta) => `<div class="way" style="cursor:default"><span class="w-title">${t}</span><span class="w-desc">${d}</span>
      <span class="small muted" style="margin:4px 0 8px">${count}</span>
      <div class="actions"><button class="btn ${rec && rec[3] === name ? 'primary' : ''}" data-w="start" data-name="${name}">${cta} →</button></div></div>`;
    return `<div class="page wide">
      ${M.head('Создание', 'Что создать?', 'Выберите, что нужно сейчас. Каждый мастер ведёт по шагам и сам подскажет, чего не хватает.')}
      ${rec ? `<section class="panel next"><span class="badge yellow">Рекомендуем</span><h2>${rec[0]}</h2><p>${rec[1]}</p>
        <div class="actions"><button class="btn primary" data-w="start" data-name="${rec[3]}">${rec[2]} →</button></div></section>`
      : `<div class="alert ok">✓ <div>Всё настроено: ${plural(L.programs.length, 'программа', 'программы', 'программ')}, ${plural(L.courses.length, 'курс', 'курса', 'курсов')}, ${plural(L.cohorts.length, 'поток', 'потока', 'потоков')}. Можно создать что-то ещё.</div></div>`}
      <div class="ways" style="grid-template-columns:repeat(2,minmax(0,1fr))">
        ${card('course', 'Курс', 'Модули и уроки, материалы, задания. Импорт плана из файла.', plural(L.courses.length, 'курс', 'курса', 'курсов'), 'Создать курс')}
        ${card('programme', 'Программа', 'Набор курсов с расписанием по неделям.', plural(L.programs.length, 'программа', 'программы', 'программ'), 'Создать программу')}
        ${card('cohort-new', 'Поток', 'Группа студентов с менторами на программе.', plural(L.cohorts.length, 'поток', 'потока', 'потоков'), 'Создать поток')}
        <a class="way" href="#/all" style="text-decoration:none"><span class="w-title">Всё сразу</span><span class="w-desc">Одна цепочка: программа → курсы → поток → люди.</span><span class="small muted" style="margin:4px 0 8px">Чек-лист с подсказками</span><div class="actions"><span class="btn">Открыть цепочку →</span></div></a>
      </div>
    </div>`;
  };

  // ---------- generic acts ----------
  M.acts.start = (b) => {
    const name = b.dataset.name;
    M.W.reach[name] = 1;
    if (name === 'course') M.W.course = M.newCourse();
    if (name === 'programme') M.W.prog = M.newProg();
    if (name === 'cohort-new') M.W.cohort = M.newCohort();
    M.W.returnTo = null;
    M.go(`#/${name}/1`);
  };
  M.acts.next = () => {
    const { name, n } = M.cur, wz = M.wizards[name];
    const err = wz.validate && wz.validate(n);
    if (err) return M.toast(err);
    if (n === wz.steps.length && wz.finish) return wz.finish();
    M.go(`#/${name}/${n + 1}`);
  };
  M.acts.goto = (b) => M.go(`#/${M.cur.name}/${b.dataset.n}`);
  M.acts.href = (b) => M.go(b.dataset.to);

  // ---------- generic bindings ----------
  const parseVal = t => (t.type === 'checkbox' ? t.checked : (t.type === 'number' || 'num' in t.dataset) ? Number(t.value) : t.value);

  M.hooks.click.push((e) => {
    const b = e.target.closest('[data-w]');
    if (!b) return false;
    const f = M.acts[b.dataset.w];
    e.preventDefault();
    if (f) f(b, e);
    return true;
  });
  M.hooks.input.push((e) => {
    const t = e.target;
    if (!t.dataset.wm || t.type === 'radio' || t.tagName === 'SELECT' || t.type === 'checkbox') return false;
    setPath(M.W, t.dataset.wm, parseVal(t));
    const wz = M.cur && M.wizards[M.cur.name];
    if (wz && wz.live) wz.live(t.dataset.wm, t);
    return true;
  });
  M.hooks.change.push((e) => {
    const t = e.target;
    if (t.dataset.wfile) { const wz = M.wizards[M.cur.name]; wz.file && wz.file(t.dataset.wfile, t); t.value = ''; return true; }
    if (t.dataset.wtoggle) {
      const arr = getPath(M.W, t.dataset.wtoggle) || [];
      const next = t.checked ? [...arr, t.value] : arr.filter(x => x !== t.value);
      setPath(M.W, t.dataset.wtoggle, next);
      const wz = M.wizards[M.cur.name]; if (wz.live) wz.live(t.dataset.wtoggle, t);
      if ('rr' in t.dataset) M.render();
      return true;
    }
    if (t.dataset.wm) {
      setPath(M.W, t.dataset.wm, parseVal(t));
      const wz = M.wizards[M.cur.name]; if (wz.live) wz.live(t.dataset.wm, t);
      if ('rr' in t.dataset) M.render();
      return true;
    }
    return false;
  });
  M.hooks.submit.push((e) => {
    if (!e.target.closest('[data-wform]')) return false;
    M.acts.next();
    return true;
  });
})();
