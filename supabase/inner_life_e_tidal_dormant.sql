-- ============================================================
-- DORMANT / DO NOT RUN · 内在生活系统 E 潮汐独立行表
-- 第 1 步仅供 Lisa + 言秋审阅；尚未部署、App 尚未接线。
-- ============================================================
create table public.user_tidal_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state text not null default 'awake' check (state in ('awake','maybe_sleeping','uncertain')),
  signal_ts timestamptz,
  signal_kind text not null default 'boot' check (signal_kind in ('sleep','wake','typed_message','timeout','boot')),
  transition_reason text not null default '',
  revision bigint not null default 1 check (revision >= 1),
  last_mutation_id uuid not null,
  updated_at timestamptz not null default now()
);

alter table public.user_tidal_state enable row level security;
alter table public.user_tidal_state force row level security;
revoke all on table public.user_tidal_state from public, anon, authenticated;
grant select, insert on table public.user_tidal_state to authenticated;

create policy tidal_select_own on public.user_tidal_state
  for select to authenticated using (auth.uid() = user_id);
create policy tidal_insert_own on public.user_tidal_state
  for insert to authenticated with check (auth.uid() = user_id);

create or replace function public.cas_user_tidal_state(
  p_base_revision bigint,
  p_state text,
  p_signal_ts timestamptz,
  p_signal_kind text,
  p_transition_reason text,
  p_mutation_id uuid
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  uid uuid := auth.uid();
  cur public.user_tidal_state%rowtype;
  outrow public.user_tidal_state%rowtype;
begin
  if uid is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_base_revision is null or p_base_revision < 0 or p_mutation_id is null then
    raise exception 'base revision and mutation id are required' using errcode='22023';
  end if;
  if p_state is null or p_state not in ('awake','maybe_sleeping','uncertain') then
    raise exception 'invalid tidal state' using errcode='22023';
  end if;
  if p_signal_kind is null or p_signal_kind not in ('sleep','wake','typed_message','timeout','boot') then
    raise exception 'invalid signal kind' using errcode='22023';
  end if;
  if p_state='maybe_sleeping' and p_signal_ts is null then
    raise exception 'maybe_sleeping requires signal timestamp' using errcode='22023';
  end if;

  select * into cur from public.user_tidal_state where user_id=uid for update;
  if found and cur.last_mutation_id=p_mutation_id then
    return jsonb_build_object('status','applied','idempotent',true,'row',to_jsonb(cur));
  end if;
  if not found then
    if p_base_revision<>0 then return jsonb_build_object('status','conflict','reason','missing_row'); end if;
    insert into public.user_tidal_state(user_id,state,signal_ts,signal_kind,transition_reason,last_mutation_id)
      values(uid,p_state,p_signal_ts,p_signal_kind,left(coalesce(p_transition_reason,''),120),p_mutation_id)
      returning * into outrow;
    return jsonb_build_object('status','applied','idempotent',false,'row',to_jsonb(outrow));
  end if;
  if cur.revision<>p_base_revision then
    return jsonb_build_object('status','conflict','reason','revision_mismatch','row',to_jsonb(cur));
  end if;
  update public.user_tidal_state set
    state=p_state, signal_ts=p_signal_ts, signal_kind=p_signal_kind,
    transition_reason=left(coalesce(p_transition_reason,''),120),
    revision=revision+1, last_mutation_id=p_mutation_id, updated_at=now()
    where user_id=uid returning * into outrow;
  return jsonb_build_object('status','applied','idempotent',false,'row',to_jsonb(outrow));
end;
$$;

revoke all on function public.cas_user_tidal_state(bigint,text,timestamptz,text,text,uuid) from public,anon,service_role;
grant execute on function public.cas_user_tidal_state(bigint,text,timestamptz,text,text,uuid) to authenticated;
