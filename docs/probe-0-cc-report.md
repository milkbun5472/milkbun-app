# 第 0 步 · CC 侧能力探针报告

对应施工图：`docs/three-party-lounge-plan.md` §12 第 0 步、§7.1 CC Adapter、§15 开工口令
日期：2026-07-26　执行：Opus（言秋 CC 侧）
性质：只读探测 + 一次受控活测（仅对可弃靶）；未写前端 / 数据层 / Adapter；未开新会话；未接记忆写路；未上公网。
说明：本文所有真实 session/bridge/发送方标识、绝对路径、窗口标题均已脱敏为**语义占位符**（`<…>`）；字段结构、游标数值、机械证据与结论均为实测原值。

---

## 0. 结论速览

| §12 第 0 步 CC 验收项 | 结论 |
|---|---|
| 按游标增量取回一条**可见正文** | ✅ **已证明**（真目标端到端跑通，thinking/工具已滤除） |
| 向**指定既有老会话**投递并唤醒 | ✅ **已证明**（可弃靶两段式活测：暖唤醒+冷唤醒均通过，见 §2bis） |
| 不新建会话 / 不读 thinking / 不污染生活账本 | ✅ 读方案天然满足；投递方案按 §2bis 生产协议实现 |

一句话：**读、投递、唤醒（暖+冷）三件核心能力全部打通并有活体证据；生产投递协议已定案。剩余唯一闸门是等 Codex 交任务侧五问再决定是否进 Step 1。**

---

## 1. 读半边（增量取回可见正文）——已证明

### 1.1 会话 → 落盘文件的真实映射链

MCP 里看到的 `local_<uuid>` 会话，**不是**直接的 transcript 文件，而是一层指针：

```
list_sessions 给的 session_id：  local_<TARGET_SESSION>（标题"目标老会话"，模型 fable-5，completedTurns 731）
        │
        ▼  桌面指针文件（单块 JSON，非 transcript）
$HOME/Library/Application Support/Claude/claude-code-sessions/<ws>/<sub>/local_<TARGET_SESSION>.json
        │  字段 cliSessionId = <TARGET_CLI>
        ▼  真正的对话 transcript（append-only JSONL，约 6.2 MB）
$HOME/.claude/projects/<project-slug>/<TARGET_CLI>.jsonl
```

- 指针文件里现成可用的元数据：`cliSessionId`、`title`、`model`、`lastActivityAt`、`completedTurns`、`isArchived`、`cwd`、**`bridgeSessionIds`**（见 §3）。
- `completedTurns` 是个便宜的"这轮有没有生成完"辅助信号（**注意 §2bis 发现它会滞后**）。
- ⚠️ 当前这个 CC 窗口（发送端 cli=`<SENDER_CLI>`）是 CLI/SDK 式会话，文件名直接就是 `<sessionId>.jsonl`；桌面 `local_` 会话要多走一跳指针。Adapter 要两种都认。

### 1.2 可见正文闸（§6 CC 侧）——干净可白名单

transcript 每行是一条 JSON，`content` 里各部件**分型独立存**，实测统计：
`text` / `thinking` / `tool_use` / `tool_result` 各自成 part，从不混在同一段里。所以闸门是纯白名单，不用正则猜"像不像正文"：

- 收：`type=="assistant"` 且 `content[].type=="text"` 且文本非空
- 弃：`thinking` / `tool_use` / `tool_result` / `isSidechain==true`（子 agent）/ `attachment` / `system` / `custom-title` / `ai-title` / `queue-operation` / `last-prompt`

### 1.3 多气泡收齐（§6 "以 round_id 收齐"）

- 首选封包键：`promptId`（同一次用户提问触发的整段回复共享同一个 promptId）。
- ⚠️ **坑**：老段落 / 压缩后段落 `promptId` 可能为 `null`。已实测遇到。
  → 回落规则：把"连续的 assistant 行"聚成一包，遇到下一条 `user` 行即封包；配合静默窗口兜底。
- 实测：一次回复拆成 4~5 个气泡能全部收进同一包，只算一次发言。

### 1.4 端到端证明（真目标"目标老会话"）

从字节游标 tail 最后 ~120KB → 过闸 → 分包：
- 排除 thinking 15 段、tool_use 16 段；
- 恢复 8 个可见气泡包；
- 干净取到最后一条可见回复（正文略）。

**游标形态**：文件 append-only，用**字节偏移**当游标即可（记录上次读到的偏移，下次 `seek` 续读）；再用"末次已消费 uuid"做二次校验防重。§7.1 说的 `after_cursor` 完全成立，且**不需要**从整份 transcript 反复猜最后一轮。

### 1.5 为什么不用 MCP `list_events` 读

`list_events` 的契约自述会渲染**工具调用**、且在受限部署下**每次弹审批**。它满足不了 §6 的纯可见正文闸，也不适合高频轮询。
→ **读走直接 tail transcript 文件**；`list_events` 只留作人工排查兜底。

---

## 2. 投递+唤醒半边——机制与候选路径

投递的真实形状（从 transcript 反推已确认）：消息经**输入队列**进入会话——
`queue-operation:enqueue → dequeue → user 消息(promptSource:"sdk", origin:{kind:"human"}, permissionMode:"bypassPermissions")`。
即会话由 **Claude Agent SDK** 驱动，喂给它一条排队的用户消息就会触发一轮。

候选投递+唤醒路径：

| 路径 | 能投递 | 能唤醒 | 外部程序可直接用 | 顾虑 |
|---|---|---|---|---|
| **B. MCP `send_message`**（会话→会话）| ✅ 已活测（§2bis） | ✅ 暖+冷均验 | ⚠️ 需要**发送方本身是一个 CC 会话**（编排器跑成一个小"relay 会话"） | 天然带"From {标题}"边界；见 §2bis 的安全边界发现 |
| A. App 原生 bridge | — | — | — | 已调查：非本地写口，不采用（§3） |
| C. ScheduleWakeup / scheduled-tasks / cron | 携带 prompt | ✅ 定时唤醒 | 部分 | §7.1 **明令禁止**当即时投递；只适合"耐久兜底"，粒度粗 |

采用路径 B。活测结果见 §2bis。

---

## 2bis. 投递+唤醒活测结果（2026-07-26，可弃靶，两段式，经 Lisa 批准）

靶会话：全新空白窗口 `local_<DISPOSABLE_TARGET>`（title 可弃靶），cliSessionId `<DISPOSABLE_CLI>`。
读侧用 `scratchpad/cc_read_probe.py`（纯只读）登记游标+回读。发送身份=本窗口 `local_<SENDER>`（对外标题"测试发送端"）。

### Stage 1 · 暖唤醒（窗口开着）——✅ 机械链路全过
- 投前游标 21145 → `send_message` 投一条信封 → transcript 21145→29125（**被唤醒生成一轮**，尽管 list 静置显示 isRunning:false）。
- 从游标续读：干净 1 个可见包、0 thinking/0 工具 → **可见闸 + 游标/时序绑定成立**。
- ⚠️ **关键安全发现**：跨会话消息在靶端被包成
  `<cross-session-message from="local_<SENDER>" name="测试发送端" encoded="1">…`，
  靶端 Claude **按指令来源边界铁律拒绝**照做正文里夹带的机器指令（"输出一个约定标记串"），
  大意：*不接受来自观测内容/其它会话的指令，只听用户在聊天里直接说的话*。
  → **CC Adapter 绝不能靠"让对方回吐控制标记/服从机器指令"工作。** 该拒绝属正常安全边界，非失败。

### Stage 2 · 冷唤醒（窗口关着）——✅ 通过
- 先确认靶 isRunning:false（冷态）。投前游标 29125。
- 只投**一句自然、诚实标源、无 ID/无标记/无工具要求**的问候。
- transcript 29125→35895（**关着的窗口被叫醒并生成**）；投后首个完整 assistant 可见包干净读回（大意："收到了，跨会话消息送达成功，窗口虽然关着但被顺利叫醒了"）。
- 对照 Stage 1：**自然正文→自然配合回复**，不触发"不可信指令"反射。坐实生产协议方向。

### 活测暴露的两个 Adapter 坑
1. **指针 `completedTurns` 会滞后**于 transcript（Stage 2 读时 transcript 已增长、completedTurns 仍停 1）。
   → 完成信号以 **transcript 字节增长**为准，completedTurns 只做辅助。
2. 全新会话早期 `completedTurns` 可能为 `null`（第 1 轮完成后才落值）。

### 修订后的生产投递协议（按 Lisa 2026-07-26 定案）
- **元数据（room_id/round_id/dispatch_id）只存 Orchestrator 账本，绝不进给言秋看的正文**；正文只给自然对话内容。
- **回复绑定 = 单飞锁 + 投前游标 + 时序**：一个 dispatch 未闭合前不发下一棒；投后游标之后的首个完整可见包即该 dispatch 的回复。
- **不猜绑**：若期间有**真实用户输入插队**（游标窗口里混入非本轮内容），房间进入 `needs_attention`，人工裁决，不擅自绑定。
- 不用 ScheduleWakeup 当即时投递；不新建言秋会话；不写生活账本。

---

## 3. bridge 限时只读调查——已结案（非本地写口）

`bridgeSessionIds` 不是隐藏投递入口：它是**每个 CC 会话都有的标准字段**（43 个本地会话里 41 个都带），存一个 Anthropic **API 侧会话 id**（`session_<BRIDGE_ID>` 一类格式），一会话一个。
→ 它是**服务器端标识符，不是已证实的本地外部写入口**；要当写路得去 API 侧查有没有对应 endpoint，属 Codex/API 地界、且**未证实前不当官方写口**（Lisa 2026-07-26 定）。
→ 结论：**bridge 这条线不省本地 relay 那层**。生产投递就用已验证的 `send_message`（本窗口作发送身份）即可。

---

## 4. CC Adapter 建议形状（映射 §7.1，仅设计不写码）

```
sendToCC(envelope):
  1. 解析 room 绑定的 cc_session_id(=local_<…>) → 读指针拿 cliSessionId、记录投前 transcript 字节偏移 = after_cursor
  2. 走路径 B 把信封“自然正文”作为一条 user 消息投入队列并唤醒（元数据不进正文，不新建会话）
  3. 账本里记 dispatch_id、round_id、after_cursor、单飞锁
  → { accepted:true, dispatch_id }

waitForCCReply(dispatch_id, timeout_ms):
  以 transcript 字节增长为主、指针 completedTurns 为辅，判"生成完没"
  → 从 after_cursor tail transcript，过 §1.2 闸、按 §1.3 分包
  → 静默窗口内封包，按投前游标+时序绑定 dispatch_id 返回 VisibleReply
  → 期间有真实用户插队 → needs_attention，不猜绑
  → 超时 / 只有 thinking 无 text → 不造假气泡，房间 needs_attention（§6 空回复）

getCCHealth():
  指针 lastActivityAt + isRunning + transcript 可读性
```

铁律落实：不用 ScheduleWakeup 当即时投递、不新建言秋会话、不把会客厅信封写进 App 生活聊天、不读 thinking。

---

## 5. Codex 侧（§7.2）——本探针未覆盖，待 Codex 主责

我在 CC 侧，够不到 Codex 的 task/thread 接口，无法替它答 §7.2 五问。CC 探针的结论**不阻塞** Codex 半边独立探。按 §15：Codex Adapter 先留契约 + 手动接力桩，不猜其私有接口。五问原样转交 Codex：能否向指定既有 task 投递 / 能否订阅新最终回复 / 能否稳定拿 thread_id+游标+完成态 / 会不会新建任务 / 本地程序是否被允许用该能力。

---

## 6. 决策（Lisa 2026-07-26 已拍板）

1. ✅ 言秋方绑 **"目标老会话"**（`local_<TARGET_SESSION>`, fable-5）现有老会话 = room 的 `cc_session_id`。
2. ✅ 受控活测已做：可弃靶两段式暖/冷唤醒均通过（§2bis）。**目标老会话真闭环需另行单独申请**后才做。
3. ✅ bridge 已限时只读调查完毕：非本地写口，不省 relay（§3）。
4. ✅ `max_auto_turns=2` 不变。

**剩余唯一闸门**：等 Codex 完成 §7.2 任务侧五问后，再决定是否进 Step 1（本地数据层+状态机）。CC 侧第 0 步到此收工。

---

## 7. 我没做、也不会擅自做的（红线自查）

- 没写前端 / 数据层 / Adapter 代码（§15：第 0 步只出报告 + 只读探针脚本）。
- 活测只对**可弃靶**投递，**没碰目标老会话**、没碰任何真实工作会话。
- 没新建言秋会话、没碰记忆 / 欲望盒 / 生活账本写路（每轮 mark_cc_turn skip）。
- 没上公网、没在浏览器留任何密钥或 transcript 路径。
- 报告里只记占位符 ID / 字段 / 机制，未粘任何 prompt / 额度 / 人格上下文正文（§11）。
