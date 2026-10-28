/* Programme wizard: Основное → Курсы → Расписание → Активация */
(() => {
  'use strict';
  const M = window.M;
  const { esc, plural, $ } = M;
  const P = () => (M.W.prog ||= M.newProg());

  M.newProg = () => ({ title: '', weeks: 26, desc: '', lead: M.MENTORS[0], courseIds: [], sched: {}, search: '', status: 'active' });

  const lenOf = id => { const c = M.courseById(id); return c ? M.courseStats(c).len : 1; };
  const months = w => Math.round(w / 4.345);
  const rowsOf = p => p.courseIds.map(id => ({ id, c: M.courseById(id), ...(p.sched[id] || { start: 1, parallel: false }) })).filter(r => r.c);
  function ensureSched(p) {
    let next = 1;
    p.courseIds.forEach((id) => {
      if (!p.sched[id]) p.sched[id] = { start: next, parallel: false };
      next = Math.max(next, p.sched[id].start + lenOf(id));
    });
    Object.keys(p.sched).forEach(id => { if (!p.courseIds.includes(id)) delete p.sched[id]; });
  }
  function pack(p) {
    let next = 1, prevStart = 1;
    p.courseIds.forEach((id) => {
      const s = p.sched[id] || (p.sched[id] = { start: 1, parallel: false });
      s.start = s.parallel ? prevStart : next;
      prevStart = s.start; next = Math.max(next, s.start + lenOf(id));
    });
  }
  const endWeek = p => rowsOf(p).reduce((m, r) => Math.max(m, r.start + lenOf(r.id) - 1), 0);

  // ---------- step 1 ----------
  function previewCard() {
    const p = P();
    return `<div class="pcard-cover" aria-hidden="true">${esc((p.title.trim() || 'DH').split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase())}</div>
      <div class="pcard-body"><div class="title">${esc(p.title.trim() || 'Название программы')}</div>
      <div class="small muted">${M.weeks(p.weeks || 0)}${months(p.weeks) >= 1 ? ` · ${plural(months(p.weeks), 'месяц', 'месяца', 'месяцев')}` : ''} · ${p.courseIds.length ? plural(p.courseIds.length, 'курс', 'курса', 'курсов') : 'курсов пока нет'}</div>
      <div class="row-i"><span class="avatar">${esc(M.initials(p.lead))}</span><span>${esc(p.lead)}</span></div></div>`;
  }
  function step1() {
    const p = P();
    return `<div class="page wide">
      ${M.head('Шаг 1 из 4', 'Основное о программе', 'Название, длительность и ответственный. Курсы подберёте на следующем шаге.')}
      <div class="split"><form class="form" data-wform novalidate>
        <div class="field"><label for="g-title">Название</label><input id="g-title" type="text" data-wm="prog.title" value="${esc(p.title)}" placeholder="Например, Backend на Python" autocomplete="off"></div>
        <div class="grid2"><div class="field"><label for="g-weeks">Длительность, недель</label><input id="g-weeks" type="number" min="1" max="104" data-wm="prog.weeks" value="${p.weeks}"><span class="help" id="g-weeks-help"></span></div>
          <div class="field"><label for="g-lead">Ответственный</label><select id="g-lead" data-wm="prog.lead">${M.MENTORS.map(m => `<option ${m === p.lead ? 'selected' : ''}>${m}</option>`).join('')}</select></div></div>
        <div class="field"><label for="g-desc">Описание</label><textarea id="g-desc" style="min-height:110px;font-family:var(--sans);font-size:14px" data-wm="prog.desc" placeholder="Чему научится студент">${esc(p.desc)}</textarea></div>
        ${M.footer('programme', 1, 'Курсы')}
      </form><aside><p class="label" style="margin-bottom:8px">Так программа выглядит в списке</p><div class="pcard" id="prog-preview">${previewCard()}</div></aside></div></div>`;
  }

  // ---------- step 2 ----------
  function pickList() {
    const p = P(), q = p.search.trim().toLowerCase();
    const list = M.W.lib.courses.filter(c => !q || c.title.toLowerCase().includes(q));
    if (!list.length) return `<p class="muted" style="padding:16px">Ничего не найдено по «${esc(p.search)}».</p>`;
    return `<ul class="courses outline">${list.map((c) => {
      const s = M.courseStats(c), on = p.courseIds.includes(c.id);
      return `<li><input type="checkbox" value="${c.id}" data-wtoggle="prog.courseIds" data-rr id="pc-${c.id}" ${on ? 'checked' : ''}>
        <label class="grow" for="pc-${c.id}" style="cursor:pointer"><div class="hi">${esc(c.title)} ${c.published ? '' : '<span class="badge warn">Черновик</span>'}</div>
        <div class="small ${s.modules ? 'muted' : ''}" style="${s.modules ? '' : 'color:var(--warn)'}">${s.modules ? `${plural(s.modules, 'модуль', 'модуля', 'модулей')} · ${plural(s.lessons, 'урок', 'урока', 'уроков')} · ${plural(s.tasks, 'задание', 'задания', 'заданий')}` : 'Нет модулей'}</div></label>
        ${on ? `<span class="badge yellow num">№ ${p.courseIds.indexOf(c.id) + 1}</span>` : ''}</li>`;
    }).join('')}</ul>`;
  }
  function step2() {
    const p = P(), L = M.W.lib;
    if (!L.courses.length) return `<div class="page wide">${M.head('Шаг 2 из 4', 'Курсы программы', 'Программа собирается из курсов.')}
      ${M.empty('В библиотеке пока нет курсов', 'Создайте первый курс по шагам: структура, материалы и задания. Или импортируйте готовый план из файла, это быстрее.', '<button class="btn primary" data-w="start-course" data-tab="manual">Создать курс →</button><button class="btn" data-w="start-course" data-tab="import">Импортировать план</button>')}
      <div class="footer-bar"><a class="btn ghost" href="#/programme/1">← Назад</a><span class="spacer"></span><button class="btn primary" data-w="next">Пропустить, добавлю позже →</button></div></div>`;
    return `<div class="page wide">
      ${M.head('Шаг 2 из 4', 'Курсы программы', 'Отметьте курсы. Порядок отметки станет порядком в программе, его можно поменять на следующем шаге.')}
      <div class="actions"><input type="text" data-wm="prog.search" value="${esc(p.search)}" placeholder="Поиск по названию" style="max-width:280px" aria-label="Поиск курса"><span class="spacer"></span>
        <button class="btn" data-w="start-course" data-tab="import">Импортировать новый</button><button class="btn" data-w="start-course" data-tab="manual">+ Создать новый курс</button></div>
      <div id="pick-list">${pickList()}</div>
      ${M.footer('programme', 2, 'Расписание', { hint: p.courseIds.length ? `Выбрано: ${p.courseIds.length}` : 'Можно пропустить и добавить позже' })}</div>`;
  }

  // ---------- step 3 ----------
  function tl(p) {
    const rows = rowsOf(p).map(r => ({ title: r.c.title, start: r.start, len: lenOf(r.id), empty: !M.courseStats(r.c).modules }));
    return rows.length ? M.timeline(p.weeks, rows) : '';
  }
  function lengthNote(p) {
    const end = endWeek(p);
    if (end > p.weeks) return M.alert('warn', `Контент длиннее программы: курсы занимают ${M.weeks(end)}, а в программе ${M.weeks(p.weeks)}. Подвиньте старт или увеличьте длительность.`);
    if (end && p.weeks - end >= 2) return `<p class="small muted">Курсы занимают ${end} из ${M.weeks(p.weeks)}: ещё ${M.weeks(p.weeks - end)} свободно.</p>`;
    return '';
  }
  function step3() {
    const p = P(); ensureSched(p);
    if (!p.courseIds.length) return `<div class="page wide">${M.head('Шаг 3 из 4', 'Расписание', '')}${M.empty('Нет курсов для расписания', 'Вернитесь и выберите курсы или создайте новый.', '<a class="btn primary" href="#/programme/2">← Выбрать курсы</a>')}
      <div class="footer-bar"><span class="spacer"></span><button class="btn primary" data-w="next">Пропустить →</button></div></div>`;
    return `<div class="page wide">
      ${M.head('Шаг 3 из 4', 'Расписание курсов', 'С какой недели программы стартует каждый курс. Потоки получат эту раскладку при создании.')}
      <div class="actions"><button class="btn" data-w="pack">Расставить подряд</button><span class="small muted">Курсы «параллельно» стартуют вместе с предыдущим</span></div>
      <div id="tl">${tl(p)}</div><div id="len-note">${lengthNote(p)}</div>
      <ol class="courses outline">${rowsOf(p).map((r, i) => `<li><span class="idx num">${i + 1}</span>
        <div class="grow"><div class="hi">${esc(r.c.title)}</div><div class="small muted">${M.weeks(lenOf(r.id))}</div></div>
        <label class="row-i small muted"><input type="checkbox" data-wm="prog.sched.${r.id}.parallel" data-rr ${r.parallel ? 'checked' : ''} ${i ? '' : 'disabled'}> параллельно</label>
        <label class="week-in">Старт, неделя <input type="number" min="1" max="104" value="${r.start}" data-wm="prog.sched.${r.id}.start" data-num aria-label="Неделя старта: ${esc(r.c.title)}"></label>
        <span class="actions"><button class="btn ghost sm icon" data-w="p-up" data-i="${i}" ${i ? '' : 'disabled'} aria-label="Выше">↑</button><button class="btn ghost sm icon" data-w="p-down" data-i="${i}" ${i < p.courseIds.length - 1 ? '' : 'disabled'} aria-label="Ниже">↓</button><button class="btn ghost sm icon danger" data-w="p-del" data-i="${i}" aria-label="Убрать">✕</button></span></li>`).join('')}</ol>
      ${M.footer('programme', 3, 'Проверка')}</div>`;
  }

  // ---------- step 4 ----------
  function step4() {
    const p = P(), rows = rowsOf(p), w = [];
    if (!rows.length) w.push(['warn', 'В программе нет курсов. Потоки создадутся пустыми.', 2]);
    rows.filter(r => !r.c.published).forEach(r => w.push(['warn', `Курс «${r.c.title}» в черновике: студентам он не откроется`, 2]));
    rows.filter(r => !M.courseStats(r.c).modules).forEach(r => w.push(['warn', `В курсе «${r.c.title}» нет модулей`, 2]));
    if (endWeek(p) > p.weeks) w.push(['warn', `Контент занимает ${M.weeks(endWeek(p))}, программа ${M.weeks(p.weeks)}`, 3]);
    return `<div class="page wide">
      ${M.head('Шаг 4 из 4', 'Проверка и активация', 'Последний взгляд перед созданием. Активная программа сразу доступна для запуска потоков.')}
      <div class="summary" style="position:static"><div class="stat"><b>${esc(p.title)}</b></div><div class="stat"><b>${p.weeks}</b> нед.</div><div class="stat"><b>${rows.length}</b> курсов</div><div class="stat">${esc(p.lead)}</div></div>
      <section><h3 style="margin-bottom:8px">Замечания</h3>${w.length ? `<ul class="checklist outline">${w.map(([k, t, st]) => `<li><span class="badge warn">Внимание</span><div class="grow">${esc(t)}</div><button class="btn sm" data-w="goto" data-n="${st}">Исправить</button></li>`).join('')}</ul>` : M.alert('ok', 'Замечаний нет.')}</section>
      ${rows.length ? `<section>${tl(p)}</section>` : ''}
      <section class="panel form"><h3>Статус</h3><div class="opts">
        <label class="opt"><input type="radio" name="gs" value="active" data-wm="prog.status" ${p.status === 'active' ? 'checked' : ''}><div><b>Активна</b><span>Можно сразу запускать потоки</span></div></label>
        <label class="opt"><input type="radio" name="gs" value="draft" data-wm="prog.status" ${p.status === 'draft' ? 'checked' : ''}><div><b>Черновик</b><span>Потоки запускать нельзя, пока не активируете</span></div></label></div></section>
      ${M.footer('programme', 4, 'Создать программу')}</div>`;
  }
  function done() {
    const pr = M.progById(M.W.lastProg);
    return `<div class="page">${M.head('Готово', pr ? esc(pr.title) : 'Программа создана', pr ? `${pr.status === 'active' ? 'Активна' : 'Черновик'} · ${M.weeks(pr.weeks)} · ${plural(pr.courses.length, 'курс', 'курса', 'курсов')}` : '')}
      <div class="alert ${pr && pr.status === 'active' ? 'ok' : 'warn'}">${pr && pr.status === 'active' ? '✓ <div>Программа готова. Следующий шаг — запустить поток.</div>' : '⚠ <div>Это черновик: потоки запустить нельзя, пока программа не активирована.</div>'}</div>
      <div class="actions">${pr && pr.status === 'active' ? '<button class="btn primary" data-w="start" data-name="cohort-new" data-prog="1">Запустить поток →</button>' : ''}<button class="btn" data-w="start" data-name="programme">Создать ещё программу</button><a class="btn ghost" href="#/hub">К списку</a></div></div>`;
  }

  // ---------- acts ----------
  const A = M.acts, idx = b => Number(b.dataset.i);
  A['start-course'] = (b) => {
    M.W.course = M.newCourse(); M.W.course.tab = b.dataset.tab;
    M.W.returnTo = 'programme/2'; M.W.reach.course = 1;
    M.go(b.dataset.tab === 'import' ? '#/course/2' : '#/course/1');
    if (b.dataset.tab === 'import') M.W.reach.course = 2;
  };
  A.pack = () => { pack(P()); M.render(); };
  A['p-up'] = b => { const a = P().courseIds, i = idx(b); if (i) { [a[i], a[i - 1]] = [a[i - 1], a[i]]; pack(P()); M.render(); } };
  A['p-down'] = b => { const a = P().courseIds, i = idx(b); if (i < a.length - 1) { [a[i], a[i + 1]] = [a[i + 1], a[i]]; pack(P()); M.render(); } };
  A['p-del'] = b => { P().courseIds.splice(idx(b), 1); M.render(); };
  const startOrig = A.start;
  A.start = (b) => {
    if (b.dataset.name === 'cohort-new' && b.dataset.prog) { const id = M.W.lastProg; startOrig(b); M.W.cohort.progId = id; return; }
    startOrig(b);
  };

  M.wizards.programme = {
    title: 'Создание программы', steps: ['Основное', 'Курсы', 'Расписание', 'Активация'],
    view(n) { return [step1, step2, step3, step4, done][n - 1](); },
    after(n) { if (n === 1) { const h = $('#g-weeks-help'); if (h) { const p = P(); h.textContent = months(p.weeks) >= 1 ? `≈ ${plural(months(p.weeks), 'месяц', 'месяца', 'месяцев')}` : ''; } } },
    validate(n) {
      const p = P();
      if (n === 1) { if (p.title.trim().length < 2) return 'Введите название программы'; if (!(p.weeks >= 1 && p.weeks <= 104)) return 'Длительность: от 1 до 104 недель'; }
      if (n === 2) ensureSched(p);
      return '';
    },
    live(path) {
      const p = P();
      if (path === 'prog.title' || path === 'prog.weeks') { const el = $('#prog-preview'); if (el) el.innerHTML = previewCard(); wizAfter(); }
      if (path === 'prog.search') { const el = $('#pick-list'); if (el) el.innerHTML = pickList(); }
      if (path.endsWith('.parallel')) pack(p);
      if (path.startsWith('prog.sched.')) { const t = $('#tl'); if (t) t.innerHTML = tl(p); const n = $('#len-note'); if (n) n.innerHTML = lengthNote(p); }
    },
    finish() {
      const p = P(); ensureSched(p);
      const id = M.nid('p');
      M.W.lib.programs.push({ id, title: p.title.trim(), weeks: p.weeks, desc: p.desc, lead: p.lead, status: p.status, courses: rowsOf(p).map(r => ({ id: r.id, start: r.start, len: lenOf(r.id) })) });
      M.W.lastProg = id; M.W.prog = null;
      M.go('#/programme/5');
    }
  };
  const wizAfter = () => M.wizards.programme.after(1);
})();
