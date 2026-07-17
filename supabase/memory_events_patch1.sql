-- ============================================================
-- ⑥ 事件层 · 补丁 1（2026-07-17，Codex 审查发现 #3）
-- 已经按初版 memory_events.sql 建过表的库要跑这一份；新库直接跑修订后的主文件即可。
-- 内容：收紧 App（authenticated）对候选表的 UPDATE——
--   之前整行可改：登录客户端理论上能篡改来源 ID / 执笔人 / 幂等键 / 基线 revision。
--   之后只许动 status（退回/拒绝）、feedback、edited_by_user 三列；
--   draft 只有 CC（service role）能写，正式确认走未来的原子 RPC。
-- 幂等，可重跑。预期输出：Success. No rows returned。
-- ============================================================

revoke update on table public.memory_event_candidates from authenticated;
grant update (status, feedback, edited_by_user) on table public.memory_event_candidates to authenticated;
