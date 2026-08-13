-- ============================================================
-- 桥轮询磁盘 IO 止血索引（2026-08-11 深夜 Disk IO Budget 耗尽事故）
-- 病根：yanqiu-cc-bridge cloud-worker 高频轮询 chat_messages 时按
-- metadata->>bridge_kind / bridge_state 过滤，没有任何索引可用，
-- 每一次轮询都是全表顺序扫描；免费档 Disk IO 预算被磨干后整个
-- 实例变卡，Auth 超时把 Lisa 登出。
-- 两个部分索引让「队列为空」的常态轮询变成近零 IO 的索引探测。
-- 在 Supabase SQL Editor 里整段执行一次即可，可重复执行。
-- ============================================================

create index if not exists chat_messages_bridge_queue_idx
  on public.chat_messages (user_id, created_at)
  where metadata->>'bridge_kind' = 'app_cc_request'
    and metadata->>'bridge_state' = 'queued';

-- worker 回写结果前查重用（appcc:result 幂等插入的冲突判断走
-- unique(user_id,message_key) 已有约束，这里不用加）。

-- 顺手：shadow 拉取按 (user_id, char_id, updated_at, id) 已有
-- chat_messages_change_cursor_idx，不用动。
