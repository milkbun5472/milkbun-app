create extension if not exists pgcrypto with schema extensions;

create table if not exists public.saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_archive (
  user_id uuid not null references auth.users(id) on delete cascade,
  char_id text not null,
  msgs jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, char_id)
);

create table if not exists public.cc_mem_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_id text,
  dedupe_key text,
  memory jsonb not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);
create unique index if not exists cc_mem_inbox_user_dedupe_idx
  on public.cc_mem_inbox(user_id, dedupe_key) where dedupe_key is not null;

create table if not exists public.cc_read_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);

-- 长出来的那几样：心上（x_desires）和 Ta 眼里（x_gaze）搬出 saves blob
-- ────────────────────────────────────────────────────────────
-- 2026-09-04 第二次丢数据之后建的。saves 是【一份没有历史的整行 blob】，
-- 书签里那个几个月前的旧网页版整份 upsert 一次就把它盖没了。
-- 记忆和聊天那次活下来，不是因为「它们在云上」，是因为它们各自有一张行表——
-- 而那个旧客户端【代码里根本没有那两张表】，所以碰都碰不到。
-- ⚠️病根不是「闸没写好」：过期设备闸写在【客户端】里，而肇事的是一个你改不到的
--   旧客户端。用新代码去管旧客户端永远管不住；唯一挡得住的形状是它不认识的那张表。
-- kind: 'heart' = 心上 / 'gaze' = Ta 眼里
create table if not exists public.grown (
  user_id uuid not null references auth.users(id) on delete cascade,
  char_id text not null,
  kind text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, char_id, kind)
);

create table if not exists public.push_subs (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription jsonb not null,
  ua text,
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['saves','chat_archive','cc_mem_inbox','cc_read_inbox','push_subs','grown'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_select on public.%I', t);
    execute format('drop policy if exists owner_insert on public.%I', t);
    execute format('drop policy if exists owner_update on public.%I', t);
    execute format('drop policy if exists owner_delete on public.%I', t);
    execute format('create policy owner_select on public.%I for select to authenticated using (auth.uid() = user_id)', t);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check (auth.uid() = user_id)', t);
    execute format('create policy owner_update on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy owner_delete on public.%I for delete to authenticated using (auth.uid() = user_id)', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

create index if not exists chat_archive_user_updated_idx on public.chat_archive(user_id, updated_at desc);
create index if not exists cc_mem_inbox_pending_idx on public.cc_mem_inbox(user_id, created_at) where consumed_at is null;
create index if not exists cc_read_inbox_pending_idx on public.cc_read_inbox(user_id, created_at) where consumed_at is null;
create index if not exists push_subs_user_idx on public.push_subs(user_id);
create index if not exists grown_user_kind_idx on public.grown(user_id, kind);
