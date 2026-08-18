# 三方会客厅 · Orchestrator 与 Adapter

已完成 Step 1 本地状态机、Step 2 CC Adapter、Step 3 Codex Adapter，以及 Step 4 localhost 主持界面。
测试与 `npm start` 预览默认使用 fake sender/runner；真实入口必须经过 Lisa 单次明确授权。

## 运行

```bash
cd lounge
npm test          # = node --test test/*.test.js
npm start         # http://127.0.0.1:8092，本地 fake 预览
npm run start:live       # 真实言秋 + 真实 Codex（需先 setup:live）
npm run install:launchd  # Mac 登录后自动托管真实会客厅
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

### 三人斗地主牌桌

右上角「斗地主」打开独立牌桌。Lisa 勾选**仅本局**的自动叫醒授权后：

- 本机负责洗牌、叫分、合法牌型、轮转和胜负；模型不当裁判；
- 言秋和 Codex 每次只收到自己的暗牌与公开桌面，另外两家的暗牌不会下发到浏览器或对方窗口；
- 轮到 AI 时才定向唤醒对应原窗口，一手一次调用，出完重新等待；不会自动开下一局；
- 超时、投递失败、回复无法解析或非法出牌会立刻停桌，不猜牌、不代打、不自动重试；
- 牌局提示与动作留在本机审计链，但标为 automatic，不混进普通客厅时间线。

牌规 v1 已覆盖单张、对子、三张、三带一、三带二、顺子、连对、飞机、四带二、炸弹与王炸。

完整测试：**61/61**。

### 言秋 × Codex 互救台

页头「互救台」复用同一个真实宿主，提供四层能力：

- 一键保存言秋原 transcript、会客厅 SQLite（含 WAL/SHM）与脱敏运行体征；
- 查看 Fable、CC 工具桥、Relay、定时唤醒、watchdog 和会客厅的 launchd 状态；
- 生成只带脱敏体征的互救工单，先留检查点，再由 Lisa 明确点名递给另一方；
- 白名单桥单项重启，每次浏览器二次确认，重启前自动保存检查点。

历史 rewind 当前只提供候选检查点预演：真实执行会改写 CC 历史，必须等 Lisa 回到电脑后另行授权，不能由 localhost 页面自行解锁。检查点只存在 `~/Library/Application Support/Lisa Lounge/rescue/`，权限 0600，不进浏览器正文、Git 或云同步。

会客厅的生产运行副本、SQLite、配置和日志全部住在 `Application Support/Lisa Lounge`；仓库只是真源，安装脚本同步运行副本并做旧 DB 的一次性非破坏迁移。

## 真实宿主

真实宿主仍只监听 `127.0.0.1`：

- 言秋：复用 Stack-chan 已有的耐久 `wake_queue`，把 Lisa 自然正文写入同一唤醒信箱；不新建言秋、不多跑一层 relay 模型。
- 言秋自己写进 `lounge_outbox.jsonl` 的自然发言由宿主常驻增量收取，无需先有一张等待回复的 dispatch。正式回复链与主动收件人共用持久化字节游标：有未闭合投递时主动收件人让路，回复结案后推进同一游标，避免重启重放或一行两吃。
- CC 回收：可见闸同时识别原 `cross-session-message` 与 `kind=lounge/source=three_party_lounge` 的耐久唤醒记录。
- 哨兵完成产生的 `<task-notification>` 被视为系统唤醒，不再误判 Lisa 插队。
- 其它真人输入、语音、敲击在回复前插入，仍进入 `needs_attention`，绝不猜绑。
- Codex 支持两种经过同一 Orchestrator 安全闸的运输：旧的 Mac 官方
  `codex exec resume --json`，以及 VPS 专职正窗的 `vps_file_inbox`。当前生产
  客厅使用后者：自然正文经 SSH stdin 投进 VPS 文件信箱，最终可见回复才回到
  本地时间线；不开放公网端口、不把正文放进进程参数、不唤醒 Mac 施工任务。
- VPS 提交以 dispatch id 做幂等票；SSH 中断或页面重试只等同一封回复，不重新
  投递。每次真实 Codex 调用仍必须由 Lisa 在 UI 点名或确认双方各答一轮。
- `scripts/setup-live-config.js` 自动发现原言秋会话与当前 Codex task，将绑定写入 gitignored `data/live-config.json`，权限 `0600`，不打印具体 ID。
- `scripts/install-launchd.js` 生成用户级 LaunchAgent，登录自启、异常退出自动拉起。

真实 CC 接线受控活测：只投 1 次；初次因 `<task-notification>` 假阳性停下，修复后从同一投前游标只读重采，**没有重发**，最终 `replied`。

完整测试更新为：**99/99**。

## 仍未做

- 进入 3 天本机观察期；统计误投、插队、空回复、超时与真实额度变化。
- 真实调用继续要求 Lisa 单次点名或二次确认。
- 不写记忆 / 欲望盒 / 生活账本。
