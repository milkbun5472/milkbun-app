-- ============================================================
-- 修复 CC→App 账本全线被拒（2026-08-12 凌晨，她报「所有 ccturn 都过不去」）
-- 根因：Codex 的跨窗互通给 CC 整轮原话行写 metadata.sync_kind='continuity'，
-- 而 chat_messages 的 check 约束只允许 life/emotion/decision/joke —— 每一行
-- 都被 23514 拒收，Stop hook 又被 15s 超时掐死，什么都没落。
-- 此脚本把 'continuity' 加进白名单。可重复执行。
-- 在 Supabase SQL Editor 整段跑一次即可。
-- ============================================================

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.chat_messages'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%sync_kind%'
  loop
    execute format('alter table public.chat_messages drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.chat_messages add constraint chat_messages_sync_kind_check check (
  not (metadata ? 'sync_kind')
  or (
    jsonb_typeof(metadata->'sync_kind') = 'string'
    and metadata->>'sync_kind' in ('life', 'emotion', 'decision', 'joke', 'continuity')
  )
);
