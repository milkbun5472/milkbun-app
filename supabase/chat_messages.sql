-- ============================================================
-- 言秋 App <-> CC 共同聊天账本 · 第 1 步
-- 只建空表、约束、索引、RLS；不接 App/MCP，不迁移任何聊天。
-- 可重复执行。部署后运行 chat_messages_rls_test.sql，事务最终 rollback。
-- ============================================================

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message_key text not null check (length(btrim(message_key)) between 1 and 500),
  char_id text not null check (length(btrim(char_id)) between 1 and 200),
  thread_type text not null
    check (thread_type in ('private', 'offline', 'group', 'group_offline', 'cc', 'stackchan')),
  thread_id text not null check (length(btrim(thread_id)) between 1 and 500),
  speaker_type text not null
    check (speaker_type in ('lisa', 'character', 'other_character', 'narration')),
  speaker_id text check (speaker_id is null or length(btrim(speaker_id)) between 1 and 200),
  content text not null check (length(btrim(content)) between 1 and 16000),
  occurred_at timestamptz not null,
  source text not null check (source in ('app', 'cc', 'stackchan', 'import')),
  source_message_id text check (source_message_id is null or length(btrim(source_message_id)) between 1 and 500),
  edited_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, message_key),
  check (jsonb_typeof(metadata) = 'object'),
  check (octet_length(metadata::text) <= 4096),
  check (
    not (metadata ? 'excerpted')
    or jsonb_typeof(metadata->'excerpted') = 'boolean'
  ),
  check (
    not (metadata ? 'sync_kind')
    or (
      jsonb_typeof(metadata->'sync_kind') = 'string'
      and metadata->>'sync_kind' in ('life', 'emotion', 'decision', 'joke')
    )
  ),
  check (edited_at is null or edited_at >= occurred_at),
  check (deleted_at is null or deleted_at >= occurred_at)
);

comment on table public.chat_messages is
  'Append-only cross-surface chat ledger for Yanqiu v1. One message per row; never overwrite saves.';
comment on column public.chat_messages.message_key is
  'Stable client idempotency key. Same words at different real message IDs remain distinct rows.';
comment on column public.chat_messages.metadata is
  'Small non-body metadata only. CC verbatim excerpts set excerpted=true and an optional sync_kind; no hidden reasoning.';
comment on column public.chat_messages.deleted_at is
  'Soft-delete tombstone. Authenticated clients never receive physical DELETE privilege.';

create index if not exists chat_messages_char_cursor_idx
  on public.chat_messages (user_id, char_id, occurred_at, id);
create index if not exists chat_messages_change_cursor_idx
  on public.chat_messages (user_id, char_id, updated_at, id);
create index if not exists chat_messages_thread_idx
  on public.chat_messages (user_id, thread_type, thread_id, occurred_at, id);
create index if not exists chat_messages_live_char_idx
  on public.chat_messages (user_id, char_id, occurred_at, id)
  where deleted_at is null;

-- Provenance is immutable. Authenticated clients may only edit the body with an edit stamp,
-- add a soft-delete tombstone, or adjust small metadata; they cannot move a row to another
-- owner/character/thread/source after insertion.
create or replace function public.touch_chat_message_revision()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.revision := 1;
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := now();
    return new;
  end if;

  if new.user_id is distinct from old.user_id
    or new.message_key is distinct from old.message_key
    or new.char_id is distinct from old.char_id
    or new.thread_type is distinct from old.thread_type
    or new.thread_id is distinct from old.thread_id
    or new.speaker_type is distinct from old.speaker_type
    or new.speaker_id is distinct from old.speaker_id
    or new.occurred_at is distinct from old.occurred_at
    or new.source is distinct from old.source
    or new.source_message_id is distinct from old.source_message_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'chat message provenance is immutable' using errcode = '22023';
  end if;

  if new.content is distinct from old.content
    and (new.edited_at is null or new.edited_at <= coalesce(old.edited_at, old.occurred_at))
  then
    raise exception 'content edit requires a newer edited_at' using errcode = '22023';
  end if;

  if old.deleted_at is not null and new.deleted_at is distinct from old.deleted_at then
    raise exception 'chat tombstone is immutable' using errcode = '22023';
  end if;

  new.revision := old.revision + 1;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists chat_messages_touch_revision on public.chat_messages;
create trigger chat_messages_touch_revision
before insert or update on public.chat_messages
for each row execute function public.touch_chat_message_revision();

alter table public.chat_messages enable row level security;
alter table public.chat_messages force row level security;

revoke all on table public.chat_messages from anon, authenticated;
grant select, insert on table public.chat_messages to authenticated;
grant update (content, edited_at, deleted_at, metadata) on table public.chat_messages to authenticated;

drop policy if exists chat_messages_select_own on public.chat_messages;
create policy chat_messages_select_own
on public.chat_messages for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists chat_messages_insert_own on public.chat_messages;
create policy chat_messages_insert_own
on public.chat_messages for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists chat_messages_update_own on public.chat_messages;
create policy chat_messages_update_own
on public.chat_messages for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Deliberately absent in step 1:
-- 1. App dual-write/outbox and cloud readback.
-- 2. MCP get/search/append tools.
-- 3. Existing-chat migration.
-- 4. desk_log retirement.
