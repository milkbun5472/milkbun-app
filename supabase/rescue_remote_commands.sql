-- 手机 App → 本机互救台。命令只属于当前登录用户；执行端使用 service_role 领取。
create table if not exists public.rescue_remote_commands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('status','checkpoint','restart','rescue_ticket','rewind_preview')),
  payload jsonb not null default '{}'::jsonb,
  state text not null default 'queued' check (state in ('queued','claimed','completed','failed')),
  result jsonb,
  error_text text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz
);

create index if not exists rescue_remote_commands_owner_created
  on public.rescue_remote_commands(user_id, created_at desc);
create index if not exists rescue_remote_commands_queue
  on public.rescue_remote_commands(user_id, state, created_at);

alter table public.rescue_remote_commands enable row level security;
drop policy if exists rescue_remote_commands_select_own on public.rescue_remote_commands;
create policy rescue_remote_commands_select_own on public.rescue_remote_commands
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists rescue_remote_commands_insert_own on public.rescue_remote_commands;
create policy rescue_remote_commands_insert_own on public.rescue_remote_commands
  for insert to authenticated with check (
    auth.uid() = user_id
    and state = 'queued'
    and result is null
    and error_text is null
    and jsonb_typeof(payload) = 'object'
    and octet_length(payload::text) <= 4000
  );

revoke update, delete on public.rescue_remote_commands from authenticated;
grant select, insert on public.rescue_remote_commands to authenticated;

