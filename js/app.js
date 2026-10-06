// Marshrutlash (hash router)
//  #/                        → oxirgi ko'rilgan hisobotga yo'naltirish (yoki boshlang'ich sozlash)
//  #/c/:id/setup             → filiallarni qo'shish (2-qadam)
//  #/c/:id/b/:bid?m=...      → filial hisoboti
//  #/c/:id/all?m=...         → barcha filiallar
//  #/c/:id/settings/:tab     → sozlamalar (branches | columns | center)

let cleanup = null;

async function route() {
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  const m = new URLSearchParams(qs || '').get('m') || curMonth();

  mount(h('div', { class: 'loading' }, h('span', { class: 'spinner' }), 'Yuklanmoqda…'));
  try {
    if (!parts.length) await viewIndex();
    else if (parts[0] === 'c' && parts.length === 2) location.replace(`#/c/${parts[1]}/settings`);
    else if (parts[0] === 'c' && parts[2] === 'setup') await viewOnboardBranches(parts[1]);
    else if (parts[0] === 'c' && parts[2] === 'settings') await viewSettings(parts[1], parts[3]);
    else if (parts[0] === 'c' && parts[2] === 'b' && parts[3]) cleanup = await viewSheet(parts[1], parts[3], m);
    else if (parts[0] === 'c' && parts[2] === 'all') cleanup = await viewSheet(parts[1], 'all', m);
    else location.hash = '#/';
  } catch (e) {
    console.error(e);
    mount(h('section', { class: 'panel empty' },
      h('div', { class: 'err-ico' }, icon('alert', 28)),
      h('h2', {}, 'Xatolik'),
      h('p', { class: 'muted' }, e.message || String(e)),
      h('a', { class: 'btn primary', href: '#/' }, 'Bosh sahifa')));
  }
  window.scrollTo(0, 0);
}

(function init() {
  document.querySelector('.brand-mark').replaceChildren(icon('logo', 17));
  document.getElementById('settings-link').prepend(icon('settings', 19));
  const themeBtn = document.getElementById('theme-toggle');
  themeBtn.addEventListener('click', toggleTheme);
  applyTheme(currentTheme());

  const pill = document.getElementById('db-mode');
  pill.replaceChildren(icon(DB.mode === 'supabase' ? 'cloud' : 'hardDrive', 13), h('span', {}));
  const pillText = pill.lastChild;
  if (DB.mode === 'supabase') {
    pillText.textContent = 'Supabase';
    pill.classList.add('on');
    pill.title = "Ma'lumotlar Supabase bazasida saqlanadi";
  } else {
    pillText.textContent = 'Lokal';
    pill.classList.add('local');
    pill.title = "Supabase ulanmagan — ma'lumotlar faqat shu brauzerda saqlanadi. js/config.js faylini to'ldiring.";
  }
  addEventListener('hashchange', route);
  route();
})();
