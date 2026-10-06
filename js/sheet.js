// Hisobot jadvali: filial (tahrirlanadi) yoki umumiy (barcha filiallar yig'indisi, faqat o'qish).

async function viewSheet(centerId, branchId, month) {
  if (!isMonth(month)) month = curMonth();
  const [center, branches] = await Promise.all([DB.getCenter(centerId), DB.listBranches(centerId)]);
  const isAll = branchId === 'all';
  const branch = isAll ? null : branches.find(b => b.id === branchId);
  if (!isAll && !branch) throw new Error('Filial topilmadi');

  setHeader(center, branches, isAll ? 'all' : branchId);
  rememberView(centerId, isAll ? 'all' : branchId);

  const cols = visibleCols(center);
  const colMap = Object.fromEntries(cols.map(c => [c.key, c]));
  const editCols = cols.filter(c => c.type !== 'formula');
  const days = monthDays(month);
  const today = todayISO();
  const ids = isAll ? branches.map(b => b.id) : [branchId];
  const base = isAll ? `#/c/${centerId}/all` : `#/c/${centerId}/b/${branchId}`;

  // ---------- Holat ----------
  const store = {};                         // `${bid}|${day}` → { key: value }
  const cellKey = (bid, day) => `${bid}|${day}`;
  async function loadCells() {
    for (const k of Object.keys(store)) delete store[k];
    const rows = await DB.getCells(ids, days[0], days[days.length - 1]);
    for (const r of rows) (store[cellKey(r.branch_id, r.day)] ??= {})[r.col_key] = r.value;
  }
  await loadCells();

  function rawOf(day) {
    if (!isAll) return store[cellKey(branchId, day)] || {};
    return sumRaws(cols, ids.map(b => store[cellKey(b, day)] || {}));
  }
  function isOff(day) {
    const r = isAll ? (store[cellKey(ids[0], day)] || {}) : rawOf(day);
    return r._off != null ? r._off === '1' : weekday(day) === 0;
  }

  let viewMode = (() => {
    try { return localStorage.getItem('hisobot_view') || (innerWidth < 760 ? 'day' : 'table'); } catch { return 'table'; }
  })();
  let curDay = days.includes(today) ? today : days[0];

  // ---------- Saqlash holati ----------
  let pending = 0;
  const status = h('span', { class: 'save-status' });
  const setStatus = (txt, kind) => { status.textContent = txt; status.className = 'save-status ' + (kind || ''); };
  setStatus(isAll ? 'Faqat ko\'rish' : 'Saqlangan', isAll ? '' : 'ok');

  async function save(day, key, val) {
    const prev = store[cellKey(branchId, day)]?.[key] ?? '';
    const r = (store[cellKey(branchId, day)] ??= {});
    if (val === '') delete r[key]; else r[key] = val;
    pending++; setStatus('Saqlanmoqda…', 'busy');
    try {
      await DB.setCell(branchId, day, key, val);
      return true;
    } catch (e) {
      if (prev === '') delete r[key]; else r[key] = prev;
      toast('Saqlanmadi: ' + e.message, 'err');
      setStatus('Xatolik', 'err');
      return false;
    } finally {
      if (--pending === 0 && status.className.indexOf('err') < 0) setStatus('Saqlangan', 'ok');
    }
  }

  async function commit(inp) {
    const { day, key } = inp.dataset;
    const col = colMap[key];
    let val = inp.value.trim();
    if (col.type === 'number' && val !== '') {
      const n = num(val);
      if (n == null) { inp.classList.add('bad'); toast('Faqat raqam kiriting', 'err'); return; }
      val = String(n);
      inp.value = val;
    }
    inp.classList.remove('bad');
    const old = store[cellKey(branchId, day)]?.[key] ?? '';
    if (old === val) return;
    const td = inp.closest('td') || inp.closest('.f-row');
    const ok = await save(day, key, val);
    if (!ok) inp.value = old;
    refreshDay(day);
    if (td) { td.classList.remove('flash-ok', 'flash-err'); void td.offsetWidth; td.classList.add(ok ? 'flash-ok' : 'flash-err'); }
  }

  async function toggleOff(day) {
    if (isAll) return;
    await save(day, '_off', isOff(day) ? '0' : '1');
    refreshDay(day);
  }

  // ---------- Asboblar paneli ----------
  const viewBtns = {
    table: h('button', { class: 'seg-btn', onclick: () => setView('table') }, 'Jadval'),
    day: h('button', { class: 'seg-btn', onclick: () => setView('day') }, 'Kunlik'),
  };

  const toolbar = h('div', { class: 'sheet-bar' },
    h('div', { class: 'sheet-title' },
      h('h1', {}, isAll ? 'Barcha filiallar' : branch.name),
      h('p', { class: 'muted small' }, isAll ? `${branches.length} ta filial yig'indisi`
        : [branch.manager, branch.phone].filter(Boolean).join(' · ') || center.name)),
    h('div', { class: 'month-nav' },
      h('a', { class: 'btn icon ghost', href: `${base}?m=${addMonth(month, -1)}`, title: 'Oldingi oy' }, '‹'),
      h('label', { class: 'month-label' }, monthLabel(month),
        h('input', { type: 'month', value: month, onchange: e => e.target.value && (location.hash = `${base}?m=${e.target.value}`) })),
      h('a', { class: 'btn icon ghost', href: `${base}?m=${addMonth(month, 1)}`, title: 'Keyingi oy' }, '›')),
    h('div', { class: 'sheet-tools' },
      status,
      h('div', { class: 'seg' }, viewBtns.table, viewBtns.day),
      h('button', { class: 'btn', onclick: exportCSV, title: "Excel uchun CSV yuklab olish" }, 'CSV')));

  const body = h('div', { class: 'sheet-body' });
  mount(toolbar, body);

  // ---------- Jadval ko'rinishi ----------
  let refs = null; // { cells: Map("day|key" → el), rows: Map(day → [tr,tr]), inputs }

  function renderTable() {
    const colW = c => (c.type === 'text' ? 150 : 104);
    let html = '<div class="sheet-frame"><div class="sheet-scroll"><table class="sheet"><colgroup><col class="c-date">';
    html += cols.map(c => `<col style="width:${colW(c)}px">`).join('') + '</colgroup><thead><tr><th class="sticky-col corner">Sana</th>';
    html += cols.map(c => {
      const hint = c.type === 'formula' ? `= ${c.formula}` : c.base && c.base !== 'self' ? `% ← ${colMap[c.base]?.label || c.base}` : '';
      return `<th title="${esc(hint)}"><span>${esc(c.label)}</span>${c.type === 'formula' ? '<i class="fx-badge">ƒx</i>' : ''}</th>`;
    }).join('') + '</tr></thead><tbody>';

    days.forEach((day, r) => {
      const wd = weekday(day);
      html += `<tr class="vrow" data-day="${day}"><td class="sticky-col date" rowspan="2">` +
        `<button class="date-btn" data-off="${day}" ${isAll ? 'disabled' : ''} title="Dam olish kuni sifatida belgilash">` +
        `<b>${fmtDate(day)}</b><small>${WEEKDAYS[wd]}</small></button></td>`;
      cols.forEach(c => {
        if (c.type === 'formula') html += `<td class="fx" data-v="${day}|${c.key}"></td>`;
        else if (isAll) html += `<td class="ro ${c.type}" data-v="${day}|${c.key}"></td>`;
        else {
          const ci = editCols.indexOf(c);
          html += `<td class="${c.type}"><input class="cell" data-r="${r}" data-c="${ci}" data-day="${day}" data-key="${c.key}" ` +
            `${c.type === 'number' ? 'inputmode="decimal"' : ''} autocomplete="off" spellcheck="false"></td>`;
        }
      });
      html += `</tr><tr class="prow" data-day="${day}">`;
      cols.forEach(c => { html += `<td class="pct" data-p="${day}|${c.key}"></td>`; });
      html += '</tr>';
    });

    html += '</tbody><tfoot><tr class="vrow total"><td class="sticky-col date"><b>Oy jami</b></td>';
    cols.forEach(c => { html += `<td data-v="total|${c.key}"></td>`; });
    html += '</tr><tr class="prow total"><td class="sticky-col date"><small>' + esc(monthLabel(month)) + '</small></td>';
    cols.forEach(c => { html += `<td class="pct" data-p="total|${c.key}"></td>`; });
    html += '</tr></tfoot></table></div></div>';
    if (!isAll) html += '<p class="sheet-hint muted small">↑ ↓ ← → va Enter bilan harakatlaning · Excel/Sheets\'dan bir nechta katakni nusxalab qo\'yish mumkin · Sanani bosib dam olish kuni belgilang</p>';
    body.innerHTML = html;

    refs = { cells: new Map(), pcts: new Map(), rows: new Map(), inputs: new Map() };
    body.querySelectorAll('[data-v]').forEach(el => refs.cells.set(el.dataset.v, el));
    body.querySelectorAll('[data-p]').forEach(el => refs.pcts.set(el.dataset.p, el));
    body.querySelectorAll('tbody tr').forEach(tr => {
      const a = refs.rows.get(tr.dataset.day) || []; a.push(tr); refs.rows.set(tr.dataset.day, a);
    });
    body.querySelectorAll('input.cell').forEach(inp => refs.inputs.set(`${inp.dataset.day}|${inp.dataset.key}`, inp));

    days.forEach(d => refreshDay(d, true));
    refreshTotals();
    bindTable(body.querySelector('table.sheet'));

    // Bugungi kunga aylantirish
    const tr = refs.rows.get(today)?.[0];
    if (tr) {
      const sc = body.querySelector('.sheet-scroll');
      sc.scrollTop = Math.max(0, tr.getBoundingClientRect().top - sc.getBoundingClientRect().top - sc.clientHeight / 3);
    }
  }

  function paintValue(el, c, v) {
    if (c.type === 'text') { el.textContent = v || ''; return; }
    el.textContent = v == null ? '' : fmtNum(v);
    el.classList.toggle('neg', v != null && v < 0);
    el.classList.toggle('pos', c.type === 'formula' && v != null && v > 0);
  }
  function paintPct(el, c, row) {
    if (c.type === 'text' || !c.base) { el.textContent = ''; return; }
    el.textContent = row.hasData ? fmtPct(row.p[c.key]) : '–';
    el.classList.toggle('dim', row.p[c.key] == null);
  }

  function refreshDay(day, initial) {
    const raw = rawOf(day);
    const row = computeRow(cols, raw);
    if (viewMode === 'table' && refs) {
      for (const c of cols) {
        const k = `${day}|${c.key}`;
        const inp = refs.inputs.get(k);
        if (inp) {
          if (document.activeElement !== inp) inp.value = raw[c.key] ?? '';
        } else {
          const el = refs.cells.get(k);
          if (el) paintValue(el, c, row.v[c.key]);
        }
        const p = refs.pcts.get(k);
        if (p) paintPct(p, c, row);
      }
      const off = isOff(day);
      (refs.rows.get(day) || []).forEach(tr => {
        tr.classList.toggle('off', off);
        tr.classList.toggle('today', day === today);
      });
      if (!initial) refreshTotals();
    } else if (viewMode === 'day' && day === curDay) {
      paintDay();
    }
  }

  function totalsRow() {
    return computeRow(cols, aggregateDays(cols, days, rawOf));
  }
  function refreshTotals() {
    if (!refs) return;
    const row = totalsRow();
    for (const c of cols) {
      const el = refs.cells.get(`total|${c.key}`);
      if (el) {
        if (c.type === 'text') {
          const n = days.filter(d => (rawOf(d)[c.key] ?? '') !== '').length;
          el.textContent = n ? `${n} ta yozuv` : '';
        } else paintValue(el, c, row.v[c.key]);
      }
      const p = refs.pcts.get(`total|${c.key}`);
      if (p) paintPct(p, c, row);
    }
  }

  // Klaviatura, nusxa-qo'yish, fokus
  function bindTable(table) {
    const cellAt = (r, c) => table.querySelector(`input.cell[data-r="${r}"][data-c="${c}"]`);
    const go = (inp, dr, dc) => {
      const t = cellAt(+inp.dataset.r + dr, +inp.dataset.c + dc);
      if (t) { t.focus(); t.select(); }
    };

    table.addEventListener('click', e => {
      const b = e.target.closest('[data-off]');
      if (b) toggleOff(b.dataset.off);
    });
    table.addEventListener('focusin', e => {
      const inp = e.target.closest('input.cell'); if (!inp) return;
      inp.dataset.orig = inp.value;
      table.querySelectorAll('.hl').forEach(x => x.classList.remove('hl'));
      inp.closest('tr').classList.add('hl');
      table.querySelectorAll('thead th')[cols.indexOf(colMap[inp.dataset.key]) + 1]?.classList.add('hl');
      setTimeout(() => { if (document.activeElement === inp) inp.select(); }, 0);
    });
    table.addEventListener('focusout', e => {
      const inp = e.target.closest('input.cell'); if (!inp) return;
      table.querySelectorAll('.hl').forEach(x => x.classList.remove('hl'));
    });
    table.addEventListener('change', e => {
      const inp = e.target.closest('input.cell'); if (inp) commit(inp);
    });
    table.addEventListener('keydown', e => {
      const inp = e.target.closest('input.cell'); if (!inp) return;
      const atStart = inp.selectionStart === 0 && inp.selectionEnd === 0;
      const atEnd = inp.selectionStart === inp.value.length && inp.selectionEnd === inp.value.length;
      const all = inp.selectionStart === 0 && inp.selectionEnd === inp.value.length;
      switch (e.key) {
        case 'Enter': e.preventDefault(); commit(inp); go(inp, e.shiftKey ? -1 : 1, 0); break;
        case 'ArrowDown': e.preventDefault(); go(inp, 1, 0); break;
        case 'ArrowUp': e.preventDefault(); go(inp, -1, 0); break;
        case 'ArrowLeft': if (atStart || all) { e.preventDefault(); go(inp, 0, -1); } break;
        case 'ArrowRight': if (atEnd || all) { e.preventDefault(); go(inp, 0, 1); } break;
        case 'Escape': inp.value = inp.dataset.orig ?? ''; inp.classList.remove('bad'); inp.blur(); break;
        case 'Delete': if (all && inp.value) { e.preventDefault(); inp.value = ''; commit(inp); } break;
      }
    });
    table.addEventListener('paste', e => {
      const inp = e.target.closest('input.cell'); if (!inp) return;
      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (!/[\t\n]/.test(text.replace(/\r?\n$/, ''))) return; // bitta qiymat — oddiy qo'yish
      e.preventDefault();
      const rows = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map(l => l.split('\t'));
      const r0 = +inp.dataset.r, c0 = +inp.dataset.c;
      let n = 0;
      rows.forEach((row, i) => row.forEach((val, j) => {
        const t = cellAt(r0 + i, c0 + j);
        if (!t) return;
        t.value = val.trim().replace(/%$/, '');
        commit(t); n++;
      }));
      toast(`${n} ta katak qo'yildi`, 'ok');
    });
  }

  // ---------- Kunlik (mobil) ko'rinish ----------
  let dayRefs = null;
  function renderDay() {
    const idx = days.indexOf(curDay);
    const dateSel = h('select', { class: 'inp day-select', onchange: e => { curDay = e.target.value; renderDay(); } },
      days.map(d => h('option', { value: d, selected: d === curDay }, `${fmtDate(d)} · ${WEEKDAYS[weekday(d)]}`)));
    const offBtn = h('button', { class: 'btn sm off-toggle', disabled: isAll, onclick: () => toggleOff(curDay) });

    const fields = h('div', { class: 'day-fields' });
    dayRefs = { offBtn, card: null, vals: new Map(), pcts: new Map(), inputs: new Map(), sums: new Map() };
    const editable = [];
    cols.forEach(c => {
      let ctl;
      if (c.type === 'formula' || isAll) {
        ctl = h('output', { class: 'f-out' });
        dayRefs.vals.set(c.key, ctl);
      } else {
        ctl = h('input', {
          class: 'inp cell', 'data-day': curDay, 'data-key': c.key, autocomplete: 'off',
          inputmode: c.type === 'number' ? 'decimal' : null, placeholder: c.type === 'number' ? '0' : 'Izoh…',
        });
        dayRefs.inputs.set(c.key, ctl);
        editable.push(ctl);
      }
      const pct = h('span', { class: 'f-pct' });
      dayRefs.pcts.set(c.key, pct);
      fields.append(h('label', { class: `f-row ${c.type}` },
        h('span', { class: 'f-label' }, c.label, c.type === 'formula' ? h('i', { class: 'fx-badge' }, 'ƒx') : null),
        h('span', { class: 'f-ctl' }, ctl, pct)));
    });
    editable.forEach((inp, i) => {
      inp.addEventListener('change', () => commit(inp));
      inp.addEventListener('focus', () => setTimeout(() => { if (document.activeElement === inp) inp.select(); }, 0));
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); commit(inp); (editable[i + 1] || inp).focus(); if (!editable[i + 1]) inp.blur(); }
      });
    });

    const card = h('section', { class: 'panel day-card' },
      h('div', { class: 'day-nav' },
        h('button', { class: 'btn icon ghost', disabled: idx <= 0, onclick: () => { curDay = days[idx - 1]; renderDay(); } }, '‹'),
        dateSel,
        h('button', { class: 'btn icon ghost', disabled: idx >= days.length - 1, onclick: () => { curDay = days[idx + 1]; renderDay(); } }, '›')),
      h('div', { class: 'day-sub' },
        curDay === today ? h('span', { class: 'chip today' }, 'Bugun') : null, offBtn),
      fields);
    dayRefs.card = card;

    const sumKeys = cols.filter(c => c.type !== 'text');
    const summary = h('section', { class: 'panel day-summary' },
      h('h3', {}, `${monthLabel(month)} — jami`),
      h('dl', { class: 'stats' }, sumKeys.map(c => {
        const dd = h('dd');
        dayRefs.sums.set(c.key, dd);
        return h('div', { class: 'stat' }, h('dt', {}, c.label), dd);
      })));

    body.innerHTML = '';
    body.append(card, summary);
    paintDay();
  }

  function paintDay() {
    if (!dayRefs) return;
    const raw = rawOf(curDay);
    const row = computeRow(cols, raw);
    const off = isOff(curDay);
    dayRefs.card.classList.toggle('off', off);
    dayRefs.offBtn.textContent = off ? 'Dam olish kuni' : 'Ish kuni';
    for (const c of cols) {
      const inp = dayRefs.inputs.get(c.key);
      if (inp && document.activeElement !== inp) inp.value = raw[c.key] ?? '';
      const out = dayRefs.vals.get(c.key);
      if (out) paintValue(out, c, row.v[c.key]);
      const p = dayRefs.pcts.get(c.key);
      if (p) paintPct(p, c, row);
    }
    const tot = totalsRow();
    for (const [k, dd] of dayRefs.sums) {
      const v = tot.v[k];
      dd.textContent = v == null ? '–' : fmtNum(v);
      dd.classList.toggle('neg', v != null && v < 0);
    }
  }

  // ---------- Ko'rinishni almashtirish ----------
  function setView(m) {
    viewMode = m;
    try { localStorage.setItem('hisobot_view', m); } catch {}
    viewBtns.table.classList.toggle('on', m === 'table');
    viewBtns.day.classList.toggle('on', m === 'day');
    refs = null; dayRefs = null;
    if (m === 'table') renderTable(); else renderDay();
  }
  setView(viewMode);

  function refreshAll() {
    if (viewMode === 'table') { days.forEach(d => refreshDay(d, true)); refreshTotals(); }
    else paintDay();
  }

  // ---------- CSV eksport ----------
  function exportCSV() {
    const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const lines = [['Sana', ...cols.map(c => c.label)].map(q).join(';')];
    const line = (label, row) => {
      lines.push([label, ...cols.map(c => c.type === 'text' ? row.v[c.key] : fmtNum(row.v[c.key]))].map(q).join(';'));
      lines.push(['', ...cols.map(c => (c.type !== 'text' && c.base && row.hasData) ? fmtPct(row.p[c.key]) : '')].map(q).join(';'));
    };
    days.forEach(d => line(fmtDate(d) + (isOff(d) ? ' (dam)' : ''), computeRow(cols, rawOf(d))));
    line('Oy jami', totalsRow());
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `${isAll ? center.name : branch.name} — ${month}.csv` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- Jonli yangilanish ----------
  const unsub = DB.subscribe(async p => {
    if (p.reload) { await loadCells(); refreshAll(); return; }
    const row = (p.new && p.new.branch_id) ? p.new : p.old;
    if (!row || !ids.includes(row.branch_id) || row.day < days[0] || row.day > days[days.length - 1]) return;
    const r = (store[cellKey(row.branch_id, row.day)] ??= {});
    if (p.eventType === 'DELETE') delete r[row.col_key]; else r[row.col_key] = p.new.value;
    refreshDay(row.day);
  });

  const beforeUnload = e => { if (pending) { e.preventDefault(); e.returnValue = ''; } };
  addEventListener('beforeunload', beforeUnload);

  return () => { unsub(); removeEventListener('beforeunload', beforeUnload); };
}
