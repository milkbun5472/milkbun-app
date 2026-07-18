-- ============================================================
-- C 第4步：睡眠 presence 投影表（合同 §5.2）——夜巡的无正文时间窗
-- 不含消息/人格/记忆/心情/压力；只投影夜巡需要的时间窗口。过期即 fail-open。
-- 部署：SQL Editor 整份执行（幂等可重跑）。
-- ============================================================
create table if not exists public.character_sleep_presence (
  user_id uuid not null references auth.users(id) on delete cascade,
  char_id text not null,
  sleep_start_at timestamptz,
  wake_at timestamptz,
  observed_phase text not null default 'awake'
    check (observed_phase in ('awake','drowsy','asleep','waking')),
  next_transition_at timestamptz,
  schedule_fingerprint text not null default '',
  valid_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, char_id)
);

alter table public.character_sleep_presence enable row level security;
alter table public.character_sleep_presence force row level security;

drop policy if exists sleep_presence_own on public.character_sleep_presence;
create policy sleep_presence_own on public.character_sleep_presence
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 夜巡 shadow 用：信件标记「本应跳过」但不真跳过
alter table public.server_inbox add column if not exists would_skip_sleep boolean default false;
