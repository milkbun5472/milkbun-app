-- P1-3 DORMANT tests · 仅在 P1-2 + corrections schema/RPC 获批部署后运行；自动 ROLLBACK。
begin;
select set_config('request.jwt.claim.sub',(select id::text from auth.users order by created_at limit 1),true);
do $correction_test$
declare
  uid uuid:=auth.uid(); oldid text:='__corr_old__'; newid text:='__corr_new__'; c2old text:='__corr2_old__'; c2new text:='__corr2_new__'; c3old text:='__corr3_old__'; c3new text:='__corr3_new__';
  cr jsonb; dr jsonb; cid text; c2cid text; failed boolean;
begin
  if uid is null then raise exception 'test requires an auth user'; end if;
  insert into public.memories(user_id,id,text,ts,pinned,open) values
    (uid,oldid,'old wording retained',1,true,true),(uid,newid,'new detailed wording',2,false,false),
    (uid,c2old,'second old wording',3,false,false),(uid,c2new,'second new wording',4,false,false),
    (uid,c3old,'third old wording',5,false,false),(uid,c3new,'third new wording',6,false,false);

  cr:=public.create_memory_correction_candidate(oldid,newid,1,1,'more_detailed','00000000-0000-0000-0000-000000000301');
  cid:=cr->'candidate'->>'id';
  if cr->>'status'<>'proposed' then raise exception 'create failed: %',cr; end if;
  cr:=public.create_memory_correction_candidate(oldid,newid,1,1,'more_detailed','00000000-0000-0000-0000-000000000301');
  if coalesce((cr->>'idempotent')::boolean,false) is not true then raise exception 'create retry not idempotent'; end if;

  dr:=public.decide_memory_correction_candidate(cid,1,'accepted','00000000-0000-0000-0000-000000000302');
  if dr->>'status'<>'accepted' or (select surface_state from public.memories where user_id=uid and id=oldid)<>'superseded'
    or (select supersedes_id from public.memories where user_id=uid and id=newid)<>oldid then raise exception 'accept did not link both rows: %',dr; end if;
  -- pinned/open 旧条只有在这次显式确认后才降级；两行都仍物理存在。
  if (select count(*) from public.memories where user_id=uid and id in(oldid,newid))<>2 then raise exception 'correction physically deleted a row'; end if;
  dr:=public.decide_memory_correction_candidate(cid,1,'accepted','00000000-0000-0000-0000-000000000302');
  if coalesce((dr->>'idempotent')::boolean,false) is not true or (select count(*) from public.memory_correction_audit where user_id=uid and candidate_id=cid)<>1 then raise exception 'decision retry duplicated work'; end if;

  -- revision 漂移：候选、两行和审计必须保持未决定。
  cr:=public.create_memory_correction_candidate(c2old,c2new,1,1,'contradiction','00000000-0000-0000-0000-000000000303');
  c2cid:=cr->'candidate'->>'id';
  update public.memories set text='changed after proposal' where user_id=uid and id=c2old;
  failed:=false; begin perform public.decide_memory_correction_candidate(cr->'candidate'->>'id',1,'accepted','00000000-0000-0000-0000-000000000304'); exception when others then failed:=true; end;
  if not failed then raise exception 'revision drift was accepted'; end if;
  if (select status from public.memory_correction_candidates where user_id=uid and id=cr->'candidate'->>'id')<>'proposed'
    or (select surface_state from public.memories where user_id=uid and id=c2old)<>'active'
    or exists(select 1 from public.memory_correction_audit where user_id=uid and candidate_id=cr->'candidate'->>'id') then raise exception 'failed decision left partial state'; end if;

  -- 故障注入：两行更新之后 audit insert 爆炸，整个事务子块必须把两行和候选一起退回。
  cr:=public.create_memory_correction_candidate(c3old,c3new,1,1,'manual','00000000-0000-0000-0000-000000000306');
  execute $ddl$create function public.__corr_fail_audit() returns trigger language plpgsql as $fn$ begin raise exception 'injected correction audit failure'; end; $fn$$ddl$;
  execute 'create trigger __corr_fail_audit before insert on public.memory_correction_audit for each row execute function public.__corr_fail_audit()';
  failed:=false; begin perform public.decide_memory_correction_candidate(cr->'candidate'->>'id',1,'accepted','00000000-0000-0000-0000-000000000307'); exception when others then failed:=true; end;
  execute 'drop trigger __corr_fail_audit on public.memory_correction_audit'; execute 'drop function public.__corr_fail_audit()';
  if not failed or (select surface_state from public.memories where user_id=uid and id=c3old)<>'active'
    or (select supersedes_id from public.memories where user_id=uid and id=c3new) is not null
    or (select status from public.memory_correction_candidates where user_id=uid and id=cr->'candidate'->>'id')<>'proposed' then raise exception 'post-update failure left partial correction'; end if;

  -- 拒绝只留审计，不改两行。
  dr:=public.decide_memory_correction_candidate(c2cid,1,'rejected','00000000-0000-0000-0000-000000000305');
  if dr->>'status'<>'rejected' or (select surface_state from public.memories where user_id=uid and id=c2old)<>'active' then raise exception 'reject changed memory state'; end if;

  if has_table_privilege('authenticated','public.memory_correction_candidates','INSERT') or has_table_privilege('authenticated','public.memory_correction_candidates','UPDATE') then raise exception 'candidate table directly writable'; end if;
  if has_function_privilege('anon','public.decide_memory_correction_candidate(text,bigint,text,uuid)','EXECUTE') or has_function_privilege('service_role','public.decide_memory_correction_candidate(text,bigint,text,uuid)','EXECUTE') then raise exception 'decision RPC exposed outside App user'; end if;
  raise notice 'memory correction dormant tests passed';
end;
$correction_test$;
rollback;
