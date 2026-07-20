-- ============================================================
-- 言秋共同聊天账本 · 第 1 步验收
-- 先运行 chat_messages.sql，再运行本文件。
-- 所有探针都在事务中，最终 rollback，不留下聊天或 tombstone。
-- ============================================================

begin;

select set_config(
  'request.jwt.claim.sub',
  (select id::text from auth.users order by created_at limit 1),
  true
);
set local role authenticated;

do $$
declare
  uid uuid := auth.uid();
  probe_id uuid;
  visible_count integer;
  current_revision bigint;
  blocked boolean;
begin
  if uid is null then
    raise exception 'chat ledger RLS probe needs one existing auth.users row';
  end if;

  -- Owner can insert a valid App row, including §15 excerpt audit metadata.
  insert into public.chat_messages (
    user_id, message_key, char_id, thread_type, thread_id,
    speaker_type, speaker_id, content, occurred_at, source,
    source_message_id, metadata
  ) values (
    uid, '__chat_rls_probe__', '__yanqiu_probe__', 'cc', '__old_cc_window__',
    'character', '__yanqiu_probe__', '逐字原话探针', now(), 'cc',
    '__turn_1_assistant__', '{"excerpted":true,"sync_kind":"decision"}'::jsonb
  ) returning id into probe_id;

  select count(*) into visible_count
  from public.chat_messages where id = probe_id;
  if visible_count <> 1 then
    raise exception 'chat RLS failed: owner cannot read own row';
  end if;

  -- Same stable key retried three times remains one row (no text-based dedupe).
  insert into public.chat_messages (
    user_id, message_key, char_id, thread_type, thread_id,
    speaker_type, content, occurred_at, source
  ) values (
    uid, '__chat_rls_probe__', '__yanqiu_probe__', 'cc', '__old_cc_window__',
    'character', '重试不应覆盖原文', now(), 'cc'
  ) on conflict (user_id, message_key) do nothing;
  insert into public.chat_messages (
    user_id, message_key, char_id, thread_type, thread_id,
    speaker_type, content, occurred_at, source
  ) values (
    uid, '__chat_rls_probe__', '__yanqiu_probe__', 'cc', '__old_cc_window__',
    'character', '第三次重试', now(), 'cc'
  ) on conflict (user_id, message_key) do nothing;

  select count(*) into visible_count
  from public.chat_messages where user_id = uid and message_key = '__chat_rls_probe__';
  if visible_count <> 1 then
    raise exception 'chat idempotency failed: expected one row, got %', visible_count;
  end if;

  -- Same words with another real message key must remain a separate row.
  insert into public.chat_messages (
    user_id, message_key, char_id, thread_type, thread_id,
    speaker_type, content, occurred_at, source
  ) values (
    uid, '__chat_rls_same_words__', '__yanqiu_probe__', 'cc', '__old_cc_window__',
    'character', '逐字原话探针', now() + interval '1 second', 'cc'
  );
  select count(*) into visible_count
  from public.chat_messages where user_id = uid and content = '逐字原话探针';
  if visible_count <> 2 then
    raise exception 'chat identity failed: repeated real words were collapsed';
  end if;

  -- Controlled body edit increments revision and requires a real edit timestamp.
  update public.chat_messages
  set content = '逐字原话探针（用户编辑）', edited_at = now() + interval '2 seconds'
  where id = probe_id;
  select revision into current_revision from public.chat_messages where id = probe_id;
  if current_revision <> 2 then
    raise exception 'chat revision trigger failed: expected 2, got %', current_revision;
  end if;

  -- Soft delete is allowed; physical delete is not granted.
  update public.chat_messages set deleted_at = now() + interval '3 seconds' where id = probe_id;
  select revision into current_revision from public.chat_messages where id = probe_id;
  if current_revision <> 3 then
    raise exception 'chat soft delete revision failed: expected 3, got %', current_revision;
  end if;

  blocked := false;
  begin
    delete from public.chat_messages where id = probe_id;
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked then
    raise exception 'chat privilege failed: authenticated physically deleted a row';
  end if;

  -- Provenance columns are not update-granted to App clients.
  blocked := false;
  begin
    update public.chat_messages set char_id = '__other_character__' where id = probe_id;
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked then
    raise exception 'chat privilege failed: authenticated moved a row to another character';
  end if;

  -- §15 metadata must be mechanically typed and classification must stay in the approved set.
  blocked := false;
  begin
    insert into public.chat_messages (
      user_id, message_key, char_id, thread_type, thread_id,
      speaker_type, content, occurred_at, source, metadata
    ) values (
      uid, '__chat_bad_excerpt__', '__yanqiu_probe__', 'cc', '__old_cc_window__',
      'character', 'must fail', now(), 'cc', '{"excerpted":"yes"}'::jsonb
    );
  exception when check_violation then
    blocked := true;
  end;
  if not blocked then
    raise exception 'chat metadata failed: non-boolean excerpted was accepted';
  end if;

  -- Simulated second account sees none and cannot insert under the real owner's user_id.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
  select count(*) into visible_count
  from public.chat_messages where message_key like '__chat_rls%';
  if visible_count <> 0 then
    raise exception 'chat RLS failed: another user can read owner rows';
  end if;

  blocked := false;
  begin
    insert into public.chat_messages (
      user_id, message_key, char_id, thread_type, thread_id,
      speaker_type, content, occurred_at, source
    ) values (
      uid, '__chat_cross_user__', '__yanqiu_probe__', 'cc', '__old_cc_window__',
      'character', 'must fail', now(), 'cc'
    );
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked then
    raise exception 'chat RLS failed: cross-user insert was accepted';
  end if;
end;
$$;

reset role;
rollback;

select jsonb_build_object(
  'probe_rows_after_rollback',
    (select count(*) from public.chat_messages where message_key like '__chat_%'),
  'rls_enabled',
    (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'chat_messages'),
  'rls_forced',
    (select relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'chat_messages'),
  'physical_delete_blocked',
    not has_table_privilege('authenticated', 'public.chat_messages', 'DELETE'),
  'provenance_update_blocked',
    not has_column_privilege('authenticated', 'public.chat_messages', 'char_id', 'UPDATE'),
  'content_update_allowed',
    has_column_privilege('authenticated', 'public.chat_messages', 'content', 'UPDATE'),
  'owner_select_policy',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'chat_messages' and policyname = 'chat_messages_select_own'),
  'owner_insert_policy',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'chat_messages' and policyname = 'chat_messages_insert_own'),
  'owner_update_policy',
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'chat_messages' and policyname = 'chat_messages_update_own')
) as chat_messages_probe_report;

