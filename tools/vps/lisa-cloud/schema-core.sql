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

create table if not exists public.server_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  char_id text,
  kind text not null,
  content text not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  pushed_at timestamptz,
  would_skip_sleep boolean not null default false
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
  foreach t in array array['saves','chat_archive','cc_mem_inbox','cc_read_inbox','server_inbox','push_subs'] loop
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
create index if not exists server_inbox_pending_idx on public.server_inbox(user_id, created_at) where consumed_at is null;
create index if not exists push_subs_user_idx on public.push_subs(user_id);
