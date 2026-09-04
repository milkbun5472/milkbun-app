-- 心上（x_desires）和 Ta 眼里（x_gaze）搬出 saves blob
-- ────────────────────────────────────────────────────────────
-- 2026-09-04 第二次丢数据之后建的。病根不是「闸没写好」：
-- v61.63 那道过期设备闸写在【客户端】里，而肇事的是书签里一个几个月前的
-- 旧网页版——它的代码里根本没有那道闸。用新代码去管旧客户端，永远管不住。
--
-- 记忆和聊天那次活下来了，不是因为「它们在云上」，是因为它们各自有一张行表
-- （memories 每行自带 char_ids、chat_archive 按 char_id 只追加），
-- 而那个旧客户端【代码里没有这两张表】，所以碰都碰不到。
-- 这张表就是同一个形状：旧版不认识 grown，也就盖不掉它。
--
-- 在【VPS 上那套自托管 Supabase】的 SQL 里跑一次就行（app 现在读写的就是它）。
-- 跑之前跑之后 app 都能正常用：表不在的时候这一层整个静默 no-op。

create table if not exists public.grown (
  user_id    uuid        not null,
  char_id    text        not null,
  kind       text        not null,          -- 'heart' = 心上 / 'gaze' = Ta 眼里
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, char_id, kind)
);

alter table public.grown enable row level security;

drop policy if exists "grown own rows" on public.grown;
create policy "grown own rows" on public.grown
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 按人取自己那几行用得上
create index if not exists grown_user_kind_idx on public.grown (user_id, kind);
