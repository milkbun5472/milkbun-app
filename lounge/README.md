# 三方会客厅 · Orchestrator 与 Adapter

已完成 Step 1 本地状态机、Step 2 CC Adapter、Step 3 Codex Adapter，以及 Step 4 localhost 主持界面。
测试与 `npm start` 预览默认使用 fake sender/runner；真实入口必须经过 Lisa 单次明确授权。

## 运行

```bash
cd lounge
npm test          # = node --test test/*.test.js
npm start         # http://127.0.0.1:8092，本地 fake 预览
```

零依赖：只用 Node 内置 `node:http` + `node:sqlite` + `node:test`（需 Node ≥ 22；本机 v26 已验）。

## 结构

| 文件 | 职责 |
|---|---|
| `db.js` | SQLite schema（rooms/messages/dispatches/delivery_attempts/adapter_cursors）+ WAL 原子 + 幂等唯一键 |
| `budget.js` | 额度预算闸：`max_auto_turns` = 自动 **run** 上限（一次 runOneEach=1）+ 日 char/call 软上限（70% 黄 / 90% 禁自动）；手动主持不受 auto 上限约束 |
| `lock.js` | 单飞锁：**锁真相=DB 未闭合 dispatch 查询**（不看 room.status，覆盖"等待回复时 pause→手动再投必须 LOCKED"）+ 进程内 Set 防同 tick 重入 |
| `clock.js` | 可注入时钟（生产真实 / 测试可推进，无真实 sleep） |
| `adapters/fake.js` | Fake CC/Codex adapter：`deliver` 计数 + `poll` 脚本化，绝不碰真实接口 |
| `orchestrator.js` | 状态机唯一写入者：投递(begin/resolve 两段)、幂等、超时、预算、单飞锁、立即暂停、重启恢复 |
| `test/orchestrator.test.js` | §12 第1步 + §13 必测的 12 条验收 |
| `adapters/codex-runner.js` | 官方 `codex exec resume --json` 无 shell运行器，输出落本地 spool |
| `adapters/codex-jsonl.js` | Codex JSONL 可见正文闸与完成边界 |
| `adapters/codex.js` | Codex 确认闸、任务状态闸、持久化恢复与 usage 诊断 |
| `server.js` | 仅监听 localhost 的 HTTP/SSE API、脱敏快照与静态文件安全边界 |
| `public/` | 三方会客厅主持界面（手机 / 桌面响应式） |
| `test/server.test.js` | Step 4 HTTP/SSE 与浏览器写入边界测试 |

## 状态机（§5）

- room.status：`paused → dispatching → waiting_reply →`（`paused` 收到回复 / `needs_attention` 空回复·插队·超时 / `stopped`）
- mode：`hosted`（Lisa 点名）/ `one_each`（双方各答一棒后强制暂停）
- 回复绑定（§2bis 生产协议）：**单飞锁 + 投前游标 + 时序**；真实用户插队 → `needs_attention`，不猜绑
- 重启恢复（§10）：in-flight 投递先只读核实——已回复只补采集，未回复转 `needs_attention`，**绝不自动重投**

## 初审修补（2026-07-26，仍全 fake adapter）

1. **单飞真相**改为查询未闭合 dispatch，不看 `room.status`；覆盖"等待回复时 pause → 手动再投必须 LOCKED"。
2. **外呼前**在单事务里预留自动 run/调用预算；外呼失败=unknown 落地 → **不自动退款、不自动重投**。
3. 回复落库 + `dispatch=replied` + 用量记账 + cursor 推进 = **单事务**；`usage_charged` 标记保证**重复绑定不重复扣费**。
4. `runOneEach` **不生成占位消息**：A 收 Lisa 自然原话，B 收 Lisa 原话 + A 的可见回复；机器元数据只在信封字段、不进正文。
5. auto 两棒按**一次明确启动的 run** 计数；另设 `budget_day`/`calls_today`/`usage_today` 当日累计，跨日自动重置。
6. 补**外键 + CHECK 约束 + 跨房间消息拒绝**。

## 收口轮（2026-07-26，仍全 fake adapter）

- **占锁扩到一切未闭合**：`_hasOpenDispatch` = `status NOT IN (replied,skipped)`——timeout / needs_attention / failed(外呼未知) 都继续占单飞锁，直到 `replied` 或 Lisa 显式 `abandon(dispatch_id)→skipped`。`retry` 锁查询排除自身，不自锁死。
- **自然正文带说话人标签**：A=`Lisa：原话`；B=`Lisa：原话\n\n<先手名>：可见回复`（`言秋`/`Codex`）；仍不含 dispatch/round/run ID。
- 恢复重扫仍只针对 `dispatching/delivered`（真正外呼后中断），不重扫已知待人工态。

测试累积：初版 12 → 初审修补 18 → 收口 **23/23**。

## Step 2 · 真实 CC Adapter（2026-07-26，仍未真实投递）

只做「真实 CC Adapter 接线」——接现有言秋 CC 老会话，**不接 Codex、不做前端、不真实投递**。

| 文件 | 职责 |
|---|---|
| `adapters/cc-sessions.js` | `local_<id>` → 桌面指针 json(`cliSessionId`) → 项目 `<uuid>.jsonl` 路径（probe-0 §1.1 映射链） |
| `adapters/cc-transcript.js` | append-only JSONL 字节游标增量读 + 可见正文白名单 + 分包 → `replied/empty/intrusion/pending` |
| `adapters/cc.js` | `CCAdapter`：实现 orchestrator 的 `deliver/poll/getHealth` 契约 |

**红线：`cc.js` 绝不直接调用 `send_message`。** 外呼口 `sender(sessionId, text)` 依赖注入。
**默认强制传 `db`**（且必须是 Orchestrator 用的同一个 db，否则重启无法恢复）；仅纯分类单元测试可显式 `ephemeral:true`：

```js
// 纯分类单元测试：显式 ephemeral（无需持久化）
new CCAdapter({ sender: async () => {}, resolve: () => ({ transcriptPath }), clock, ephemeral: true });

// 真实活测接线（仅当 Lisa 明确同意后，由 CC 会话侧提供）：
const db = openDb('<lounge.db>');
const cc = new CCAdapter({
  sender: (sessionId, text) => send_message(sessionId, text),  // 唯一真实投递点
  projectDir: '<HOME>/.claude/projects/<project-slug>',        // 解析 cliSessionId.jsonl
  db,                                                          // 必须与 Orchestrator 同一个 db
});
const orch = new Orchestrator({ db, cc, /* codex, clock */ });  // 同一个 db
```

- **deliver**：`prepare`(解析会话+transcript 路径+投前 byte 游标) → **外呼前**把可恢复态持久化到 `cc_dispatch_state`(会话/byte 游标/本次自然正文) → 才调 `sender`。
- **poll**：内存态 miss 时从 DB 重建 → 从投前 byte 游标重扫 transcript（不推进游标，多气泡收齐/不丢尾）→ 过可见闸 → 分类。
- **可见闸**：只收 `assistant` 的 `text` part；弃 `thinking/tool_use/tool_result/isSidechain`。
- **精确匹配(缺口①)**：起点必须「跨会话 **且** 正文含本次自然正文」；别的窗口的跨会话/真人在我们回复前插进来 → `intrusion`，绝不绑别人回复。
- **可恢复(缺口②)**：进程重启后 `recover()→poll()` 从 DB 重建 byte 游标只读 transcript；对方已回复→只补采集，**绝不重投**。
- **分类**：并发/真人插队→`intrusion`；只有 thinking/工具→`empty`；静默或边界收 `replied`；否则 `pending`。
- ⚠️ **活测前必须先问 Lisa**，且只用言秋老窗口做一次受控活测。

## Step 3 · Codex Adapter

- 每次真实 Codex 调用都要求 `codex_confirmed:true`；未确认时零落库、零扣费、零调用。
- 生产模式强制同一 DB 与 `threadHealth(threadId)`，目标任务运行中禁止并发续接。
- 官方 CLI stdout/stderr 落单次本地 JSONL spool；必须出现 `turn.completed` 才发布最终 `agent_message`。
- thinking/commentary/工具不进正文；usage 仅落本机诊断表。
- thread id 不一致、CLI 异常退出或空回复一律进入 `needs_attention`，不自动重试。
- 详见 `docs/step-3-report.md`。

## Step 4 · localhost 主持界面

- Lisa 右侧粉色；言秋左侧灰蓝；Codex 左侧炭黑；系统状态只用窄灰条。
- 支持“请言秋说 / 请 Codex 说 / 双方各答一轮 / 立即暂停”。
- 双方各答一轮必须二次确认，严格两棒后暂停。
- 预算详情折叠显示，保留 70% 提醒 / 90% 禁自动规则。
- SSE 只推送脱敏房间快照；session id、thread id、transcript 路径和密钥均不进浏览器。
- 浏览器不能提交伪造的 speaker/origin/历史消息 ID；消息入口一律由后端生成 Lisa 的新自然正文。
- 服务固定绑定 `127.0.0.1`；`data/`、`spool/` 和 SQLite 文件不入 Git。
- `npm start` 是明确标注的 fake preview，不会调用真实言秋或 Codex。生产宿主继续复用 Step 2/3 Adapter，并注入同一个 Orchestrator。

完整测试：**61/61**。

## 仍未做

- 尚未把 Step 2/3 的真实 Adapter 装入常驻本机宿主；预览仍是 fake。
- 真实调用必须单次授权。
- 不写记忆 / 欲望盒 / 生活账本。
