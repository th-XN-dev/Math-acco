-- =============================================================
--  Hisobot tizimi — Supabase sxemasi
--  Supabase → SQL Editor ga to'liq nusxalab, "Run" bosing.
-- =============================================================

create extension if not exists pgcrypto;

-- Markazlar (o'quv markazi). columns — jadval ustunlari sozlamasi (jsonb)
create table if not exists public.centers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  columns     jsonb,
  created_at  timestamptz not null default now()
);

-- Filiallar
create table if not exists public.branches (
  id          uuid primary key default gen_random_uuid(),
  center_id   uuid not null references public.centers(id) on delete cascade,
  name        text not null,
  manager     text,
  phone       text,
  sort        int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists branches_center_idx on public.branches(center_id);

-- Hisobot kataklari: har bir filial × kun × ustun = bitta qiymat
-- (har bir katak alohida saqlanadi — bir vaqtda bir necha kishi yozsa ham bir-birini o'chirmaydi)
create table if not exists public.report_cells (
  branch_id   uuid not null references public.branches(id) on delete cascade,
  day         date not null,
  col_key     text not null,
  value       text,
  updated_at  timestamptz not null default now(),
  primary key (branch_id, day, col_key)
);
create index if not exists report_cells_day_idx on public.report_cells(branch_id, day);

-- ---------- Ochiq tizim (loginsiz) ----------
-- DIQQAT: anon kalitga ega har kim o'qiy va yoza oladi.
alter table public.centers      enable row level security;
alter table public.branches     enable row level security;
alter table public.report_cells enable row level security;

drop policy if exists open_all on public.centers;
drop policy if exists open_all on public.branches;
drop policy if exists open_all on public.report_cells;

create policy open_all on public.centers      for all to anon, authenticated using (true) with check (true);
create policy open_all on public.branches     for all to anon, authenticated using (true) with check (true);
create policy open_all on public.report_cells for all to anon, authenticated using (true) with check (true);

-- ---------- Realtime (boshqa qurilmadagi o'zgarishlar jonli ko'rinadi) ----------
do $$
begin
  begin
    alter publication supabase_realtime add table public.report_cells;
  exception when duplicate_object then null;
  end;
end $$;
