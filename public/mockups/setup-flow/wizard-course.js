/* Course wizard: Основное → Структура → Материалы → Задания → Публикация */
(() => {
  'use strict';
  const M = window.M;
  const { esc, plural, $, $$ } = M;
  const W = () => M.W;
  const C = () => (M.W.course ||= M.newCourse());

  const newMat = () => ({ kind: 'video', title: '', url: '', text: '', file: '', tags: [], pub: true });
  const newTask = () => ({ mode: 'homework', title: '', statement: '', due: 7, max: 100, windowDay: 5, windowTime: '14:00', duration: 120, trial: true, formats: ['files'], limit: 3, solOn: false, solRelease: 'after_due' });
  M.newCourse = () => ({
    title: '', slug: '', slugTouched: false, desc: '', editors: [], modules: [], pages: { syllabus: true, about: false, grading: false },
    tab: 'manual', imp: { fmt: 'md', text: '', tree: null, error: '', mode: 'append' },
    sel: { m: 0, l: 0 }, mat: newMat(), task: newTask(), publish: 'draft'
  });

  const stats = c => M.courseStats(c);
  const lessonsOf = c => c.modules.flatMap((m, mi) => m.lessons.map((l, li) => ({ m, l, mi, li })));
  const curLesson = c => c.modules[c.sel.m]?.lessons[c.sel.l];
  const fixSel = (c) => {
    if (curLesson(c)) return;
    const first = lessonsOf(c)[0];
    c.sel = first ? { m: first.mi, l: first.li } : { m: 0, l: 0 };
  };
  const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };

  // ---------- step 1: info ----------
  function previewCard() {
    const c = C(), s = stats(c);
    return `<div class="pcard-cover" aria-hidden="true">${esc((c.title.trim() || 'КУРС').split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase())}</div>
      <div class="pcard-body"><div class="title">${esc(c.title.trim() || 'Название курса')}</div>
      <div class="small muted num">${plural(s.modules, 'модуль', 'модуля', 'модулей')} · ${plural(s.lessons, 'урок', 'урока', 'уроков')} · ${plural(s.materials, 'материал', 'материала', 'материалов')}</div>
      <div class="small muted">${c.editors.length ? 'Редакторы: ' + esc(c.editors.join(', ')) : 'Редакторы не назначены'}</div></div>`;
  }
  function step1() {
    const c = C();
    return `<div class="page wide">
      ${M.head('Шаг 1 из 5', 'Основное о курсе', 'Название, адрес и редакторы. Структуру, материалы и задания добавите дальше.')}
      <div class="split">
        <form class="form" data-wform novalidate>
          <div class="field"><label for="k-title">Название</label><input id="k-title" type="text" data-wm="course.title" value="${esc(c.title)}" placeholder="Например, Основы Python" autocomplete="off"></div>
          <div class="field"><label for="k-slug">Адрес (slug)</label><input id="k-slug" type="text" class="mono" data-wm="course.slug" value="${esc(c.slug)}" spellcheck="false"><span class="help">Латиница, цифры и дефисы. Подставляется из названия.</span></div>
          <div class="field"><label for="k-desc">Описание</label><textarea id="k-desc" style="min-height:110px;font-family:var(--sans);font-size:14px" data-wm="course.desc" placeholder="О чём курс и кому он подойдёт">${esc(c.desc)}</textarea></div>
          <div class="field"><span class="label">Редакторы курса</span><div class="mentors">${M.MENTORS.map(m => `<label class="mentor"><input type="checkbox" value="${esc(m)}" data-wtoggle="course.editors" ${c.editors.includes(m) ? 'checked' : ''}><span class="avatar">${esc(M.initials(m))}</span><span><b>${esc(m)}</b></span></label>`).join('')}</div><span class="help">Редакторы пишут уроки и задания. Без выбора курс ведёт только руководитель.</span></div>
          ${M.footer('course', 1, 'Структура')}
        </form>
        <aside><p class="label" style="margin-bottom:8px">Так курс выглядит в списке</p><div class="pcard" id="course-preview">${previewCard()}</div></aside>
      </div></div>`;
  }

  // ---------- step 2: structure ----------
  function manual(c) {
    return `<div class="tree">${c.modules.map((m, mi) => `<div class="tmod">
      <div class="tmod-head"><span class="small dim num">${mi + 1}</span>
        <input type="text" value="${esc(m.title)}" data-wm="course.modules.${mi}.title" placeholder="Название модуля" aria-label="Название модуля">
        <label class="week-in small muted" style="display:flex;gap:6px;align-items:center;white-space:nowrap">Неделя <input type="number" min="1" max="52" value="${m.week}" data-wm="course.modules.${mi}.week" data-num style="width:64px;padding:4px 8px" aria-label="Неделя открытия"></label>
        <span class="actions" style="margin-left:auto"><button class="btn ghost sm icon" data-w="m-up" data-m="${mi}" ${mi ? '' : 'disabled'} aria-label="Выше">↑</button><button class="btn ghost sm icon" data-w="m-down" data-m="${mi}" ${mi < c.modules.length - 1 ? '' : 'disabled'} aria-label="Ниже">↓</button><button class="btn ghost sm icon danger" data-w="m-del" data-m="${mi}" aria-label="Удалить модуль">✕</button></span></div>
      ${m.lessons.map((l, li) => `<div class="tless"><div class="tless-head"><span class="ln" style="margin:0">${mi + 1}.${li + 1}</span>
        <input type="text" value="${esc(l.title)}" data-wm="course.modules.${mi}.lessons.${li}.title" placeholder="Название урока" aria-label="Название урока">
        <span class="actions" style="margin-left:auto"><button class="btn ghost sm icon" data-w="l-up" data-m="${mi}" data-l="${li}" ${li ? '' : 'disabled'} aria-label="Выше">↑</button><button class="btn ghost sm icon" data-w="l-down" data-m="${mi}" data-l="${li}" ${li < m.lessons.length - 1 ? '' : 'disabled'} aria-label="Ниже">↓</button><button class="btn ghost sm icon danger" data-w="l-del" data-m="${mi}" data-l="${li}" aria-label="Удалить урок">✕</button></span></div></div>`).join('')}
      <div class="tless" style="padding-left:16px"><button class="btn sm" data-w="l-add" data-m="${mi}">+ Урок</button></div></div>`).join('')}
      <div><button class="btn" data-w="m-add">+ Модуль</button></div></div>`;
  }
  function importTab(c) {
    const im = c.imp, t = im.tree, r = t ? M.parse.stats(t) : null;
    return `<div class="split src"><div class="field"><label for="k-imp">Текст плана</label>
        <textarea id="k-imp" data-wm="course.imp.text" spellcheck="false" style="min-height:240px" placeholder="Вставьте план курса">${esc(im.text)}</textarea>
        <div class="actions"><select data-wm="course.imp.fmt" data-rr style="width:auto" aria-label="Формат"><option value="md" ${im.fmt === 'md' ? 'selected' : ''}>Markdown</option><option value="csv" ${im.fmt === 'csv' ? 'selected' : ''}>CSV</option><option value="json" ${im.fmt === 'json' ? 'selected' : ''}>JSON</option></select>
          <button class="btn sm" data-w="imp-sample">Вставить пример</button>${im.fmt === 'md' ? '<button class="btn sm" data-w="imp-bad">Пример с ошибками</button>' : ''}
          <label class="btn sm" style="cursor:pointer">Загрузить файл<input type="file" data-wfile="imp" accept=".md,.txt,.csv,.json" hidden></label>
          <button class="btn primary sm" data-w="imp-parse" ${im.text.trim() ? '' : 'disabled'}>Разобрать →</button></div></div>
      <aside style="display:flex;flex-direction:column;gap:8px"><span class="label">Формат</span><div class="syntax">${im.fmt === 'md' ? '<b>#</b> Модуль\n<b>##</b> Урок\n<b>- [video|pdf|link](url)</b> Материал\n<b>&gt; task:</b> Задание' : im.fmt === 'csv' ? 'module,lesson,type,title,url\ntype: video, pdf, link, task' : '{ "modules": [ { "title", "lessons": [ { "title", "items": [ { "type", "title", "url" } ] } ] } ] }'}</div></aside></div>
      ${im.error ? M.alert('err', esc(im.error)) : ''}
      ${t ? `<section class="panel form"><h3>Что получится</h3>
        <div class="summary" style="position:static;border:0;padding:0;background:none">${[[r.modules, 'модуль', 'модуля', 'модулей'], [r.lessons, 'урок', 'урока', 'уроков'], [r.materials, 'материал', 'материала', 'материалов'], [r.tasks, 'задание', 'задания', 'заданий']].map(a => `<div class="stat"><b>${a[0]}</b> ${plural(...a).split(' ')[1]}</div>`).join('')}
          ${r.errors ? `<span class="badge err">${plural(r.errors, 'ошибка', 'ошибки', 'ошибок')}</span>` : '<span class="badge ok">Ошибок нет</span>'}${r.warns ? `<span class="badge warn">${plural(r.warns, 'предупреждение', 'предупреждения', 'предупреждений')}</span>` : ''}</div>
        <ul class="titems" style="margin-left:0">${t.modules.map(m => `<li><b class="hi">${esc(m.title || '(без названия)')}</b> <span class="muted">${plural(m.lessons.length, 'урок', 'урока', 'уроков')}</span> ${(m.issues || []).map(i => `<span class="issue ${i.sev}">${i.sev === 'err' ? '✕' : '⚠'} ${esc(i.msg)}</span>`).join(' ')}${m.lessons.flatMap(l => [...(l.issues || []), ...l.items.flatMap(it => it.issues || [])].map(i => `<span class="issue ${i.sev}">${i.sev === 'err' ? '✕' : '⚠'} ${esc(l.title || '(урок)')}: ${esc(i.msg)}</span>`)).slice(0, 4).join(' ')}</li>`).join('')}</ul>
        <div class="opts"><label class="opt"><input type="radio" name="imode" value="append" data-wm="course.imp.mode" ${im.mode === 'append' ? 'checked' : ''}><div><b>Добавить в конец</b><span>Уже созданные модули останутся</span></div></label>
          <label class="opt"><input type="radio" name="imode" value="replace" data-wm="course.imp.mode" ${im.mode === 'replace' ? 'checked' : ''}><div><b>Заменить структуру</b><span>Модули и уроки заменятся импортированными</span></div></label></div>
        <div class="actions"><button class="btn primary" data-w="imp-apply" ${r.errors || !r.lessons ? 'disabled' : ''}>Применить к курсу →</button>${r.errors ? '<span class="small muted">Исправьте ошибки в тексте и разберите заново</span>' : ''}</div></section>` : ''}`;
  }
  function step2() {
    const c = C();
    return `<div class="page wide">
      ${M.head('Шаг 2 из 5', 'Структура курса', 'Модули открываются по неделям, внутри них уроки. Соберите вручную или импортируйте готовый план.')}
      <div class="tabs" role="tablist"><button class="tab" role="tab" aria-selected="${c.tab === 'manual'}" data-w="c-tab" data-v="manual">Вручную</button><button class="tab" role="tab" aria-selected="${c.tab === 'import'}" data-w="c-tab" data-v="import">Импорт из файла</button></div>
      ${c.tab === 'manual' ? (c.modules.length ? manual(c) : M.empty('Структура пока пустая', 'Добавьте первый модуль или импортируйте план из Markdown или таблицы: так быстрее, чем набирать вручную.', '<button class="btn primary" data-w="m-add">+ Модуль</button><button class="btn" data-w="c-tab" data-v="import">Импортировать план</button>')) : importTab(c)}
      <section class="panel form"><h3>Страницы курса</h3><p class="help">Отдельные страницы вне модулей. Появятся вверху меню курса.</p>
        <div class="actions" style="gap:16px">${[['syllabus', 'Программа курса'], ['about', 'О курсе'], ['grading', 'Оценивание']].map(([k, t]) => `<label class="row-i"><input type="checkbox" data-wm="course.pages.${k}" ${c.pages[k] ? 'checked' : ''}> ${t}</label>`).join('')}</div></section>
      ${M.footer('course', 2, 'Материалы', { hint: c.modules.length ? '' : 'Нужен хотя бы один модуль с уроком' })}</div>`;
  }

  // ---------- steps 3 and 4: lesson pane ----------
  function lessonList(c, mode) {
    return `<div class="lpick" role="list">${c.modules.map((m, mi) => `<div class="lpick-mod">${esc(m.title || 'Модуль')} <span class="num dim">нед. ${m.week}</span></div>
      ${m.lessons.map((l, li) => {
        const n = mode === 'mat' ? l.materials.length : l.tasks.length, on = c.sel.m === mi && c.sel.l === li;
        return `<button class="lbtn" role="listitem" data-w="sel" data-m="${mi}" data-l="${li}" ${on ? 'aria-current="true"' : ''}><span>${esc(l.title || 'Урок')}</span><span class="badge ${n ? '' : 'warn'}">${n || (mode === 'mat' ? 'пусто' : 'нет')}</span></button>`;
      }).join('') || '<div class="small dim" style="padding:4px 12px">Нет уроков</div>'}`).join('')}</div>`;
  }
  const noLessons = (c) => !lessonsOf(c).length;
  const needStructure = () => `<div class="page wide">${M.empty('Сначала добавьте уроки', 'Материалы и задания привязываются к урокам. Вернитесь к структуре и добавьте хотя бы один модуль с уроком.', '<a class="btn primary" href="#/course/2">← К структуре</a>')}</div>`;

  function matForm(c) {
    const m = c.mat;
    const fileKind = ['pdf', 'file', 'image'].includes(m.kind);
    return `<section class="panel form"><h3>Новый материал</h3>
      <div class="kinds" role="radiogroup" aria-label="Тип материала">${Object.entries(M.KINDS).map(([k, t]) => `<button class="kbtn" role="radio" aria-checked="${m.kind === k}" data-w="mat-kind" data-v="${k}">${t}</button>`).join('')}</div>
      <div class="field"><label for="m-title">Название</label><input id="m-title" type="text" data-wm="course.mat.title" value="${esc(m.title)}" placeholder="Например, Конспект лекции"></div>
      ${m.kind === 'markdown' ? `<div class="field"><label for="m-text">Текст (Markdown)</label><textarea id="m-text" style="min-height:120px" data-wm="course.mat.text" placeholder="# Заголовок">${esc(m.text)}</textarea></div>` : ''}
      ${m.kind === 'video' || m.kind === 'link' ? `<div class="field"><label for="m-url">Ссылка</label><input id="m-url" type="text" data-wm="course.mat.url" value="${esc(m.url)}" placeholder="https://"></div>` : ''}
      ${fileKind ? `<div class="field"><span class="label">Файл</span><div class="actions"><label class="btn sm" style="cursor:pointer">Выбрать файл<input type="file" data-wfile="mat" hidden></label><span class="small ${m.file ? 'hi' : 'muted'}">${esc(m.file || 'Файл не выбран')}</span></div></div>` : ''}
      <div class="field"><span class="label">Теги</span><div class="actions" style="gap:12px">${Object.entries(M.TAGS).map(([k, t]) => `<label class="row-i small"><input type="checkbox" value="${k}" data-wtoggle="course.mat.tags" ${m.tags.includes(k) ? 'checked' : ''}> ${t}</label>`).join('')}</div></div>
      <div class="actions"><label class="row-i"><input type="checkbox" data-wm="course.mat.pub" ${m.pub ? 'checked' : ''}> Опубликован сразу</label><span class="spacer"></span><button class="btn primary" data-w="mat-add">Добавить материал</button></div></section>`;
  }
  function step3() {
    const c = C(); if (noLessons(c)) return needStructure(); fixSel(c);
    const l = curLesson(c), mod = c.modules[c.sel.m];
    const total = stats(c).materials;
    return `<div class="page wide">
      ${M.head('Шаг 3 из 5', 'Материалы', 'Выберите урок слева и добавьте материалы в порядке изучения: текст, видео, PDF, ссылки.')}
      <div class="two"><aside>${lessonList(c, 'mat')}</aside>
      <div class="form" style="min-width:0"><div><h2>${esc(l.title || 'Урок')}</h2><p class="small muted">${esc(mod.title)} · ${plural(l.materials.length, 'материал', 'материала', 'материалов')}</p></div>
        ${l.materials.length ? `<ol class="courses outline">${l.materials.map((x, i) => `<li><span class="kind">${M.KINDS[x.kind]}</span>
          <div class="grow"><div class="hi">${esc(x.title)}</div><div class="small muted">${esc(x.url || x.file || (x.text ? x.text.slice(0, 50) : ''))}${x.tags.length ? ' · ' + x.tags.map(t => M.TAGS[t]).join(', ') : ''}</div></div>
          <label class="row-i small muted"><input type="checkbox" data-wm="course.modules.${c.sel.m}.lessons.${c.sel.l}.materials.${i}.pub" ${x.pub ? 'checked' : ''}> опубл.</label>
          <span class="actions"><button class="btn ghost sm icon" data-w="mat-up" data-i="${i}" ${i ? '' : 'disabled'} aria-label="Выше">↑</button><button class="btn ghost sm icon" data-w="mat-down" data-i="${i}" ${i < l.materials.length - 1 ? '' : 'disabled'} aria-label="Ниже">↓</button><button class="btn ghost sm icon danger" data-w="mat-del" data-i="${i}" aria-label="Удалить">✕</button></span></li>`).join('')}</ol>` : '<div class="outline empty" style="padding:24px"><p>В уроке пока нет материалов.</p></div>'}
        ${matForm(c)}
        <section class="panel form"><h3>Загрузить сразу несколько</h3><p class="help">Каждый файл станет отдельным материалом в этом уроке. Тип определяется по расширению.</p>
          <div class="actions"><label class="btn" style="cursor:pointer">Выбрать файлы<input type="file" multiple data-wfile="bulk" hidden></label><button class="btn ghost" data-w="pub-all">Опубликовать все материалы курса</button></div></section></div></div>
      ${M.footer('course', 3, 'Задания', { hint: `${plural(total, 'материал', 'материала', 'материалов')} в курсе` })}</div>`;
  }

  const TPL = {
    weekly: { mode: 'homework', title: 'Домашка недели', due: 7, max: 100, formats: ['files', 'links'], limit: 3, solOn: true, solRelease: 'after_due' },
    midterm: { mode: 'exam', title: 'Промежуточный экзамен', windowDay: 5, windowTime: '14:00', duration: 120, trial: true, max: 100, formats: ['files'], limit: 1, solOn: true, solRelease: 'after_due' },
    practice: { mode: 'practice', title: 'Практический набор', max: 50, formats: ['files', 'text'], limit: 3, solOn: true, solRelease: 'after_submit' }
  };
  const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const taskInfo = t => t.mode === 'exam' ? `${DAYS[(t.windowDay || 1) - 1]} ${t.windowTime} · ${t.duration} мин${t.trial ? ' · пробная попытка' : ''}` : t.mode === 'homework' ? `дедлайн +${t.due} дн.` : 'без дедлайна, попытки не ограничены';
  function taskForm(c) {
    const t = c.task;
    if (t.mode === 'practice' && t.solRelease === 'after_due') t.solRelease = 'after_submit';
    if (t.mode !== 'practice' && t.solRelease === 'after_submit') t.solRelease = 'after_due';
    const rel = t.mode === 'practice' ? ['after_submit', 'manual'] : ['after_due', 'manual'];
    return `<section class="panel form"><h3>Новое задание</h3>
      <div class="actions"><span class="small muted">Шаблоны:</span><button class="btn sm" data-w="tpl" data-v="weekly">Еженедельная домашка</button><button class="btn sm" data-w="tpl" data-v="midterm">Экзамен</button><button class="btn sm" data-w="tpl" data-v="practice">Практика</button></div>
      <div class="opts" style="flex-direction:row;flex-wrap:wrap">${[['homework', 'Домашка', 'Дедлайн через N дней после открытия урока'], ['exam', 'Экзамен', 'Окно по времени, одна попытка'], ['practice', 'Практика', 'Попытки без ограничений, решение после первой']].map(([k, a, d]) => `<label class="opt" style="flex:1 1 180px"><input type="radio" name="tmode" value="${k}" data-wm="course.task.mode" data-rr ${t.mode === k ? 'checked' : ''}><div><b>${a}</b><span>${d}</span></div></label>`).join('')}</div>
      <div class="field"><label for="t-title">Название</label><input id="t-title" type="text" data-wm="course.task.title" value="${esc(t.title)}" placeholder="Например, Домашка 1. Калькулятор"></div>
      <div class="field"><label for="t-st">Условие (Markdown)</label><textarea id="t-st" style="min-height:90px;font-family:var(--sans);font-size:14px" data-wm="course.task.statement" placeholder="Что нужно сделать">${esc(t.statement)}</textarea></div>
      <div class="grid3">
        ${t.mode === 'homework' ? `<div class="field"><label for="t-due">Дедлайн, дней после открытия</label><input id="t-due" type="number" min="1" max="90" data-wm="course.task.due" value="${t.due}"></div>` : ''}
        ${t.mode === 'exam' ? `<div class="field"><label for="t-day">День окна</label><select id="t-day" data-wm="course.task.windowDay" data-num>${DAYS.map((d, i) => `<option value="${i + 1}" ${t.windowDay === i + 1 ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
          <div class="field"><label for="t-time">Начало</label><input id="t-time" type="time" data-wm="course.task.windowTime" value="${t.windowTime}" style="color-scheme:dark"></div>
          <div class="field"><label for="t-dur">Длительность, мин</label><input id="t-dur" type="number" min="15" max="480" data-wm="course.task.duration" value="${t.duration}"></div>` : ''}
        <div class="field"><label for="t-max">Максимум баллов</label><input id="t-max" type="number" min="1" max="1000" data-wm="course.task.max" value="${t.max}"></div>
        <div class="field"><label for="t-lim">Файлов не больше</label><input id="t-lim" type="number" min="1" max="10" data-wm="course.task.limit" value="${t.limit}"></div>
      </div>
      ${t.mode === 'exam' ? `<label class="row-i"><input type="checkbox" data-wm="course.task.trial" ${t.trial ? 'checked' : ''}> Пробная попытка перед экзаменом</label>` : ''}
      <div class="field"><span class="label">Что принимаем</span><div class="actions" style="gap:16px">${[['files', 'Файлы'], ['text', 'Текст'], ['links', 'Ссылки']].map(([k, a]) => `<label class="row-i"><input type="checkbox" value="${k}" data-wtoggle="course.task.formats" ${t.formats.includes(k) ? 'checked' : ''}> ${a}</label>`).join('')}</div></div>
      <div class="field"><label class="row-i"><input type="checkbox" data-wm="course.task.solOn" data-rr ${t.solOn ? 'checked' : ''}> Добавить решение</label>
        ${t.solOn ? `<div class="grid2" style="margin-top:8px"><div class="field"><label for="t-rel">Когда открыть решение</label><select id="t-rel" data-wm="course.task.solRelease">${rel.map(k => `<option value="${k}" ${t.solRelease === k ? 'selected' : ''}>${M.RELEASE[k]}</option>`).join('')}</select></div><div class="field"><span class="label">Файл решения</span><span class="small muted" style="padding:8px 0">Загрузите после создания задания</span></div></div>` : ''}</div>
      <div class="actions"><span class="spacer"></span><button class="btn primary" data-w="task-add">Добавить задание</button></div></section>`;
  }
  function step4() {
    const c = C(); if (noLessons(c)) return needStructure(); fixSel(c);
    const l = curLesson(c), mod = c.modules[c.sel.m];
    return `<div class="page wide">
      ${M.head('Шаг 4 из 5', 'Задания', 'Домашки, экзамены и практика привязываются к урокам. Решение открывается по правилу, которое вы выберете.')}
      <div class="two"><aside>${lessonList(c, 'task')}</aside>
      <div class="form" style="min-width:0"><div><h2>${esc(l.title || 'Урок')}</h2><p class="small muted">${esc(mod.title)} · ${l.tasks.length ? plural(l.tasks.length, 'задание', 'задания', 'заданий') : 'заданий нет'}</p></div>
        ${l.tasks.length ? `<ol class="courses outline">${l.tasks.map((x, i) => `<li><span class="kind task">${M.MODES[x.mode]}</span>
          <div class="grow"><div class="hi">${esc(x.title)}</div><div class="small muted">${taskInfo(x)} · ${x.max} б.${x.solOn ? ' · решение: ' + M.RELEASE[x.solRelease].toLowerCase() : ''}</div></div>
          <span class="actions"><button class="btn ghost sm icon" data-w="task-up" data-i="${i}" ${i ? '' : 'disabled'} aria-label="Выше">↑</button><button class="btn ghost sm icon" data-w="task-down" data-i="${i}" ${i < l.tasks.length - 1 ? '' : 'disabled'} aria-label="Ниже">↓</button><button class="btn ghost sm icon danger" data-w="task-del" data-i="${i}" aria-label="Удалить">✕</button></span></li>`).join('')}</ol>` : '<div class="outline empty" style="padding:24px"><p>К этому уроку заданий нет. Это нормально для вводных уроков.</p></div>'}
        ${taskForm(c)}</div></div>
      ${M.footer('course', 4, 'Проверка', { hint: `${plural(stats(c).tasks, 'задание', 'задания', 'заданий')} в курсе` })}</div>`;
  }

  // ---------- step 5: review ----------
  function review(c) {
    const issues = [], s = stats(c);
    if (!c.modules.length) issues.push(['err', 'В курсе нет модулей', 2]);
    c.modules.forEach(m => { if (!m.lessons.length) issues.push(['warn', `Модуль «${m.title || 'без названия'}» без уроков`, 2]); });
    const all = lessonsOf(c);
    const emptyL = all.filter(x => !x.l.materials.length);
    if (emptyL.length) issues.push(['warn', `${plural(emptyL.length, 'урок', 'урока', 'уроков')} без материалов: ${emptyL.slice(0, 3).map(x => '«' + (x.l.title || '—') + '»').join(', ')}${emptyL.length > 3 ? '…' : ''}`, 3]);
    const unpub = all.reduce((n, x) => n + x.l.materials.filter(y => !y.pub).length, 0);
    if (unpub) issues.push(['warn', `${plural(unpub, 'материал', 'материала', 'материалов')} не опубликовано, студенты их не увидят`, 3]);
    const noTask = all.filter(x => !x.l.tasks.length).length;
    if (noTask && s.tasks) issues.push(['info', `${plural(noTask, 'урок', 'урока', 'уроков')} без заданий`, 4]);
    if (!s.tasks && s.lessons) issues.push(['warn', 'В курсе нет ни одного задания', 4]);
    const noSol = all.reduce((n, x) => n + x.l.tasks.filter(t => !t.solOn).length, 0);
    if (noSol) issues.push(['info', `${plural(noSol, 'задание', 'задания', 'заданий')} без решения`, 4]);
    return issues;
  }
  function step5() {
    const c = C(), issues = review(c), s = stats(c), errs = issues.filter(i => i[0] === 'err').length;
    const first = lessonsOf(c).find(x => x.l.materials.length || x.l.tasks.length);
    return `<div class="page wide">
      ${M.head('Шаг 5 из 5', 'Проверка и публикация', 'Посмотрите, чего не хватает, и как курс увидит студент. Незаполненное можно закрыть позже.')}
      <div class="summary" style="position:static">${[[s.modules, 'модуль', 'модуля', 'модулей'], [s.lessons, 'урок', 'урока', 'уроков'], [s.materials, 'материал', 'материала', 'материалов'], [s.tasks, 'задание', 'задания', 'заданий'], [s.exams, 'экзамен', 'экзамена', 'экзаменов']].map(a => `<div class="stat"><b>${a[0]}</b> ${plural(...a).split(' ')[1]}</div>`).join('')}</div>
      <section><h3 style="margin-bottom:8px">Чек-лист</h3>
        ${issues.length ? `<ul class="checklist outline">${issues.map(([k, t, st]) => `<li><span class="badge ${k === 'err' ? 'err' : k === 'warn' ? 'warn' : ''}">${k === 'err' ? 'Ошибка' : k === 'warn' ? 'Внимание' : 'Заметка'}</span><div class="grow">${esc(t)}</div><button class="btn sm" data-w="goto" data-n="${st}">Исправить</button></li>`).join('')}</ul>` : M.alert('ok', 'Всё заполнено, замечаний нет.')}</section>
      ${first ? `<section><h3 style="margin-bottom:8px">Так урок увидит студент</h3><div class="panel form"><div><div class="eyebrow">${esc(first.m.title)}</div><h2>${esc(first.l.title)}</h2></div>
        <ul class="titems" style="margin-left:0">${first.l.materials.filter(x => x.pub).map(x => `<li><span class="kind">${M.KINDS[x.kind]}</span><span class="hi">${esc(x.title)}</span></li>`).join('') || '<li class="muted">Опубликованных материалов нет</li>'}</ul>
        ${first.l.tasks.map(t => `<div class="outline" style="padding:12px 16px;background:var(--bg)"><div class="row-i"><span class="kind task">${M.MODES[t.mode]}</span><b class="hi">${esc(t.title)}</b></div><div class="small muted" style="margin-top:4px">${taskInfo(t)} · ${t.max} б.</div></div>`).join('')}</div></section>` : ''}
      <section class="panel form"><h3>Статус</h3><div class="opts">
        <label class="opt"><input type="radio" name="pub" value="draft" data-wm="course.publish" ${c.publish === 'draft' ? 'checked' : ''}><div><b>Черновик</b><span>Виден только редакторам. Можно добавить в программу, но студентам не откроется.</span></div></label>
        <label class="opt"><input type="radio" name="pub" value="published" data-wm="course.publish" ${c.publish === 'published' ? 'checked' : ''}><div><b>Опубликовать</b><span>Курс доступен потокам, которые на нём учатся</span></div></label></div></section>
      ${M.footer('course', 5, c.publish === 'published' ? 'Опубликовать курс' : 'Сохранить курс', { disabled: !!errs, hint: errs ? 'Исправьте ошибки' : '' })}</div>`;
  }
  function done() {
    const id = W().lastCourse, c = M.courseById(id);
    return `<div class="page">
      ${M.head('Готово', c ? esc(c.title) : 'Курс создан', c ? `${c.published ? 'Опубликован' : 'Сохранён как черновик'}. ${plural(stats(c).lessons, 'урок', 'урока', 'уроков')}, ${plural(stats(c).materials, 'материал', 'материала', 'материалов')}, ${plural(stats(c).tasks, 'задание', 'задания', 'заданий')}.` : '')}
      <div class="alert ok">✓ <div>Курс появился в библиотеке. Его можно добавить в программу.</div></div>
      <div class="actions"><button class="btn primary" data-w="start" data-name="programme">Собрать программу →</button><button class="btn" data-w="start" data-name="course">Создать ещё курс</button><a class="btn ghost" href="#/hub">К списку</a></div></div>`;
  }

  // ---------- import helpers ----------
  function treeToModules(tree) {
    return tree.modules.filter(m => m.on && m.lessons.length).map((m, i) => ({
      id: M.nid('m'), title: m.title, week: i + 1,
      lessons: m.lessons.filter(l => l.on).map(l => ({
        id: M.nid('l'), title: l.title,
        materials: l.items.filter(x => x.kind !== 'task').map(x => ({ id: M.nid('x'), kind: x.kind, title: x.title || x.url, url: x.url, tags: [], pub: true })),
        tasks: l.items.filter(x => x.kind === 'task').map(x => ({ id: M.nid('t'), ...newTask(), mode: 'homework', title: x.title, formats: ['files', 'links'] }))
      }))
    }));
  }

  // ---------- acts ----------
  const A = M.acts, ix = b => ({ m: Number(b.dataset.m), l: Number(b.dataset.l), i: Number(b.dataset.i) });
  A['c-tab'] = b => { C().tab = b.dataset.v; M.render(); };
  A['m-add'] = () => { const c = C(); c.modules.push({ id: M.nid('m'), title: `Модуль ${c.modules.length + 1}`, week: c.modules.length + 1, lessons: [] }); M.render(); };
  A['m-del'] = b => { C().modules.splice(ix(b).m, 1); M.render(); };
  A['m-up'] = b => { move(C().modules, ix(b).m, -1); M.render(); };
  A['m-down'] = b => { move(C().modules, ix(b).m, 1); M.render(); };
  A['l-add'] = b => { const m = C().modules[ix(b).m]; m.lessons.push({ id: M.nid('l'), title: `Урок ${m.lessons.length + 1}`, materials: [], tasks: [] }); M.render(); };
  A['l-del'] = b => { const { m, l } = ix(b); C().modules[m].lessons.splice(l, 1); M.render(); };
  A['l-up'] = b => { const { m, l } = ix(b); move(C().modules[m].lessons, l, -1); M.render(); };
  A['l-down'] = b => { const { m, l } = ix(b); move(C().modules[m].lessons, l, 1); M.render(); };
  A.sel = b => { C().sel = { m: ix(b).m, l: ix(b).l }; M.render(); };
  A['mat-kind'] = b => { C().mat.kind = b.dataset.v; M.render(); };
  A['mat-up'] = b => { move(curLesson(C()).materials, ix(b).i, -1); M.render(); };
  A['mat-down'] = b => { move(curLesson(C()).materials, ix(b).i, 1); M.render(); };
  A['mat-del'] = b => { curLesson(C()).materials.splice(ix(b).i, 1); M.render(); };
  A['mat-add'] = () => {
    const c = C(), m = c.mat;
    if (m.title.trim().length < 2) return M.toast('Введите название материала');
    if (['video', 'link'].includes(m.kind) && !/^https?:\/\/\S+$/.test(m.url)) return M.toast('Ссылка должна начинаться с https://');
    if (['pdf', 'file', 'image'].includes(m.kind) && !m.file) return M.toast('Выберите файл');
    if (m.kind === 'markdown' && !m.text.trim()) return M.toast('Введите текст материала');
    curLesson(c).materials.push({ id: M.nid('x'), kind: m.kind, title: m.title.trim(), url: m.url, text: m.text, file: m.file, tags: [...m.tags], pub: m.pub });
    c.mat = { ...newMat(), kind: m.kind, pub: m.pub }; M.toast('Материал добавлен'); M.render();
  };
  A['pub-all'] = () => { lessonsOf(C()).forEach(x => x.l.materials.forEach(y => { y.pub = true; })); M.toast('Все материалы опубликованы'); M.render(); };
  A.tpl = b => { const c = C(); c.task = { ...newTask(), ...TPL[b.dataset.v], formats: [...TPL[b.dataset.v].formats] }; M.render(); };
  A['task-up'] = b => { move(curLesson(C()).tasks, ix(b).i, -1); M.render(); };
  A['task-down'] = b => { move(curLesson(C()).tasks, ix(b).i, 1); M.render(); };
  A['task-del'] = b => { curLesson(C()).tasks.splice(ix(b).i, 1); M.render(); };
  A['task-add'] = () => {
    const c = C(), t = c.task;
    if (t.title.trim().length < 2) return M.toast('Введите название задания');
    if (!t.formats.length) return M.toast('Выберите, что принимаем: файлы, текст или ссылки');
    if (t.mode === 'exam' && (!t.windowTime || t.duration < 15)) return M.toast('Для экзамена нужны время начала и длительность от 15 минут');
    curLesson(c).tasks.push({ id: M.nid('t'), ...t, title: t.title.trim(), formats: [...t.formats] });
    c.task = { ...newTask(), mode: t.mode }; M.toast('Задание добавлено'); M.render();
  };
  A['imp-sample'] = () => { C().imp.text = M.SAMPLES[C().imp.fmt]; C().imp.tree = null; C().imp.error = ''; M.render(); };
  A['imp-bad'] = () => { C().imp.text = M.SAMPLES.mdBad; C().imp.tree = null; M.render(); };
  A['imp-parse'] = () => {
    const im = C().imp;
    try {
      im.tree = ({ md: M.parse.md, csv: M.parse.csv, json: M.parse.json })[im.fmt](im.text);
      if (!im.tree.modules.length) throw new Error('Не нашли ни одного модуля. Проверьте формат.');
      M.parse.validate(im.tree); im.error = '';
    } catch (e) { im.tree = null; im.error = `Не удалось разобрать: ${e.message}`; }
    M.render();
  };
  A['imp-apply'] = () => {
    const c = C(), mods = treeToModules(c.imp.tree);
    c.modules = c.imp.mode === 'replace' ? mods : [...c.modules, ...mods].map((m, i) => ({ ...m, week: i + 1 }));
    c.tab = 'manual'; c.imp.tree = null; c.sel = { m: 0, l: 0 };
    M.toast(`Импортировано модулей: ${mods.length}`); M.render();
  };

  const W5 = {
    title: 'Создание курса', steps: ['Основное', 'Структура', 'Материалы', 'Задания', 'Публикация'],
    view(n) { return [step1, step2, step3, step4, step5, done][n - 1](); },
    validate(n) {
      const c = C();
      if (n === 1) { if (c.title.trim().length < 2) return 'Введите название курса'; if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.slug)) return 'Адрес: латиница, цифры и дефисы'; }
      if (n === 2 && !lessonsOf(c).length) return 'Добавьте хотя бы один модуль с уроком';
      return '';
    },
    live(path) {
      const c = C();
      if (path === 'course.title' && !c.slugTouched) { c.slug = M.slugify(c.title); const s = $('#k-slug'); if (s) s.value = c.slug; }
      if (path === 'course.slug') c.slugTouched = !!c.slug;
      if (path.startsWith('course.imp.text')) { const b = $('[data-w="imp-parse"]'); if (b) b.disabled = !c.imp.text.trim(); }
      const p = $('#course-preview'); if (p) p.innerHTML = previewCard();
    },
    file(kind, input) {
      const c = C(), files = [...input.files];
      if (kind === 'imp') {
        const f = files[0]; if (!f) return;
        const rd = new FileReader();
        rd.onload = () => { const ext = f.name.split('.').pop().toLowerCase(); c.imp.fmt = ext === 'csv' ? 'csv' : ext === 'json' ? 'json' : 'md'; c.imp.text = String(rd.result); c.imp.tree = null; M.render(); };
        rd.readAsText(f);
      }
      if (kind === 'mat' && files[0]) { c.mat.file = files[0].name; if (!c.mat.title) c.mat.title = files[0].name.replace(/\.[^.]+$/, ''); M.render(); }
      if (kind === 'bulk' && files.length) {
        const l = curLesson(c);
        files.forEach(f => {
          const ext = f.name.split('.').pop().toLowerCase();
          const kind2 = ext === 'pdf' ? 'pdf' : ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) ? 'image' : 'file';
          l.materials.push({ id: M.nid('x'), kind: kind2, title: f.name.replace(/\.[^.]+$/, ''), file: f.name, tags: [], pub: true });
        });
        M.toast(`Добавлено материалов: ${files.length}`); M.render();
      }
    },
    finish() {
      const c = C();
      const id = M.nid('c');
      M.W.lib.courses.push({ id, title: c.title.trim(), slug: c.slug, desc: c.desc, editors: [...c.editors], modules: JSON.parse(JSON.stringify(c.modules)), pages: { ...c.pages }, published: c.publish === 'published' });
      M.W.lastCourse = id; M.W.course = null;
      const back = M.W.returnTo; M.W.returnTo = null;
      if (back) {
        if (back.startsWith('programme') && M.W.prog) M.W.prog.courseIds.push(id);
        M.toast('Курс создан и добавлен в программу'); return M.go(`#/${back}`);
      }
      M.go('#/course/6');
    }
  };
  M.wizards.course = W5;
})();
