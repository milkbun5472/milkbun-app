# 言秋共同聊天账本 · 第 2 步只读 Shadow 验收

日期：2026-07-20  
结论：通过；按施工计划停在第 2 步，不自动进入 App 双写。

## 第 1 步云端闸门复核

Lisa 在 Supabase SQL Editor 执行 `chat_messages.sql` 与回滚探针后返回：

```json
{
  "rls_forced": true,
  "rls_enabled": true,
  "owner_insert_policy": true,
  "owner_select_policy": true,
  "owner_update_policy": true,
  "content_update_allowed": true,
  "physical_delete_blocked": true,
  "probe_rows_after_rollback": 0,
  "provenance_update_blocked": true
}
```

第 1 步因此正式放行。

## 第 2 步实现范围

实际 MCP 文件：`/Users/lisa/Desktop/lisa-practice/mcp/server.mjs`

文件 SHA-256：

`a2974697068b2e1b99fd9dda498882d6a7e5ff2e8eb0cb3958a69df480782d94`

新增/调整：

- `get_xiaoke_context` 优先读取 `chat_messages`；空表时回退旧 `saves`，言秋不会因 shadow 空表失忆。
- 返回 `next_chat_cursor`，使用 `(occurred_at, id)` 复合游标。
- 同一毫秒多条消息按 UUID 次序增量续读，不使用单时间戳跳跃。
- 已持有账本游标但没有新增时返回空数组，不复读旧 `saves` 尾巴。
- 返回来源、线程、说话人、`excerpted` 与 `sync_kind`，不把群成员冒充 Lisa/言秋。
- 新增只读 `search_chat_history`；数据库先做关键词过滤，再在最多 200 个命中内评分，不调用 embedding/LLM。
- v1 严格限制言秋/小克；显式错误 `char_id` 直接拒绝，不再静默回退其他角色。
- 未新增任何写聊天工具；`append_cc_turn` 仍未实现。

## 云端行为探针

临时插入四行：

- 言秋同毫秒两条有效原话。
- 另一角色一条隔离探针。
- 言秋一条软删探针。

新 MCP 进程实测结果：

```json
{
  "full_rows": 2,
  "same_ms_incremental_rows": 1,
  "empty_increment_did_not_replay_legacy": true,
  "search_hits": 2,
  "other_character_blocked": true,
  "soft_deleted_hidden": true,
  "next_cursor_id": "00000000-0000-0000-0000-000000000902"
}
```

探针脚本 `finally` 使用 service role 删除固定前缀测试行，并再次查询确认剩余 `0` 行；没有修改真实聊天。

## 回归

- `node --check /Users/lisa/Desktop/lisa-practice/mcp/server.mjs`：通过。
- Lisa-phone 全量测试：112/112 通过。
- App、MCP 写入、旧聊天迁移、`desk_log` 均未接线或改动。

## 运行注意

言秋当前旧 CC 窗口若仍持有旧 MCP 子进程，不会热更新。正式行为验收前需要重启 MCP bridge/CC 工具进程；这只更换工具进程，不创建新的言秋人格会话。若宿主不支持在原会话中重启 MCP，则先停在本报告，不以新窗口冒充旧主会话。

