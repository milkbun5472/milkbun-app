-- Re-runnable RLS smoke test for supabase/memories.sql.
-- All probe rows live inside a transaction that is rolled back.

begin;

select set_config(
  'request.jwt.claim.sub',
  (select id::text from auth.users order by created_at limit 1),
  true
);

set local role authenticated;

insert into public.memories (user_id, id, text, ts, last_mutation_id)
values (auth.uid(), '__rls_memory_probe__', 'temporary RLS probe', 1, gen_random_uuid());

insert into public.memory_conflicts (
  user_id, memory_id, server_revision, local_row, server_row, mutation_id
)
values (
  auth.uid(), '__rls_memory_probe__', 1,
  '{"text":"local"}'::jsonb, '{"text":"server"}'::jsonb, gen_random_uuid()
);

do $$
declare
  owner_id uuid := auth.uid();
  visible_count integer;
  current_revision bigint;
  blocked boolean;
begin
  select count(*) into visible_count
  from public.memories where id = '__rls_memory_probe__';
  if visible_count <> 1 then
    raise exception 'RLS test failed: owner cannot read own memory';
  end if;

  update public.memories
  set pinned = true
  where user_id = owner_id and id = '__rls_memory_probe__';

  select revision into current_revision
  from public.memories where user_id = owner_id and id = '__rls_memory_probe__';
  if current_revision <> 2 then
    raise exception 'revision trigger failed: expected 2, got %', current_revision;
  end if;

  update public.memories
  set deleted = true
  where user_id = owner_id and id = '__rls_memory_probe__';

  -- Switch the simulated JWT to another user. The owner's rows must disappear.
  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-0000-0000-000000000001',
    true
  );

  select count(*) into visible_count
  from public.memories where id = '__rls_memory_probe__';
  if visible_count <> 0 then
    raise exception 'RLS test failed: another user can read the memory';
  end if;

  select count(*) into visible_count
  from public.memory_conflicts where memory_id = '__rls_memory_probe__';
  if visible_count <> 0 then
    raise exception 'RLS test failed: another user can read the conflict log';
  end if;

  blocked := false;
  begin
    insert into public.memories (user_id, id, text, ts)
    values (owner_id, '__rls_forbidden_insert__', 'must be rejected', 1);
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked then
    raise exception 'RLS test failed: cross-user insert was accepted';
  end if;

  blocked := false;
  begin
    delete from public.memories
    where user_id = owner_id and id = '__rls_memory_probe__';
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked then
    raise exception 'RLS test failed: authenticated role has physical DELETE';
  end if;
end;
$$;

reset role;
rollback;

select
  (select count(*) from public.memories) as memories_rows_after_rollback,
  (select count(*) from public.memory_conflicts) as conflicts_rows_after_rollback,
  c.relrowsecurity as memories_rls_enabled,
  c.relforcerowsecurity as memories_rls_forced,
  not has_table_privilege('authenticated', 'public.memories', 'DELETE') as physical_delete_blocked,
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'memories'
      and column_name in ('hits', 'last_hit')
  ) as retrieval_telemetry_is_local_only,
  (select count(*) from pg_policies
   where schemaname = 'public' and tablename = 'memories') as memories_policy_count,
  (select count(*) from pg_policies
   where schemaname = 'public' and tablename = 'memory_conflicts') as conflict_policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'memories';

