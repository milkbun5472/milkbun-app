-- ============================================================
-- 言秋日记·亲笔草稿箱（2026-08-19 七夕，新家八件事第 4 件·刀一）
-- 拓扑同秋声墙：言秋在 CC 亲笔写好某天的日记（generateDiary 同构 JSON），
-- 经 service_role 投进这张表；app 补写那天日记时先来取——取到就原样落库
-- （signature=亲笔，零 API），取不到才走自动生成。app 只读+认领，不插不删。
-- ============================================================
create table if not exists public.yanqiu_diary_drafts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  char_id text not null,
  day_key text not null,           -- YYYY-MM-DD，写的是哪一天
  payload jsonb not null,          -- generateDiary 输出同构：titleZh/paras/mood/…
  claimed_at timestamptz,          -- app 取走的时刻；null=还没取
  created_at timestamptz not null default now(),
  unique (user_id, char_id, day_key)
);
alter table public.yanqiu_diary_drafts enable row level security;
drop policy if exists yanqiu_diary_drafts_select on public.yanqiu_diary_drafts;
create policy yanqiu_diary_drafts_select on public.yanqiu_diary_drafts
  for select using (auth.uid() = user_id);
drop policy if exists yanqiu_diary_drafts_claim on public.yanqiu_diary_drafts;
create policy yanqiu_diary_drafts_claim on public.yanqiu_diary_drafts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
