/* Cohort wizard: Программа → Даты → План → Команда → Студенты */
(() => {
  'use strict';
  const M = window.M;
  const { esc, plural, $ } = M;
  const K = () => (M.W.cohort ||= M.newCohort());
  const D = M.date;

  M.newCohort = () => ({ progId: null, name: '', nameTouched: false, start: D.iso(D.nextMonday()), tz: 'Asia/Almaty', mentors: [], auto: true, emails: '', examTimes: {} });

  const prog = () => M.progById(K().progId);
  const endOf = k => { const p = M.progById(k.progId); return p && k.start ? D.add(D.parse(k.start), p.weeks * 7 - 1) : null; };
  const defaultName = (k) => {
    const p = M.progById(k.progId); if (!p) return '';
    const n = M.W.lib.cohorts.filter(c => c.progId === p.id).length + 1;
    return `${p.title} · поток ${n}`;
  };
  const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  // ---------- step 1 ----------
  function step1() {
    const k = K(), L = M.W.lib;
    const usable = L.programs.filter(p => p.status !== 'archived');
    if (!usable.length) return `<div class="page wide">${M.head('Шаг 1 из 5', 'Выберите программу', 'Поток запускается из программы.')}
      ${M.empty('Пока нет ни одной программы', 'Поток учится по программе: она задаёт длительность и набор курсов. Создайте программу, и вернёмся сюда.', '<button class="btn primary" data-w="start-prog">Создать программу →</button>')}</div>`;
    const anyActive = usable.some(p => p.status === 'active');
    return `<div class="page wide">
      ${M.head('Шаг 1 из 5', 'Выберите программу', 'Программа определяет длительность потока и курсы, которые он пройдёт.')}
      ${anyActive ? '' : M.alert('warn', 'Нет активных программ. Потоки запускаются только из активных: активируйте черновик в мастере программы.')}
      <div class="opts">${usable.map((p) => {
        const dis = p.status !== 'active', n = L.cohorts.filter(c => c.progId === p.id).length;
        return `<label class="opt" style="${dis ? 'opacity:.55;cursor:not-allowed' : ''}"><input type="radio" name="kp" value="${p.id}" data-wm="cohort.progId" data-rr ${dis ? 'disabled' : ''} ${k.progId === p.id ? 'checked' : ''}>
          <div style="flex:1"><b>${esc(p.title)} ${dis ? '<span class="badge">Черновик</span>' : ''}</b>
          <span>${M.weeks(p.weeks)} · ${plural(p.courses.length, 'курс', 'курса', 'курсов')} · ${n ? plural(n, 'поток', 'потока', 'потоков') + ' уже было' : 'потоков ещё не было'}</span></div></label>`;
      }).join('')}</div>
      ${!anyActive ? '<div class="actions"><button class="btn primary" data-w="start-prog">Создать или активировать программу →</button></div>' : ''}
      ${M.footer('cohort-new', 1, 'Даты', { disabled: false })}</div>`;
  }

  // ---------- step 2 ----------
  function step2() {
    const k = K(), p = prog();
    if (!p) return `<div class="page wide">${M.empty('Сначала выберите программу', '', '<a class="btn primary" href="#/cohort-new/1">← К выбору</a>')}</div>`;
    if (!k.nameTouched) k.name = defaultName(k);
    const end = endOf(k);
    return `<div class="page wide">
      ${M.head('Шаг 2 из 5', 'Название и даты', `Программа «${esc(p.title)}» · ${M.weeks(p.weeks)}. Конец потока считается сам.`)}
      <form class="form" data-wform novalidate style="max-width:560px">
        <div class="field"><label for="k-name">Название потока</label><input id="k-name" type="text" data-wm="cohort.name" value="${esc(k.name)}" autocomplete="off"></div>
        <div class="grid2"><div class="field"><label for="k-start">Старт</label><input id="k-start" type="date" data-wm="cohort.start" value="${k.start}" style="color-scheme:dark"><span class="help" id="k-dow"></span></div>
          <div class="field"><label for="k-end">Окончание</label><input id="k-end" type="date" value="${end ? D.iso(end) : ''}" disabled style="color-scheme:dark"><span class="help">Старт + ${M.weeks(p.weeks)}</span></div></div>
        <div class="field"><label for="k-tz">Часовой пояс</label><select id="k-tz" data-wm="cohort.tz">${['Asia/Almaty', 'Asia/Tashkent', 'Europe/Moscow', 'UTC'].map(z => `<option ${k.tz === z ? 'selected' : ''}>${z}</option>`).join('')}</select><span class="help">По нему считаются дедлайны и окна экзаменов</span></div>
        ${M.footer('cohort-new', 2, 'План потока')}
      </form></div>`;
  }

  // ---------- step 3 ----------
  function planCourse(pc, k) {
    const c = M.courseById(pc.id); if (!c) return '';
    const base = D.add(D.parse(k.start), (pc.start - 1) * 7), s = M.courseStats(c);
    return `<details class="outline" ${pc.start === 1 ? 'open' : ''} style="padding:0"><summary style="padding:12px 16px;cursor:pointer;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <b class="hi">${esc(c.title)}</b><span class="small muted">${M.weeks(pc.len)} · с ${D.short(base)}</span>${c.published ? '' : '<span class="badge warn">Черновик</span>'}<span class="small dim" style="margin-left:auto">${plural(s.modules, 'модуль', 'модуля', 'модулей')} · ${plural(s.tasks, 'задание', 'задания', 'заданий')}</span></summary>
      <ul class="plan">${c.modules.map((m) => {
        const open = D.add(base, (m.week - 1) * 7);
        const tasks = m.lessons.flatMap(l => l.tasks.map(t => ({ t, l })));
        return `<li><div><div class="hi">${esc(m.title)} <span class="small muted">· ${plural(m.lessons.length, 'урок', 'урока', 'уроков')}</span></div>
          ${tasks.length ? `<ul class="titems" style="margin:6px 0 0">${tasks.map(({ t }) => {
            if (t.mode === 'exam') {
              const day = D.add(open, (t.windowDay || 1) - 1), time = k.examTimes[t.id] ?? t.windowTime;
              return `<li><span class="kind task">Экзамен</span>${esc(t.title)} <span class="small muted">${DAYS[(day.getDay() + 6) % 7]}, ${D.short(day)}, начало</span> <input type="time" value="${time}" data-wm="cohort.examTimes.${t.id}" style="width:110px;padding:2px 6px;color-scheme:dark" aria-label="Начало экзамена"> <span class="small muted">${t.duration} мин</span></li>`;
            }
            return `<li><span class="kind ${t.mode === 'homework' ? '' : 'task'}">${M.MODES[t.mode]}</span>${esc(t.title)} <span class="small muted">${t.mode === 'homework' ? 'дедлайн ' + D.short(D.add(open, t.due)) : 'без дедлайна'}</span></li>`;
          }).join('')}</ul>` : ''}</div>
          <div class="when">открывается<br>${D.short(open)}</div></li>`;
      }).join('') || '<li><span class="muted">В курсе пока нет модулей</span></li>'}</ul></details>`;
  }
  function step3() {
    const k = K(), p = prog(), end = endOf(k);
    if (!p) return `<div class="page wide">${M.empty('Сначала выберите программу', '', '<a class="btn primary" href="#/cohort-new/1">← К выбору</a>')}</div>`;
    const courses = p.courses.map(pc => ({ pc, c: M.courseById(pc.id) })).filter(x => x.c);
    const exams = courses.reduce((n, x) => n + M.courseStats(x.c).exams, 0);
    return `<div class="page wide">
      ${M.head('Шаг 3 из 5', 'План потока по датам', 'Так учебный план программы ляжет на календарь. Время экзаменов можно сдвинуть только для этого потока.')}
      ${M.alert('info', 'У потока будет своя копия учебного плана: правки программы и курсов позже его не изменят.')}
      ${courses.length ? '' : M.alert('warn', 'В программе нет курсов, поток создастся пустым. <a href="#/programme/2">Добавить курсы</a>')}
      <div class="summary" style="position:static"><div class="stat">Старт <b>${D.short(D.parse(k.start))}</b></div><div class="stat">Конец <b>${end ? D.long(end) : '—'}</b></div><div class="stat"><b>${courses.length}</b> курсов</div><div class="stat"><b>${exams}</b> экзаменов</div></div>
      <div class="form">${p.courses.map(pc => planCourse(pc, k)).join('')}</div>
      ${M.footer('cohort-new', 3, 'Команда')}</div>`;
  }

  // ---------- step 4 ----------
  function step4() {
    const k = K();
    return `<div class="page">
      ${M.head('Шаг 4 из 5', 'Команда потока', 'Менторы проверяют работы студентов. Нужен хотя бы один.')}
      <div class="mentors">${M.MENTORS.map(m => `<label class="mentor"><input type="checkbox" value="${esc(m)}" data-wtoggle="cohort.mentors" data-rr ${k.mentors.includes(m) ? 'checked' : ''}><span class="avatar">${esc(M.initials(m))}</span><span><b>${esc(m)}</b><span class="small muted">Ментор</span></span></label>`).join('')}</div>
      <label class="opt"><input type="checkbox" data-wm="cohort.auto" ${k.auto ? 'checked' : ''}><div><b>Распределять студентов автоматически</b><span>Поровну между менторами. ${k.mentors.length ? `При 24 студентах это по ${Math.ceil(24 / k.mentors.length)} на ментора.` : 'Выберите менторов, чтобы увидеть нагрузку.'}</span></div></label>
      ${M.footer('cohort-new', 4, 'Студенты', { hint: k.mentors.length ? plural(k.mentors.length, 'ментор', 'ментора', 'менторов') : 'Выберите хотя бы одного ментора' })}</div>`;
  }

  // ---------- step 5 ----------
  function report(k) {
    const tokens = k.emails.split(/[\s,;]+/).filter(Boolean), seen = new Set(), r = { fresh: 0, dup: 0, bad: [] };
    tokens.forEach((t) => {
      if (!/^\S+@\S+\.\S+$/.test(t)) return r.bad.push(t);
      const key = t.toLowerCase(); if (seen.has(key)) return r.dup++;
      seen.add(key); r.fresh++;
    });
    return r;
  }
  function reportHtml(k) {
    const r = report(k);
    if (!k.emails.trim()) return '<p class="help">Пока никого. Можно пропустить и добавить студентов позже со страницы потока.</p>';
    return `<div class="report" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div><div class="big">${r.fresh}</div><div class="small muted">получат приглашение</div></div><div><div class="big">${r.dup}</div><div class="small muted">повторов пропущено</div></div><div><div class="big" style="${r.bad.length ? 'color:var(--risk)' : ''}">${r.bad.length}</div><div class="small muted">некорректных адресов</div></div></div>
      ${r.bad.length ? `<p class="small" style="color:var(--risk)">Не похожи на почту: ${r.bad.slice(0, 5).map(esc).join(', ')}${r.bad.length > 5 ? '…' : ''}</p>` : ''}`;
  }
  function step5() {
    const k = K();
    return `<div class="page wide">
      ${M.head('Шаг 5 из 5', 'Студенты', 'Вставьте почты или загрузите CSV. Каждый получит приглашение, а ссылки сработают в день старта.')}
      <div class="field"><label for="k-em">Почты через запятую или с новой строки</label><textarea id="k-em" data-wm="cohort.emails" spellcheck="false" style="min-height:160px" placeholder="student1@example.com&#10;student2@example.com">${esc(k.emails)}</textarea>
        <div class="actions"><button class="btn sm" data-w="em-sample">Вставить пример</button><label class="btn sm" style="cursor:pointer">Загрузить CSV<input type="file" accept=".csv,.txt" data-wfile="csv" hidden></label></div></div>
      <section class="panel form"><h3>Что получится</h3><div id="em-report">${reportHtml(k)}</div></section>
      ${M.footer('cohort-new', 5, 'Создать поток')}</div>`;
  }
  function done() {
    const c = M.W.lib.cohorts.find(x => x.id === M.W.lastCohort);
    return `<div class="page">${M.head('Готово', c ? esc(c.name) : 'Поток создан', c ? `Старт ${D.long(D.parse(c.start))} · ${plural(c.students, 'студент', 'студента', 'студентов')}` : '')}
      <div class="alert ok">✓ <div>Поток создан. Приглашения уйдут студентам, а недели откроются по расписанию.</div></div>
      <div class="actions"><button class="btn primary" data-w="toast" data-m="В макете страница потока не подключена">Открыть поток</button><button class="btn" data-w="start" data-name="cohort-new">Создать ещё поток</button><a class="btn ghost" href="#/hub">К списку</a></div></div>`;
  }

  // ---------- acts ----------
  M.acts['start-prog'] = () => { M.W.prog = M.newProg(); M.W.reach.programme = 1; M.W.returnTo = null; M.go('#/programme/1'); };
  M.acts.toast = b => M.toast(b.dataset.m);
  M.acts['em-sample'] = () => { K().emails = 'aigerim.s@example.com\nbolat.k@example.com\ndana.m@example.com\nerlan.t@example.com\nfarida.n@example.com, gulnara.a@example.com\nbolat.k@example.com\nnot-an-email'; M.render(); };

  M.wizards['cohort-new'] = {
    title: 'Запуск потока', steps: ['Программа', 'Даты', 'План', 'Команда', 'Студенты'],
    view(n) { return [step1, step2, step3, step4, step5, done][n - 1](); },
    after(n) { if (n === 2) this.live('cohort.start'); },
    validate(n) {
      const k = K();
      if (n === 1) { const p = prog(); if (!p) return 'Выберите программу'; if (p.status !== 'active') return 'Программа не активна'; }
      if (n === 2) { if (k.name.trim().length < 2) return 'Введите название потока'; if (!k.start) return 'Укажите дату старта'; }
      if (n === 4 && !k.mentors.length) return 'Выберите хотя бы одного ментора';
      return '';
    },
    live(path) {
      const k = K();
      if (path === 'cohort.name') k.nameTouched = true;
      if (path === 'cohort.start') {
        const e = endOf(k), el = $('#k-end'); if (el) el.value = e ? D.iso(e) : '';
        const dow = $('#k-dow'); if (dow && k.start) { const d = D.parse(k.start); dow.textContent = d.getDay() === 1 ? 'Понедельник: хороший старт' : `${new Intl.DateTimeFormat('ru-RU', { weekday: 'long' }).format(d)}. Лучше начинать в понедельник`; }
      }
      if (path === 'cohort.emails') { const r = $('#em-report'); if (r) r.innerHTML = reportHtml(k); }
    },
    file(kind, input) {
      const f = input.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => { K().emails = String(rd.result); M.toast(`Загружено: ${f.name}`); M.render(); };
      rd.readAsText(f);
    },
    finish() {
      const k = K(), r = report(k);
      const id = M.nid('k');
      M.W.lib.cohorts.push({ id, name: k.name.trim(), progId: k.progId, start: k.start, students: r.fresh });
      M.W.lastCohort = id; M.W.cohort = null; M.go('#/cohort-new/6');
    }
  };
})();
