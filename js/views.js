// Sahifalar: boshlang'ich sozlash, sozlamalar (markaz, filiallar, ustunlar) va header.

const app = () => document.getElementById('app');
function mount(...nodes) { const a = app(); a.innerHTML = ''; a.append(...nodes); }

// ---------- Oxirgi ko'rilgan markaz / filial ----------
const LS = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
function rememberView(centerId, view) {
  LS.set('hisobot_center', centerId);
  LS.set('hisobot_last_' + centerId, view);
}
const hashMonth = () => new URLSearchParams(location.hash.split('?')[1] || '').get('m');

// ---------- Header: markaz nomi, filial tablari, sozlamalar ----------
function setHeader(center, branches, active) {
  document.getElementById('center-name').textContent = center ? center.name : 'Hisobot';
  const settings = document.getElementById('settings-link');
  settings.hidden = !center;
  if (center) {
    settings.href = `#/c/${center.id}/settings`;
    settings.classList.toggle('on', active === 'settings');
  }

  const tabs = document.getElementById('tabs');
  tabs.innerHTML = '';
  if (!center || !branches?.length) return;
  const m = hashMonth();
  const q = m ? `?m=${m}` : '';
  const tab = (href, label, on) => h('a', { class: 'tab' + (on ? ' on' : ''), href }, label);
  tabs.append(
    tab(`#/c/${center.id}/all${q}`, 'Barchasi', active === 'all'),
    ...branches.map(b => tab(`#/c/${center.id}/b/${b.id}${q}`, b.name, active === b.id)));
  tabs.querySelector('.tab.on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
}

function steps(active) {
  const s = ['Markaz', 'Filiallar', 'Hisobot'];
  return h('ol', { class: 'steps' }, s.map((t, i) =>
    h('li', { class: i < active ? 'done' : i === active ? 'active' : '' },
      h('span', { class: 'dot' }, i < active ? '✓' : i + 1), h('span', {}, t))));
}

// =============== Kirish: kerakli sahifaga yo'naltirish ===============
async function viewIndex() {
  const centers = await DB.listCenters();
  if (!centers.length) return viewOnboardCenter();
  const saved = LS.get('hisobot_center');
  const center = centers.find(c => c.id === saved) || centers[0];
  const branches = await DB.listBranches(center.id);
  if (!branches.length) return location.replace(`#/c/${center.id}/setup`);
  const last = LS.get('hisobot_last_' + center.id);
  const view = last === 'all' || branches.some(b => b.id === last) ? last : branches[0].id;
  location.replace(view === 'all' ? `#/c/${center.id}/all` : `#/c/${center.id}/b/${view}`);
}

// =============== 1-qadam: markaz ===============
function viewOnboardCenter() {
  setHeader(null);
  const name = h('input', { class: 'inp lg', placeholder: 'Masalan: Math Academy', required: true });
  const form = h('form', { class: 'stack' },
    h('label', { class: 'field' }, h('span', {}, 'Markaz nomi'), name),
    h('button', { class: 'btn primary lg', type: 'submit' }, 'Davom etish'));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!name.value.trim()) return;
    const c = await DB.createCenter({ name: name.value.trim() });
    LS.set('hisobot_center', c.id);
    location.hash = `#/c/${c.id}/setup`;
  });
  mount(h('section', { class: 'onboard' }, steps(0),
    h('h1', {}, 'Markaz yarating'),
    h('p', { class: 'muted' }, "O'quv markazingiz nomini kiriting. Keyingi qadamda filiallarni qo'shasiz."),
    form));
  setTimeout(() => name.focus(), 50);
}

// =============== 2-qadam: filiallar ===============
async function viewOnboardBranches(centerId) {
  const center = await DB.getCenter(centerId);
  setHeader(center, [], null);
  let branches = await DB.listBranches(centerId);

  const list = h('ul', { class: 'mini-list' });
  const next = h('a', { class: 'btn primary lg' }, 'Hisobotni boshlash →');
  const draw = () => {
    list.innerHTML = '';
    branches.forEach(b => list.append(h('li', {},
      h('span', {}, b.name),
      h('button', { class: 'btn icon ghost sm', title: "O'chirish", onclick: async () => {
        await DB.deleteBranch(b.id);
        branches = branches.filter(x => x.id !== b.id); draw();
      } }, '✕'))));
    list.hidden = !branches.length;
    next.classList.toggle('disabled', !branches.length);
    next.href = branches.length ? `#/c/${centerId}/b/${branches[0].id}` : 'javascript:void 0';
  };

  const name = h('input', { class: 'inp lg', placeholder: 'Masalan: Chilonzor filiali' });
  const form = h('form', { class: 'row' }, name, h('button', { class: 'btn lg', type: 'submit' }, "Qo'shish"));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const v = name.value.trim();
    if (!v) return;
    branches.push(await DB.createBranch({ center_id: centerId, name: v, sort: branches.length }));
    name.value = ''; name.focus(); draw();
  });

  mount(h('section', { class: 'onboard' }, steps(1),
    h('h1', {}, "Filiallarni qo'shing"),
    h('p', { class: 'muted' }, `${center.name} markazining filiallari. Keyinchalik ularni Sozlamalar bo'limida o'zgartirish mumkin.`),
    form, list, next));
  draw();
  setTimeout(() => name.focus(), 50);
}

// =============== Sozlamalar ===============
async function viewSettings(centerId, tab = 'branches') {
  const [center, branches, centers] = await Promise.all([DB.getCenter(centerId), DB.listBranches(centerId), DB.listCenters()]);
  LS.set('hisobot_center', centerId);
  setHeader(center, branches, 'settings');

  const TABS = { branches: 'Filiallar', columns: 'Ustunlar', center: 'Markaz' };
  if (!TABS[tab]) tab = 'branches';
  const nav = h('nav', { class: 'side-nav' }, Object.entries(TABS).map(([k, t]) =>
    h('a', { class: 'side-link' + (k === tab ? ' on' : ''), href: `#/c/${centerId}/settings/${k}` }, t)));

  const content = tab === 'branches' ? settingsBranches(center, branches)
    : tab === 'columns' ? settingsColumns(center)
    : settingsCenter(center, centers);

  mount(h('div', { class: 'settings' },
    h('div', { class: 'settings-head' }, h('h1', {}, 'Sozlamalar'), h('p', { class: 'muted small' }, center.name)),
    nav, h('div', { class: 'settings-body' }, content)));
}

function branchDialog(b = {}) {
  return formDialog({
    title: b.id ? 'Filialni tahrirlash' : 'Yangi filial',
    fields: [
      { name: 'name', label: 'Filial nomi', value: b.name, placeholder: 'Masalan: Chilonzor filiali', required: true },
      { name: 'manager', label: "Mas'ul shaxs", value: b.manager, placeholder: 'Ism familiya' },
      { name: 'phone', label: 'Telefon', value: b.phone, placeholder: '+998 90 123 45 67', type: 'tel' },
    ],
    submitText: b.id ? 'Saqlash' : "Qo'shish",
  });
}

function settingsBranches(center, branches) {
  const id = center.id;
  const add = async () => {
    const v = await branchDialog();
    if (!v?.name) return;
    await DB.createBranch({ center_id: id, name: v.name, manager: v.manager || null, phone: v.phone || null, sort: branches.length });
    toast("Filial qo'shildi", 'ok'); route();
  };
  const move = async (i, d) => {
    const j = i + d;
    [branches[i], branches[j]] = [branches[j], branches[i]];
    await Promise.all(branches.map((b, k) => b.sort !== k ? DB.updateBranch(b.id, { sort: k }) : null));
    route();
  };

  return h('section', { class: 'panel' },
    h('div', { class: 'panel-head' },
      h('h2', {}, 'Filiallar', h('span', { class: 'count' }, branches.length)),
      h('button', { class: 'btn primary', onclick: add }, "+ Filial qo'shish")),
    branches.length ? h('ul', { class: 'rows' }, branches.map((b, i) => h('li', { class: 'row-item' },
      h('div', { class: 'row-main' },
        h('a', { class: 'row-title', href: `#/c/${id}/b/${b.id}` }, b.name),
        h('span', { class: 'muted small' }, [b.manager, b.phone].filter(Boolean).join(' · ') || '—')),
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn icon ghost', title: 'Yuqoriga', disabled: i === 0, onclick: () => move(i, -1) }, '↑'),
        h('button', { class: 'btn icon ghost', title: 'Pastga', disabled: i === branches.length - 1, onclick: () => move(i, 1) }, '↓'),
        h('button', { class: 'btn sm', onclick: async () => {
          const v = await branchDialog(b);
          if (!v?.name) return;
          await DB.updateBranch(b.id, { name: v.name, manager: v.manager || null, phone: v.phone || null }); route();
        } }, 'Tahrirlash'),
        h('button', { class: 'btn sm danger-ghost', onclick: async () => {
          if (!await confirmDialog(`"${b.name}" filiali va uning barcha hisobotlari o'chiriladi.`)) return;
          await DB.deleteBranch(b.id); toast("O'chirildi"); route();
        } }, "O'chirish")))))
      : h('p', { class: 'muted empty-line' }, "Hali filial yo'q."));
}

function settingsCenter(center, centers) {
  const name = h('input', { class: 'inp', value: center.name });
  const form = h('form', { class: 'row' }, name, h('button', { class: 'btn primary', type: 'submit' }, 'Saqlash'));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!name.value.trim()) return;
    await DB.updateCenter(center.id, { name: name.value.trim() });
    toast('Saqlandi', 'ok'); route();
  });

  const newCenter = async () => {
    const v = await formDialog({ title: 'Yangi markaz', fields: [{ name: 'name', label: 'Markaz nomi', required: true }], submitText: 'Yaratish' });
    if (!v?.name) return;
    const c = await DB.createCenter({ name: v.name });
    LS.set('hisobot_center', c.id);
    location.hash = `#/c/${c.id}/setup`;
  };

  return h('div', { class: 'stack' },
    h('section', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h2', {}, 'Markaz nomi')),
      form),
    h('section', { class: 'panel' },
      h('div', { class: 'panel-head' },
        h('h2', {}, 'Markazlar', h('span', { class: 'count' }, centers.length)),
        h('button', { class: 'btn', onclick: newCenter }, '+ Yangi markaz')),
      h('ul', { class: 'rows' }, centers.map(c => h('li', { class: 'row-item' },
        h('div', { class: 'row-main' },
          h('span', { class: 'row-title' }, c.name),
          h('span', { class: 'muted small' }, `${c.branch_count} ta filial`)),
        h('div', { class: 'row-actions' },
          c.id === center.id
            ? h('span', { class: 'badge' }, 'Joriy')
            : h('button', { class: 'btn sm', onclick: () => { LS.set('hisobot_center', c.id); location.hash = '#/'; } }, "O'tish")))))),
    h('section', { class: 'panel danger-zone' },
      h('div', { class: 'panel-head' },
        h('div', {}, h('h2', {}, "Markazni o'chirish"),
          h('p', { class: 'muted small' }, "Barcha filiallar va hisobotlar ham o'chiriladi. Qaytarib bo'lmaydi.")),
        h('button', { class: 'btn danger', onclick: async () => {
          if (!await confirmDialog(`"${center.name}" markazi, uning barcha filiallari va hisobotlari o'chiriladi.`)) return;
          await DB.deleteCenter(center.id);
          LS.del('hisobot_center');
          toast("O'chirildi"); location.hash = '#/';
        } }, "O'chirish"))));
}

function settingsColumns(center) {
  const id = center.id;
  let cols = JSON.parse(JSON.stringify(allCols(center)));
  const list = h('div', { class: 'col-list' });
  const TYPES = { number: 'Raqam', text: 'Matn', formula: 'Formula' };
  const AGGS = { sum: "Yig'indi", last: 'Oxirgi qiymat', avg: "O'rtacha" };

  function sel(options, value, onchange) {
    const s = h('select', { class: 'inp', onchange: e => onchange(e.target.value) });
    for (const [v, t] of options) s.append(h('option', { value: v, selected: v === (value ?? '') }, t));
    return s;
  }

  function draw() {
    list.innerHTML = '';
    cols.forEach((c, i) => {
      const bases = [['', 'Foizsiz'], ['self', "100% (o'zi)"],
        ...cols.filter(o => o.key !== c.key && o.type !== 'text').map(o => [o.key, `% ← ${o.label}`])];
      list.append(h('div', { class: 'col-row' + (c.hidden ? ' is-hidden' : '') },
        h('div', { class: 'col-order' },
          h('button', { class: 'btn icon ghost sm', disabled: i === 0, onclick: () => { [cols[i - 1], cols[i]] = [cols[i], cols[i - 1]]; draw(); } }, '↑'),
          h('button', { class: 'btn icon ghost sm', disabled: i === cols.length - 1, onclick: () => { [cols[i + 1], cols[i]] = [cols[i], cols[i + 1]]; draw(); } }, '↓')),
        h('label', { class: 'field grow' }, h('span', {}, 'Nomi ', h('code', {}, c.key)),
          h('input', { class: 'inp', value: c.label, oninput: e => (c.label = e.target.value) })),
        h('label', { class: 'field' }, h('span', {}, 'Turi'),
          sel(Object.entries(TYPES), c.type, v => { c.type = v; if (v === 'text') delete c.base; draw(); })),
        c.type === 'formula'
          ? h('label', { class: 'field grow' }, h('span', {}, 'Formula'),
              h('input', { class: 'inp mono', value: c.formula || '', placeholder: 'contract + returned - left',
                oninput: e => (c.formula = e.target.value) }))
          : null,
        c.type !== 'text'
          ? h('label', { class: 'field' }, h('span', {}, 'Foiz'), sel(bases, c.base, v => (v ? (c.base = v) : delete c.base)))
          : null,
        c.type === 'number'
          ? h('label', { class: 'field' }, h('span', {}, 'Oy jami'), sel(Object.entries(AGGS), c.agg || 'sum', v => (c.agg = v)))
          : null,
        h('div', { class: 'col-flags' },
          h('label', { class: 'check' },
            h('input', { type: 'checkbox', checked: !c.hidden, onchange: e => { c.hidden = !e.target.checked; draw(); } }), "Ko'rinadi"),
          h('button', { class: 'btn icon ghost sm', title: "O'chirish", onclick: async () => {
            if (!await confirmDialog(`"${c.label}" ustuni o'chiriladi. Kiritilgan ma'lumotlar bazada qoladi, lekin ko'rinmaydi.`)) return;
            cols.splice(i, 1); draw();
          } }, '✕'))));
    });
  }
  draw();

  return h('section', { class: 'panel' },
    h('div', { class: 'panel-head' },
      h('h2', {}, 'Jadval ustunlari'),
      h('div', { class: 'toolbar' },
        h('button', { class: 'btn', onclick: async () => {
          const v = await formDialog({ title: 'Yangi ustun', fields: [{ name: 'label', label: 'Ustun nomi', required: true }], submitText: "Qo'shish" });
          if (!v?.label) return;
          cols.push({ key: slugKey(v.label, cols.map(c => c.key)), label: v.label, type: 'number' });
          draw();
        } }, '+ Ustun'),
        h('button', { class: 'btn', onclick: async () => {
          if (!await confirmDialog('Ustunlar standart holatga qaytariladi.', { okText: 'Qaytarish', danger: false })) return;
          cols = JSON.parse(JSON.stringify(DEFAULT_COLUMNS)); draw();
        } }, 'Standart'),
        h('button', { class: 'btn primary', onclick: async () => {
          if (cols.some(c => !c.label.trim())) return toast("Ustun nomi bo'sh bo'lmasin", 'err');
          await DB.updateCenter(id, { columns: cols });
          toast('Saqlandi', 'ok');
        } }, 'Saqlash'))),
    h('p', { class: 'muted small hint' },
      'Formulada ustun kalitlaridan foydalaning: ',
      h('code', {}, cols.filter(c => c.type !== 'text').map(c => c.key).join(', '))),
    list);
}
