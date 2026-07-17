-- DORMANT test · 只在获批部署表/RPC 后运行；整份自动 ROLLBACK。
begin;
select set_config('request.jwt.claim.sub',(select id::text from auth.users order by created_at limit 1),true);

do $tidal_test$
declare
  uid uuid:=auth.uid(); r jsonb; failed boolean;
  m1 constant uuid:='00000000-0000-0000-0000-000000000e01';
  m2 constant uuid:='00000000-0000-0000-0000-000000000e02';
  m3 constant uuid:='00000000-0000-0000-0000-000000000e03';
begin
  if uid is null then raise exception 'test requires at least one auth user'; end if;
  delete from public.user_tidal_state where user_id=uid;

  r:=public.cas_user_tidal_state(0,'maybe_sleeping',now(),'sleep','test sleep',m1);
  if r->>'status'<>'applied' or r->'row'->>'state'<>'maybe_sleeping' then raise exception 'insert failed: %',r; end if;
  r:=public.cas_user_tidal_state(0,'maybe_sleeping',now(),'sleep','retry',m1);
  if coalesce((r->>'idempotent')::boolean,false) is not true then raise exception 'retry not idempotent: %',r; end if;

  r:=public.cas_user_tidal_state(0,'awake',null,'wake','stale',m2);
  if r->>'status'<>'conflict' or (select state from public.user_tidal_state t where t.user_id=uid)<>'maybe_sleeping' then raise exception 'stale write changed row: %',r; end if;
  r:=public.cas_user_tidal_state(1,'awake',null,'wake','awake',m3);
  if r->>'status'<>'applied' or (r->'row'->>'revision')::bigint<>2 then raise exception 'CAS update failed: %',r; end if;

  failed:=false; begin perform public.cas_user_tidal_state(2,'sleeping',now(),'sleep','bad',gen_random_uuid()); exception when others then failed:=true; end;
  if not failed then raise exception 'invalid state accepted'; end if;
  failed:=false; begin perform public.cas_user_tidal_state(2,'maybe_sleeping',null,'sleep','bad',gen_random_uuid()); exception when others then failed:=true; end;
  if not failed then raise exception 'sleeping without timestamp accepted'; end if;

  if has_table_privilege('anon','public.user_tidal_state','SELECT')
    or has_table_privilege('anon','public.user_tidal_state','INSERT')
    or has_table_privilege('anon','public.user_tidal_state','UPDATE')
    or has_table_privilege('authenticated','public.user_tidal_state','UPDATE') then raise exception 'unsafe table grants'; end if;
  if has_function_privilege('anon','public.cas_user_tidal_state(bigint,text,timestamptz,text,text,uuid)','EXECUTE')
    or has_function_privilege('service_role','public.cas_user_tidal_state(bigint,text,timestamptz,text,text,uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.cas_user_tidal_state(bigint,text,timestamptz,text,text,uuid)','EXECUTE') then raise exception 'unsafe RPC grants'; end if;
  raise notice 'inner life E tidal dormant tests passed';
end;
$tidal_test$;

rollback;
