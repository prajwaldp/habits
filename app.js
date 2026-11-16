(() => {
  'use strict';

  const STORE_KEY = 'habits.v1';
  const THEME_KEY = 'habits.theme';
  const COLORS = ['#ff5a5f', '#ff8a3d', '#f5b700', '#34c759', '#00b8a9', '#30a2ff', '#5e5ce6', '#af52de', '#ff4f9a', '#8e8e93'];
  const GAP = 3;
  const HOME_DAYS = 7;

  const $ = (s) => document.querySelector(s);
  const listEl = $('#list');

  // ---------- dates (local time, YYYY-MM-DD keys; weeks start Monday) ----------
  const pad = (n) => String(n).padStart(2, '0');
  const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const weekStartOf = (d) => addDays(d, -((d.getDay() + 6) % 7));
  let today = startOfDay(new Date());
  let todayKey = keyOf(today);

  // ---------- storage ----------
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const DAILY = { per: 'day', times: 1 };

  function normGoal(g) {
    if (g && g.per === 'week') {
      const t = Math.round(Number(g.times));
      return { per: 'week', times: t >= 1 && t <= 7 ? t : 3 };
    }
    return { ...DAILY };
  }

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (raw && Array.isArray(raw.habits)) return normalize(raw).map(h => ({ ...h, done: new Set(h.done) }));
    } catch (e) { console.warn('Could not read saved habits', e); }
    return [];
  }

  function normalize(data) {
    if (!data || !Array.isArray(data.habits)) throw new Error('No "habits" list found in file');
    return data.habits.map((h) => {
      if (!h || typeof h.name !== 'string') throw new Error('A habit is missing its name');
      const done = Array.isArray(h.done) ? h.done : Object.keys(h.days || {}).filter(k => h.days[k]);
      return {
        id: typeof h.id === 'string' && h.id ? h.id : uid(),
        name: h.name.slice(0, 40),
        color: /^#[0-9a-f]{6}$/i.test(h.color) ? h.color : COLORS[0],
        created: /^\d{4}-\d{2}-\d{2}$/.test(h.created) ? h.created : todayKey,
        goal: normGoal(h.goal),
        done: done.filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)),
      };
    });
  }

  function serialize() {
    return {
      app: 'habits',
      version: 2,
      exportedAt: new Date().toISOString(),
      habits: habits.map(h => ({ id: h.id, name: h.name, color: h.color, created: h.created, goal: h.goal, done: [...h.done].sort() })),
    };
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(serialize())); }
    catch (e) { toast('Could not save. Storage may be full or blocked.'); }
  }

  let habits = load();

  // ---------- stats ----------
  const countWeek = (h, monday) => { let n = 0; for (let i = 0; i < 7; i++) if (h.done.has(keyOf(addDays(monday, i)))) n++; return n; };

  function stats(h) {
    if (h.goal.per === 'week') {
      // streak = consecutive weeks that hit the target; this week counts once it's hit
      const thisWeek = weekStartOf(today);
      const thisCount = countWeek(h, thisWeek);
      let cur = 0;
      let w = thisCount >= h.goal.times ? thisWeek : addDays(thisWeek, -7);
      while (countWeek(h, w) >= h.goal.times) { cur++; w = addDays(w, -7); }
      let best = 0, run = 0;
      const keys = [...h.done].sort();
      if (keys.length) {
        let wk = weekStartOf(new Date(keys[0] + 'T00:00:00'));
        while (wk <= thisWeek) {
          run = countWeek(h, wk) >= h.goal.times ? run + 1 : 0;
          best = Math.max(best, run);
          wk = addDays(wk, 7);
        }
      }
      return { cur, best, total: h.done.size, week: thisCount };
    }
    let cur = 0;
    let d = h.done.has(todayKey) ? today : addDays(today, -1);
    while (h.done.has(keyOf(d))) { cur++; d = addDays(d, -1); }
    let best = 0, run = 0, prev = null;
    for (const k of [...h.done].sort()) {
      const t = new Date(k + 'T00:00:00');
      run = prev && Math.round((t - prev) / 864e5) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = t;
    }
    return { cur, best, total: h.done.size };
  }

  const goalText = (g) => g.per === 'week' ? `${g.times}× a week` : 'Every day';

  // ---------- rendering ----------
  const CHECK_SVG = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const esc = (s) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function render() {
    $('#today-label').textContent = today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    $('#empty').hidden = habits.length > 0;
    listEl.innerHTML = '';
    for (const h of habits) listEl.appendChild(cardFor(h));
  }

  function cardFor(h) {
    const el = document.createElement('article');
    el.className = 'card';
    el.dataset.id = h.id;
    el.style.setProperty('--accent', h.color);
    el.innerHTML = `
      <button class="card-title" data-act="edit" aria-label="Open ${esc(h.name)}">
        <h3>${esc(h.name)}</h3>
        <span class="goal-tag"></span>
      </button>
      <div class="meta"></div>
      <div class="week" role="group" aria-label="Last ${HOME_DAYS} days"></div>`;
    fill(el, h);
    return el;
  }

  function fill(el, h) {
    const s = stats(h);
    el.querySelector('.goal-tag').textContent = goalText(h.goal);
    let meta;
    if (h.goal.per === 'week') {
      const pips = Array.from({ length: h.goal.times }, (_, i) => `<i class="pip${i < s.week ? ' on' : ''}"></i>`).join('');
      const met = s.week >= h.goal.times;
      meta = `<span class="pips" aria-label="${s.week} of ${h.goal.times} this week">${pips}</span>
        <span>${met ? 'Goal met this week' : `${s.week} of ${h.goal.times} this week`}</span>
        <span><b>${s.cur}</b> week streak</span><span>best ${s.best}</span>`;
    } else {
      meta = `<span><b>${s.cur}</b> day streak</span><span>best ${s.best}</span><span>${s.total} total</span>`;
    }
    el.querySelector('.meta').innerHTML = meta;

    const week = el.querySelector('.week');
    const thisMonday = weekStartOf(today);
    let html = '';
    for (let i = HOME_DAYS - 1; i >= 0; i--) {
      const d = addDays(today, -i);
      const k = keyOf(d);
      const on = h.done.has(k);
      const isToday = i === 0;
      const prevWeek = h.goal.per === 'week' && d < thisMonday;
      const label = d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
      html += `<button class="day${on ? ' on' : ''}${isToday ? ' today' : ''}${prevWeek ? ' prev' : ''}" data-key="${k}" aria-pressed="${on}" aria-label="${label}">
        <span class="dow">${isToday ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
        <span class="dot">${on ? CHECK_SVG : `<span class="num">${d.getDate()}</span>`}</span>
      </button>`;
    }
    week.innerHTML = html;
  }

  // Full history grid (used in the habit sheet): weeks as columns, Monday on top, newest on the right.
  function drawGrid(wrap, h) {
    const grid = wrap.querySelector('.grid');
    const months = wrap.querySelector('.months');
    const width = wrap.clientWidth || 300;
    const cs = window.innerWidth < 420 ? 12 : 13;
    const weeks = Math.max(4, Math.floor((width + GAP) / (cs + GAP)));
    grid.style.setProperty('--cs', cs + 'px');
    grid.style.gridTemplateRows = `repeat(7, ${cs}px)`;
    grid.style.gridAutoColumns = cs + 'px';
    grid.style.gap = GAP + 'px';

    const start = addDays(weekStartOf(today), -(weeks - 1) * 7);
    const offset = width - (weeks * (cs + GAP) - GAP);
    const frag = document.createDocumentFragment();
    let labels = '';
    let lastLabelCol = -10;
    for (let w = 0; w < weeks; w++) {
      const weekStart = addDays(start, w * 7);
      const newMonth = weekStart.getDate() <= 7;
      const firstCol = w === 0 && addDays(start, 21).getMonth() === start.getMonth();
      if ((newMonth || firstCol) && w - lastLabelCol >= 3) {
        const fmt = weekStart.getMonth() === 0 || w === 0 ? { month: 'short', year: '2-digit' } : { month: 'short' };
        labels += `<span style="left:${offset + w * (cs + GAP)}px">${weekStart.toLocaleDateString(undefined, fmt)}</span>`;
        lastLabelCol = w;
      }
      for (let d = 0; d < 7; d++) {
        const day = addDays(weekStart, d);
        const k = keyOf(day);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cell';
        b.dataset.key = k;
        if (day > today) { b.classList.add('future'); b.disabled = true; b.tabIndex = -1; }
        else {
          if (h.done.has(k)) b.classList.add('on');
          if (k === todayKey) b.classList.add('today');
          b.title = day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) + (h.done.has(k) ? ' ✓' : '');
          b.setAttribute('aria-label', b.title);
        }
        frag.appendChild(b);
      }
    }
    grid.replaceChildren(frag);
    months.innerHTML = labels;
  }

  function refreshCard(h) {
    const el = listEl.querySelector(`.card[data-id="${CSS.escape(h.id)}"]`);
    if (el) fill(el, h);
  }

  function toggle(h, key) {
    if (h.done.has(key)) h.done.delete(key); else h.done.add(key);
    if (key < h.created) h.created = key;
    save();
    refreshCard(h);
    if (navigator.vibrate && h.done.has(key)) navigator.vibrate(10);
  }

  listEl.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    const h = habits.find(x => x.id === card.dataset.id);
    if (!h) return;
    const day = e.target.closest('.day');
    if (day) return toggle(h, day.dataset.key);
    if (e.target.closest('[data-act="edit"]')) openHabit(h);
  });

  // Roll over to a new day when the tab comes back (e.g. left open overnight)
  function checkDay() {
    const now = startOfDay(new Date());
    if (keyOf(now) !== todayKey) { today = now; todayKey = keyOf(now); render(); }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDay(); });
  setInterval(checkDay, 60_000);

  // ---------- add / edit sheet ----------
  const habitDialog = $('#habit-dialog');
  const nameInput = $('#habit-name');
  const swatchesEl = $('#swatches');
  const historyWrap = $('#history');
  let editing = null;
  let chosenColor = COLORS[0];
  let chosenGoal = { ...DAILY };
  let lastWeeklyTimes = 3;

  swatchesEl.innerHTML = COLORS.map(c => `<button type="button" class="swatch" style="--c:${c}" data-c="${c}" aria-label="Colour ${c}"></button>`).join('');
  swatchesEl.addEventListener('click', (e) => {
    const b = e.target.closest('.swatch');
    if (b) pickColor(b.dataset.c);
  });
  function pickColor(c) {
    chosenColor = c;
    swatchesEl.querySelectorAll('.swatch').forEach(b => b.classList.toggle('sel', b.dataset.c === c));
    habitDialog.style.setProperty('--accent', c);
  }

  function setGoal(g) {
    chosenGoal = normGoal(g);
    if (chosenGoal.per === 'week') lastWeeklyTimes = chosenGoal.times;
    const weekly = chosenGoal.per === 'week';
    $('#goal-daily').setAttribute('aria-checked', !weekly);
    $('#goal-weekly').setAttribute('aria-checked', weekly);
    $('#goal-stepper').hidden = !weekly;
    $('#goal-times').textContent = chosenGoal.times;
    $('#goal-unit').textContent = chosenGoal.times === 1 ? 'time a week' : 'times a week';
    $('#goal-minus').disabled = chosenGoal.times <= 1;
    $('#goal-plus').disabled = chosenGoal.times >= 6;
  }
  $('#goal-daily').addEventListener('click', () => setGoal(DAILY));
  $('#goal-weekly').addEventListener('click', () => setGoal({ per: 'week', times: lastWeeklyTimes }));
  $('#goal-minus').addEventListener('click', () => setGoal({ per: 'week', times: chosenGoal.times - 1 }));
  $('#goal-plus').addEventListener('click', () => setGoal({ per: 'week', times: chosenGoal.times + 1 }));

  historyWrap.addEventListener('click', (e) => {
    const cell = e.target.closest('.cell');
    if (!cell || cell.disabled || !editing) return;
    toggle(editing, cell.dataset.key);
    cell.classList.toggle('on', editing.done.has(cell.dataset.key));
  });

  function openHabit(h) {
    editing = h || null;
    $('#habit-dialog-title').textContent = h ? 'Edit habit' : 'New habit';
    $('#habit-save').textContent = h ? 'Save' : 'Add';
    $('#habit-delete').hidden = !h;
    $('#history-field').hidden = !h;
    nameInput.value = h ? h.name : '';
    pickColor(h ? h.color : COLORS[habits.length % COLORS.length]);
    setGoal(h ? h.goal : DAILY);
    habitDialog.showModal();
    if (h) drawGrid(historyWrap, h);
    else setTimeout(() => nameInput.focus(), 50);
  }

  $('#habit-form').addEventListener('submit', (e) => {
    const name = nameInput.value.trim();
    if (!name) { e.preventDefault(); nameInput.focus(); return; }
    if (editing) {
      editing.name = name;
      editing.color = chosenColor;
      editing.goal = { ...chosenGoal };
    } else {
      habits.push({ id: uid(), name, color: chosenColor, created: todayKey, goal: { ...chosenGoal }, done: new Set() });
    }
    save();
    render();
  });

  $('#habit-delete').addEventListener('click', async () => {
    if (!editing) return;
    const target = editing;
    habitDialog.close();
    if (!(await ask(`Delete “${target.name}” and all its history?`, 'Delete habit'))) return;
    habits = habits.filter(x => x !== target);
    save();
    render();
    toast('Habit deleted');
  });

  $('#add-btn').addEventListener('click', () => openHabit(null));

  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

  // ---------- export / import ----------
  const menuDialog = $('#menu-dialog');
  $('#menu-btn').addEventListener('click', () => {
    const total = habits.reduce((n, h) => n + h.done.size, 0);
    $('#stats').textContent = `${habits.length} habit${habits.length === 1 ? '' : 's'} · ${total} check-in${total === 1 ? '' : 's'} saved`;
    menuDialog.showModal();
  });

  $('#export-btn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(serialize(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `habits-${todayKey}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Backup exported');
  });

  $('#copy-btn').addEventListener('click', async () => {
    const text = JSON.stringify(serialize(), null, 2);
    try { await navigator.clipboard.writeText(text); toast('Backup copied. Paste it into a note or file.'); }
    catch { toast('Copy failed. Use Export instead.'); }
  });

  // ---------- in-page confirm (native confirm() is blocked in some embeds) ----------
  const confirmDialog = $('#confirm-dialog');
  function ask(message, okLabel) {
    return new Promise((resolve) => {
      $('#confirm-msg').textContent = message;
      $('#confirm-ok').textContent = okLabel;
      const done = (v) => { confirmDialog.close(); resolve(v); };
      $('#confirm-ok').onclick = () => done(true);
      $('#confirm-cancel').onclick = () => done(false);
      confirmDialog.onclose = () => resolve(false);
      confirmDialog.showModal();
    });
  }

  $('#import-btn').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const incoming = normalize(JSON.parse(await file.text()));
      if (habits.length) {
        menuDialog.close();
        if (!(await ask(`Replace your ${habits.length} current habit${habits.length === 1 ? '' : 's'} with the ${incoming.length} in this file?`, 'Replace'))) return;
      }
      habits = incoming.map(h => ({ ...h, done: new Set(h.done) }));
      save();
      render();
      menuDialog.close();
      toast(`Imported ${habits.length} habit${habits.length === 1 ? '' : 's'}`);
    } catch (err) {
      toast('Import failed: ' + (err.message || 'not a valid backup file'));
    }
  });

  // ---------- theme ----------
  const themeBtn = $('#theme-btn');
  const ICONS = {
    system: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 010 16z" fill="currentColor"/></svg>',
    light: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    dark: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/></svg>',
  };
  const LABEL = { system: 'Theme: match system', light: 'Theme: light', dark: 'Theme: dark' };
  function getTheme() { try { return localStorage.getItem(THEME_KEY) || 'system'; } catch { return 'system'; } }
  function applyTheme(t) {
    if (t === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    themeBtn.innerHTML = ICONS[t];
    themeBtn.title = LABEL[t];
    themeBtn.setAttribute('aria-label', LABEL[t]);
  }
  themeBtn.addEventListener('click', () => {
    const order = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(getTheme()) + 1) % 3];
    try { localStorage.setItem(THEME_KEY, next); } catch {}
    applyTheme(next);
    toast(LABEL[next]);
  });
  applyTheme(getTheme());

  // ---------- toast ----------
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
  }

  render();
})();
