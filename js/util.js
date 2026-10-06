// Umumiy yordamchilar: DOM, sana, format, dialog, toast, ustun hisob-kitobi.

// ---------- DOM ----------
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  kids.flat(Infinity).forEach(k => {
    if (k == null || k === false) return;
    el.append(k.nodeType ? k : document.createTextNode(String(k)));
  });
  return el;
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Sana ----------
const pad = n => String(n).padStart(2, '0');
const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
const WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const WD_SHORT = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const curMonth = () => todayISO().slice(0, 7);
function monthDays(m) {
  const [y, mo] = m.split('-').map(Number);
  const n = new Date(y, mo, 0).getDate();
  return Array.from({ length: n }, (_, i) => `${m}-${pad(i + 1)}`);
}
function addMonth(m, delta) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function weekday(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}
function fmtDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
// Oy kunlarini haftalarga bo'lish (dushanba — yakshanba, oy chegarasida kesiladi)
function monthWeeks(days) {
  const weeks = [];
  let cur = null;
  for (const d of days) {
    if (!cur || weekday(d) === 1) { cur = { days: [] }; weeks.push(cur); }
    cur.days.push(d);
  }
  return weeks;
}
const monthLabel = m => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const isMonth = m => /^\d{4}-(0[1-9]|1[0-2])$/.test(m || '');

// ---------- Format ----------
function num(v) {
  if (v == null || v === '') return null;
  const s = String(v).replace(/\s/g, '').replace(',', '.');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function fmtNum(n) {
  if (n == null) return '';
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2).replace('.', ',');
}
const fmtPct = r => (r == null ? '–' : (r * 100).toFixed(2).replace('.', ',') + '%');

// ---------- Toast ----------
function toast(msg, kind = '') {
  let box = document.getElementById('toasts');
  if (!box) { box = h('div', { id: 'toasts' }); document.body.append(box); }
  const t = h('div', { class: 'toast ' + kind },
    kind === 'ok' ? icon('check', 16) : kind === 'err' ? icon('alert', 16) : null, h('span', {}, msg));
  box.append(t);
  setTimeout(() => t.classList.add('hide'), 2600);
  setTimeout(() => t.remove(), 3000);
}

// ---------- Dialoglar ----------
function openDialog(build) {
  return new Promise(resolve => {
    const dlg = h('dialog', { class: 'dlg' });
    const done = v => { dlg.close(); dlg.remove(); resolve(v); };
    dlg.append(build(done));
    dlg.addEventListener('cancel', e => { e.preventDefault(); done(null); });
    dlg.addEventListener('click', e => { if (e.target === dlg) done(null); });
    document.body.append(dlg);
    dlg.showModal();
    const first = dlg.querySelector('input,select,textarea');
    if (first) setTimeout(() => first.focus(), 30);
  });
}

// fields: [{name, label, value, placeholder, required, type}]
function formDialog({ title, fields, submitText = 'Saqlash' }) {
  return openDialog(done => {
    const inputs = {};
    const form = h('form', { class: 'dlg-body', method: 'dialog' },
      h('h3', { class: 'dlg-title' }, title),
      fields.map(f => h('label', { class: 'field' },
        h('span', {}, f.label, f.required ? h('b', { class: 'req' }, ' *') : null),
        inputs[f.name] = h('input', {
          class: 'inp', type: f.type || 'text', value: f.value ?? '',
          placeholder: f.placeholder || '', required: !!f.required, autocomplete: 'off',
        }))),
      h('div', { class: 'dlg-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => done(null) }, 'Bekor qilish'),
        h('button', { type: 'submit', class: 'btn primary' }, submitText)));
    form.addEventListener('submit', e => {
      e.preventDefault();
      const out = {};
      for (const [k, el] of Object.entries(inputs)) out[k] = el.value.trim();
      done(out);
    });
    return form;
  });
}

function confirmDialog(text, { okText = "O'chirish", danger = true } = {}) {
  return openDialog(done => h('div', { class: 'dlg-body' },
    h('h3', { class: 'dlg-title' }, 'Tasdiqlang'),
    h('p', { class: 'dlg-text' }, text),
    h('div', { class: 'dlg-actions' },
      h('button', { class: 'btn', onclick: () => done(false) }, 'Bekor qilish'),
      h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => done(true) }, okText))))
    .then(Boolean);
}

// ---------- Ustunlar va hisob-kitob ----------
// type:  number | text | formula
// base:  foiz qaysi ustunga nisbatan ('self' = qiymat bo'lsa 100%)
// agg:   oy jami: sum | last | avg
const DEFAULT_COLUMNS = [
  { key: 'students',    label: "O'quvchilar soni",       type: 'number', base: 'self',      agg: 'last' },
  { key: 'leads',       label: 'Tushgan lidlar',         type: 'number', base: 'self' },
  { key: 'quality',     label: 'Sifatli lid',            type: 'number', base: 'leads' },
  { key: 'bd_signed',   label: 'B.D yozilganlar',        type: 'number', base: 'quality' },
  { key: 'bd_came',     label: 'B.D kelganlar',          type: 'number', base: 'bd_signed' },
  { key: 'bd_came_cc',  label: 'B.D keldi call center',  type: 'number', base: 'bd_came' },
  { key: 'contract',    label: 'Shartnoma',              type: 'number', base: 'bd_came' },
  { key: 'contract_cc', label: 'Shartnoma (call center)', type: 'number', base: 'contract' },
  { key: 'left',        label: 'Ketganlar',              type: 'number', base: 'students' },
  { key: 'frozen',      label: 'Muzlatilganlar',         type: 'number', base: 'students' },
  { key: 'returned',    label: 'Qaytganlar',             type: 'number', base: 'students' },
  { key: 'videos',      label: 'Haftalik videolar',      type: 'text' },
  { key: 'missed',      label: 'Qoldirilgan darslar',    type: 'number', base: 'students' },
  { key: 'growth',      label: "O'sish hajmi",           type: 'formula', formula: 'contract + returned - left - frozen' },
  { key: 'tg',          label: 'TG guruhlar nazorati',   type: 'text' },
  { key: 'taxi',        label: 'Taksi nazorati',         type: 'text' },
];

const allCols = center => (Array.isArray(center?.columns) && center.columns.length ? center.columns : DEFAULT_COLUMNS);
const visibleCols = center => allCols(center).filter(c => !c.hidden);

function evalFormula(expr, vals) {
  const s = String(expr || '').replace(/[a-z_][a-z0-9_]*/gi, k => `(${vals[k] ?? 0})`);
  if (!/^[\d\s+\-*/().e]*$/i.test(s) || !s.trim()) return null;
  try {
    const r = Function(`"use strict";return (${s});`)();
    return Number.isFinite(r) ? Math.round(r * 100) / 100 : null;
  } catch { return null; }
}

// Bitta qator (kun yoki jami) uchun: qiymatlar va foizlar
function computeRow(cols, raw) {
  const v = {};
  for (const c of cols) {
    if (c.type === 'text') v[c.key] = raw[c.key] ?? '';
    else if (c.type === 'number') v[c.key] = typeof raw[c.key] === 'number' ? raw[c.key] : num(raw[c.key]);
  }
  const hasData = cols.some(c => c.type === 'number' && v[c.key] != null);
  for (const c of cols) if (c.type === 'formula') v[c.key] = hasData ? evalFormula(c.formula, v) : null;

  const p = {};
  for (const c of cols) {
    if (c.type === 'text' || !c.base) continue;
    const x = v[c.key];
    if (x == null) { p[c.key] = null; continue; }
    if (c.base === 'self') { p[c.key] = 1; continue; }
    const b = v[c.base];
    p[c.key] = b ? x / b : null;
  }
  return { v, p, hasData };
}

// Bir necha kunni yig'ish (oy jami)
function aggregateDays(cols, days, getRaw) {
  const out = {};
  for (const c of cols) {
    if (c.type !== 'number') continue;
    const vals = days.map(d => num(getRaw(d)[c.key])).filter(x => x != null);
    if (!vals.length) { out[c.key] = null; continue; }
    if (c.agg === 'last') out[c.key] = vals[vals.length - 1];
    else if (c.agg === 'avg') out[c.key] = vals.reduce((a, b) => a + b, 0) / vals.length;
    else out[c.key] = vals.reduce((a, b) => a + b, 0);
  }
  return out;
}

// Bir necha filialning bir kunini yig'ish (umumiy hisobot)
function sumRaws(cols, raws) {
  const out = {};
  for (const c of cols) {
    if (c.type === 'number') {
      const vals = raws.map(r => num(r[c.key])).filter(x => x != null);
      out[c.key] = vals.length ? vals.reduce((a, b) => a + b, 0) : null;
    } else if (c.type === 'text') {
      const n = raws.filter(r => (r[c.key] ?? '') !== '').length;
      out[c.key] = n ? `${n} ta filial` : '';
    }
  }
  return out;
}

function slugKey(label, existing) {
  const map = { "o'": 'o', "g'": 'g', 'ʻ': '', "'": '', 'sh': 'sh', 'ch': 'ch' };
  let base = String(label).toLowerCase()
    .replace(/o'|g'|ʻ|'/g, m => map[m] ?? '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'col';
  if (/^\d/.test(base)) base = 'c_' + base;
  let k = base, i = 2;
  while (existing.includes(k)) k = `${base}_${i++}`;
  return k;
}
