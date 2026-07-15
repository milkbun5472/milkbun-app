-- Lisa-phone memory gateway v1
-- Step 1 only: empty tables, constraints, revision trigger, grants and RLS.
-- No migration runs in this file. Existing x_memLib data is untouched.

create table if not exists public.memories (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  text text not null check (length(btrim(text)) > 0),
  tags text[] not null default '{}'::text[],
  char_ids text[] not null default '{}'::text[],
  v smallint not null default 0 check (v between -5 and 5),
  a smallint not null default 1 check (a between 0 and 5),
  open boolean not null default false,
  pinned boolean not null default false,
  ts bigint not null,
  archived boolean not null default false,
  archived_batch text,
  source text,
  deleted boolean not null default false,
  revision bigint not null default 1 check (revision > 0),
  last_mutation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

comment on table public.memories is
  'Authoritative row-level memory store. x_memLib remains an offline mirror; deletes are tombstones.';
comment on column public.memories.ts is
  'Original memory/event timestamp in Unix milliseconds; preserved during migration.';
comment on column public.memories.deleted is
  'Soft-delete tombstone. Client roles have no physical DELETE privilege.';
comment on column public.memories.revision is
  'Server-maintained per-row revision for optimistic concurrency.';

-- hits/lastHit deliberately stay local-only. They are retrieval telemetry, not shared memory truth.

create index if not exists memories_user_updated_idx
  on public.memories (user_id, updated_at, id);
create index if not exists memories_user_live_updated_idx
  on public.memories (user_id, deleted, updated_at, id);
create index if not exists memories_char_ids_gin_idx
  on public.memories using gin (char_ids);
create index if not exists memories_tags_gin_idx
  on public.memories using gin (tags);
create unique index if not exists memories_mutation_id_uidx
  on public.memories (user_id, last_mutation_id)
  where last_mutation_id is not null;

create or replace function public.touch_memory_revision()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.revision := 1;
    new.created_at := coalesce(new.created_at, now());
  else
    new.revision := old.revision + 1;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists memories_touch_revision on public.memories;
create trigger memories_touch_revision
before insert or update on public.memories
for each row execute function public.touch_memory_revision();

-- v1 conflict handling is log-only: never discard either side, no card UI yet.
create table if not exists public.memory_conflicts (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid primary key default gen_random_uuid(),
  memory_id text not null,
  base_revision bigint,
  server_revision bigint not null,
  local_row jsonb not null,
  server_row jsonb not null,
  device_id text,
  mutation_id uuid,
  status text not null default 'logged' check (status = 'logged'),
  created_at timestamptz not null default now()
);

comment on table public.memory_conflicts is
  'Append-only v1 conflict log. Both local and server versions are retained; no conflict UI yet.';

create index if not exists memory_conflicts_user_created_idx
  on public.memory_conflicts (user_id, created_at desc);
create unique index if not exists memory_conflicts_mutation_uidx
  on public.memory_conflicts (user_id, mutation_id)
  where mutation_id is not null;

alter table public.memories enable row level security;
alter table public.memories force row level security;
alter table public.memory_conflicts enable row level security;
alter table public.memory_conflicts force row level security;

revoke all on table public.memories from anon, authenticated;
grant select, insert, update on table public.memories to authenticated;

revoke all on table public.memory_conflicts from anon, authenticated;
grant select, insert on table public.memory_conflicts to authenticated;

drop policy if exists memories_select_own on public.memories;
create policy memories_select_own
on public.memories for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists memories_insert_own on public.memories;
create policy memories_insert_own
on public.memories for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists memories_update_own on public.memories;
create policy memories_update_own
on public.memories for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists memory_conflicts_select_own on public.memory_conflicts;
create policy memory_conflicts_select_own
on public.memory_conflicts for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists memory_conflicts_insert_own on public.memory_conflicts;
create policy memory_conflicts_insert_own
on public.memory_conflicts for insert to authenticated
with check ((select auth.uid()) = user_id);

