// Ma'lumotlar qatlami: Supabase yoki lokal (localStorage) — bir xil API.
(function () {
  const cfg = window.APP_CONFIG || {};

  const uid = () =>
    (crypto.randomUUID ? crypto.randomUUID() :
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 3) | 8).toString(16);
      }));
  const now = () => new Date().toISOString();
  const clone = x => JSON.parse(JSON.stringify(x));
  const byOrder = (a, b) => (a.sort - b.sort) || String(a.created_at).localeCompare(String(b.created_at));

  // ---------------- Supabase ----------------
  function makeSupabase() {
    const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    const q = async p => {
      const { data, error } = await p;
      if (error) throw new Error(error.message);
      return data;
    };

    return {
      mode: 'supabase',

      async listCenters() {
        const rows = await q(sb.from('centers').select('*, branches(count)').order('created_at'));
        return rows.map(({ branches, ...c }) => ({ ...c, branch_count: branches?.[0]?.count ?? 0 }));
      },
      getCenter: id => q(sb.from('centers').select('*').eq('id', id).single()),
      createCenter: row => q(sb.from('centers').insert(row).select().single()),
      updateCenter: (id, patch) => q(sb.from('centers').update(patch).eq('id', id).select().single()),
      deleteCenter: id => q(sb.from('centers').delete().eq('id', id)),

      listBranches: cid => q(sb.from('branches').select('*').eq('center_id', cid)
        .order('sort').order('created_at')),
      createBranch: row => q(sb.from('branches').insert(row).select().single()),
      updateBranch: (id, patch) => q(sb.from('branches').update(patch).eq('id', id).select().single()),
      deleteBranch: id => q(sb.from('branches').delete().eq('id', id)),

      async getCells(ids, from, to) {
        if (!ids.length) return [];
        const out = [];
        const PAGE = 1000;
        for (let i = 0; ; i += PAGE) {
          const rows = await q(sb.from('report_cells')
            .select('branch_id,day,col_key,value')
            .in('branch_id', ids).gte('day', from).lte('day', to)
            .order('day').order('branch_id').order('col_key')
            .range(i, i + PAGE - 1));
          out.push(...rows);
          if (rows.length < PAGE) break;
        }
        return out;
      },
      async setCell(branch_id, day, col_key, value) {
        if (value === '' || value == null) {
          await q(sb.from('report_cells').delete().match({ branch_id, day, col_key }));
        } else {
          await q(sb.from('report_cells').upsert(
            { branch_id, day, col_key, value: String(value), updated_at: now() },
            { onConflict: 'branch_id,day,col_key' }));
        }
      },
      subscribe(cb) {
        const ch = sb.channel('cells-' + uid())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'report_cells' }, p => cb(p))
          .subscribe();
        return () => sb.removeChannel(ch);
      },
    };
  }

  // ---------------- Lokal (brauzer) ----------------
  function makeLocal() {
    const KEY = 'hisobot_db_v1';
    const empty = () => ({ centers: [], branches: [], cells: {} });
    const load = () => {
      try { return JSON.parse(localStorage.getItem(KEY)) || empty(); } catch { return empty(); }
    };
    const save = d => localStorage.setItem(KEY, JSON.stringify(d));
    const find = (list, id, what) => {
      const x = list.find(r => r.id === id);
      if (!x) throw new Error(what + ' topilmadi');
      return x;
    };
    const dropCells = (d, bids) => {
      for (const k of Object.keys(d.cells)) if (bids.includes(k.split('|')[0])) delete d.cells[k];
    };

    return {
      mode: 'local',

      async listCenters() {
        const d = load();
        return d.centers.map(c => ({ ...c, branch_count: d.branches.filter(b => b.center_id === c.id).length }));
      },
      async getCenter(id) { return clone(find(load().centers, id, 'Markaz')); },
      async createCenter(row) {
        const d = load();
        const c = { id: uid(), columns: null, created_at: now(), ...row };
        d.centers.push(c); save(d); return clone(c);
      },
      async updateCenter(id, patch) {
        const d = load(); const c = find(d.centers, id, 'Markaz');
        Object.assign(c, patch); save(d); return clone(c);
      },
      async deleteCenter(id) {
        const d = load();
        dropCells(d, d.branches.filter(b => b.center_id === id).map(b => b.id));
        d.centers = d.centers.filter(c => c.id !== id);
        d.branches = d.branches.filter(b => b.center_id !== id);
        save(d);
      },

      async listBranches(cid) {
        return clone(load().branches.filter(b => b.center_id === cid).sort(byOrder));
      },
      async createBranch(row) {
        const d = load();
        const b = { id: uid(), sort: 0, created_at: now(), manager: null, phone: null, ...row };
        d.branches.push(b); save(d); return clone(b);
      },
      async updateBranch(id, patch) {
        const d = load(); const b = find(d.branches, id, 'Filial');
        Object.assign(b, patch); save(d); return clone(b);
      },
      async deleteBranch(id) {
        const d = load();
        dropCells(d, [id]);
        d.branches = d.branches.filter(b => b.id !== id);
        save(d);
      },

      async getCells(ids, from, to) {
        const out = [];
        for (const [k, value] of Object.entries(load().cells)) {
          const [branch_id, day, col_key] = k.split('|');
          if (ids.includes(branch_id) && day >= from && day <= to) out.push({ branch_id, day, col_key, value });
        }
        return out;
      },
      async setCell(branch_id, day, col_key, value) {
        const d = load();
        const k = `${branch_id}|${day}|${col_key}`;
        if (value === '' || value == null) delete d.cells[k]; else d.cells[k] = String(value);
        save(d);
      },
      // Boshqa vkladkada o'zgarsa — qayta yuklash
      subscribe(cb) {
        const f = e => { if (e.key === KEY) cb({ reload: true }); };
        addEventListener('storage', f);
        return () => removeEventListener('storage', f);
      },
    };
  }

  const useSupabase = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  window.DB = useSupabase ? makeSupabase() : makeLocal();
})();
