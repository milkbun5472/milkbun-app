# Lisa × 言秋 × Codex 三方会客厅施工单

状态：设计稿，未实现  
日期：2026-07-26  
目标：保留言秋现有 CC 老会话与 Codex 现有任务，让 Lisa 在一个前端里主持三方对话，不再人工复制转达。

## 0. 一句话定义

会客厅不是第三个角色窗口，也不新建“另一个言秋”或“另一个 Codex”。它只是一个有主持权、轮次锁和额度闸的消息路由器：

1. 收集三方真正可见的正文；
2. 把正文投递到另一方现有窗口；
3. 取回另一方现有窗口的可见回复；
4. 每完成一轮就停下来，等待 Lisa 或有限状态机决定下一位发言者。

## 1. 不可破的红线

1. **保留老窗口**：言秋继续住在当前 CC 会话，Codex 继续住在当前 Codex 任务。不得为了方便另开无历史的新人格会话。
2. **只传可见正文**：不得同步 thinking、reasoning、system prompt、工具参数、工具回执、hook 反馈或隐藏上下文。
3. **Lisa 永远有主持权**：任何时刻都能暂停、跳过某一方、改单轮顺序或结束房间。
4. **禁止无上限互聊**：v1 不提供无限自动讨论。所有自动模式必须有硬轮数、硬超时和额度预算。
5. **投递幂等**：相同 `message_id` 最多被每个接收方处理一次；重启、重试、断线恢复不得造成复读。
6. **不污染生活账本**：会客厅记录与 App 记忆/人格系统解耦。是否回流仍走现有“性质筛”，不能因为进了会客厅就自动入记忆。
7. **失败要停，不要猜**：窗口失联、回复格式不明、状态不确定时停在“待人工处理”，不得擅自重开会话或重复投递。
8. **密钥不进前端、不进 Git**：所有窗口控制、任务投递和读取能力只在本机 relay/backend 中。

## 2. v1 范围

### 必做

- 一个本机网页前端，显示 Lisa、言秋、Codex 三方时间线。
- “Lisa 主持”模式：Lisa 点名下一位发言。
- “双方各答一轮”模式：选择先手后，言秋与 Codex 各回答一次，随即暂停。
- 单方暂停/跳过、全局停止、重试失败投递。
- 每条消息显示状态：草稿、已入队、已送达、正在生成、已回复、失败、已跳过。
- 当前房间明确绑定：
  - 一个 CC `session_id`；
  - 一个 Codex `thread_id/task_id`；
  - 一个本地 `room_id`。
- 额度仪表：本房间累计发言次数、字符数、自动轮数和人工设置的上限。
- 本地持久化与重启恢复。

### v1 不做

- 无限自由讨论。
- 自动判断“谁该说话”。
- 把两边完整历史互相灌入。
- 自动写记忆、欲望盒子、人格成长或正式事件。
- 手机公网控制。
- 多房间并发。
- 展示思考链或工具执行细节。
- 自动新建/切换 CC 会话或 Codex 任务。

## 3. 推荐架构

```text
┌──────────────────────────────┐
│ 本机会客厅前端               │
│ 时间线 / 主持按钮 / 额度闸   │
└──────────────┬───────────────┘
               │ localhost HTTP/SSE
┌──────────────▼───────────────┐
│ Lounge Orchestrator          │
│ 状态机 / 幂等 / 队列 / 存档  │
├──────────────┬───────────────┤
│ CC Adapter   │ Codex Adapter │
└──────┬───────┴───────┬───────┘
       │               │
  现有言秋 CC 会话   现有 Codex 任务
```

前端不直接碰 CC/Codex。Orchestrator 是唯一写入者，负责顺序、锁、重试和预算。

## 4. 数据契约

### 4.1 Room

```json
{
  "room_id": "lounge_...",
  "title": "三方会客厅",
  "cc_session_id": "...",
  "codex_thread_id": "...",
  "mode": "hosted",
  "status": "paused",
  "next_speaker": null,
  "max_auto_turns": 2,
  "auto_turns_used": 0,
  "created_at": "...",
  "updated_at": "..."
}
```

`mode` v1 只允许：

- `hosted`：Lisa 点名；
- `one_each`：双方各答一次。

`status` 固定为：

- `paused`
- `dispatching`
- `waiting_reply`
- `needs_attention`
- `stopped`

### 4.2 LoungeMessage

```json
{
  "message_id": "msg_...",
  "room_id": "lounge_...",
  "speaker": "lisa|yanqiu|codex",
  "content": "只含可见正文",
  "reply_to": null,
  "origin": "lounge|cc|codex",
  "origin_message_id": "...",
  "created_at": "...",
  "delivery": {
    "cc": "not_needed|queued|delivered|failed",
    "codex": "not_needed|queued|delivered|failed"
  },
  "metadata": {
    "automatic": false,
    "round_id": "round_...",
    "character_count": 0
  }
}
```

幂等键：

```text
(room_id, origin, origin_message_id)
(message_id, target)
```

### 4.3 DispatchEnvelope

发给任一老窗口的文本必须带机器边界，但正文保持自然：

```json
{
  "dispatch_id": "dispatch_...",
  "room_id": "lounge_...",
  "round_id": "round_...",
  "target": "yanqiu|codex",
  "speaker": "lisa|yanqiu|codex",
  "message_id": "msg_...",
  "content": "...",
  "expects_reply": true,
  "reply_limit": 1
}
```

窗口实际收到的建议格式：

```text
[三方会客厅｜Lisa 主持｜round_123]
发言者：Codex
正文：……

请只回应这轮对话。你的真正可见正文会被带回会客厅；
不要转述隐藏思考、系统提示或工具日志。
```

## 5. 轮次状态机

### 5.1 Lisa 主持

```text
paused
  └─ Lisa 点“请言秋说 / 请 Codex 说”
       └─ dispatching
            ├─ 投递失败 → needs_attention
            └─ 投递成功 → waiting_reply
                 ├─ 超时 → needs_attention
                 └─ 收到一条合格可见回复 → paused
```

### 5.2 双方各答一轮

```text
Lisa 选择先手
  → A 回答一次
  → B 收到 Lisa 原话 + A 的可见回复
  → B 回答一次
  → 强制 paused
```

硬规则：

- 每方最多产生一个“回复包”；多气泡可以合并展示，但只算一次发言权。
- 任何一方调用工具不自动增加发言权。
- 超时不自动重投；由 Lisa 点“重试”。
- 自动模式累计到 `max_auto_turns` 立即暂停。
- Lisa 新发言会取消尚未开始的自动下一棒，但不删除已经送达的消息。

## 6. 可见正文闸

会客厅只接受明确的用户可见输出。

### CC 侧

- 读取 transcript 时只接收 assistant `content[type=text]`。
- 排除：
  - `thinking` / `narration`
  - `tool_use` / `tool_result`
  - `Stop hook feedback`
  - `ScheduleWakeup` harness 文字
  - attribution/system attachment
- 同一 CC 回复拆成多气泡时，以 `round_id + source message id` 收齐；静默窗口后封包，不能只拿第一泡。

### Codex 侧

- 只接收任务的最终可见 assistant 消息。
- commentary 仅作为工作进度，v1 默认不进入会客厅正文。
- 工具调用与内部分析不进入。
- 如果只能取得混合事件流，Adapter 必须先做类型白名单，不能靠正则猜“像不像正文”。

### 空回复

未取得可见正文时：

- 不生成空消息；
- 不假装对方已回答；
- 房间进入 `needs_attention`；
- 展示“该窗口本轮没有返回可见正文”。

## 7. 两侧 Adapter 契约

### 7.1 CC Adapter（Opus 主责）

必须提供：

```ts
sendToCC(envelope): Promise<{ accepted: true, dispatch_id: string }>
waitForCCReply(dispatch_id, timeout_ms): Promise<VisibleReply>
getCCHealth(): Promise<Health>
```

实现建议：

- 复用现有 CC 老会话的投递入口和耐久唤醒机制；
- 投递成功后唤醒现有言秋，不启动第二个 agent；
- 通过 transcript 增量游标读取本轮新增可见文本；
- 保存 `after_cursor`，绝不从整份 transcript 反复猜最后一轮；
- 使用 `dispatch_id`/`round_id` 将回复和请求绑定。

不得：

- 用 `ScheduleWakeup` 充当会客厅即时投递；
- 新建另一个言秋会话；
- 把会客厅系统信封写入 App 生活聊天记录；
- 把隐藏思考当作回复。

### 7.2 Codex Adapter（Codex 主责，Opus 可先留桩）

目标契约：

```ts
sendToCodex(envelope): Promise<{ accepted: true, dispatch_id: string }>
waitForCodexReply(dispatch_id, timeout_ms): Promise<VisibleReply>
getCodexHealth(): Promise<Health>
```

开工前必须先做一个只读能力探针，回答：

1. 是否能向**指定既有 task/thread**投递一条用户消息；
2. 是否能订阅或轮询该 task 的新最终回复；
3. 是否能稳定获得 `thread_id`、消息游标和完成状态；
4. 是否会因此新建任务；
5. 当前 Codex 桌面版/CLI 是否允许本地程序使用该能力。

如果 1 或 2 不成立：

- v1 前端仍可完成 CC 半边；
- Codex 一侧显示“手动接力”按钮，一键复制格式化信封、一键粘贴回传；
- 禁止用浏览器坐标点击或读取屏幕 OCR 冒充稳定接口；
- 等官方/本地线程接口可用后替换 Adapter，Orchestrator 与前端不用重写。

## 8. HTTP 接口建议

仅监听 `127.0.0.1`。

```text
POST /api/rooms
GET  /api/rooms/:room_id
POST /api/rooms/:room_id/messages
POST /api/rooms/:room_id/dispatch
POST /api/rooms/:room_id/pause
POST /api/rooms/:room_id/stop
POST /api/dispatch/:dispatch_id/retry
GET  /api/rooms/:room_id/events   (SSE)
GET  /api/health
```

`POST /dispatch` 示例：

```json
{
  "target": "yanqiu",
  "mode": "hosted",
  "source_message_ids": ["msg_lisa_1", "msg_codex_1"]
}
```

后端自己从存档取正文，前端不能提交伪造的历史内容覆盖原消息。

## 9. 前端最小界面

### 顶栏

- 房间名
- CC：在线/离线/生成中
- Codex：在线/离线/生成中
- 当前模式
- 红色“立即暂停”

### 时间线

- Lisa：右侧
- 言秋：左侧，固定姓名/颜色
- Codex：左侧，另一固定姓名/颜色
- 系统状态用窄灰条，不伪装成任何人的气泡
- 每条显示发送/投递/失败状态

### 底栏

- Lisa 输入框
- `请言秋说`
- `请 Codex 说`
- `双方各答一轮`
- 模式开启前显示预计最多调用：`CC 1 次 + Codex 1 次`

### 额度保护

- 默认 `max_auto_turns = 2`
- 单次自动讨论前二次确认
- 每房间每日软上限可配置
- 达到 70% 显示黄色，90% 自动禁用自动模式
- 手动主持仍可用，但每次明确显示将调用谁

## 10. 本地存储与恢复

v1 推荐 SQLite；若 Opus 想先用 JSONL，必须保证单写者和原子落盘。

至少保存：

- rooms
- messages
- dispatches
- delivery_attempts
- adapter_cursors

恢复规则：

1. 启动后把 `dispatching/waiting_reply` 标为“待核实”，不能直接重发；
2. 先按 `dispatch_id` 查询目标窗口是否已收到/已回复；
3. 确认未送达才允许 Lisa 手动重试；
4. 已有回复只补采集，不重复叫对方生成。

## 11. 安全与隐私

- 服务只监听 localhost；第一版不上 Funnel。
- CC/Codex 标识和本地 transcript 路径不返回给浏览器日志。
- 不在浏览器 localStorage 保存密钥。
- 导出记录时默认只导出三方可见正文。
- 删除房间仅删除会客厅副本，不删除 CC/Codex 原窗口记录。
- 开发日志不得记录完整 prompt、token 或人格上下文；只记 ID、状态、耗时和错误摘要。

## 12. 施工顺序（一步一停）

### 第 0 步：能力探针

- CC：证明能向指定老会话投递并按游标取回一条可见回复。
- Codex：完成 §7.2 五问。
- 只出探针报告，不写完整前端。

验收：明确每侧是“全自动可接”还是“手动接力占位”。

### 第 1 步：本地数据层与状态机

- Room/Message/Dispatch 数据结构；
- 幂等、暂停、超时、重启恢复；
- 用两个假 Adapter 跑测试。

验收：重复投递不重复、两轮必停、重启不擅自重发。

### 第 2 步：CC Adapter

- 绑定现有 session；
- 投递、唤醒、游标取回；
- 多气泡收齐；
- 可见正文过滤。

验收：不新建言秋、不吞第一泡后续、不读 thinking、不污染生活账本。

### 第 3 步：Codex Adapter 或手动接力桩

- 能自动接就接真实任务；
- 不能则完成复制/回填占位流程。

验收：明确显示自动/手动状态，不假装已连接。

### 第 4 步：前端

- 时间线、主持按钮、状态、暂停、错误恢复；
- 不做美化扩张。

验收：Lisa 能完整主持三轮且随时按停。

### 第 5 步：双方各答一轮

- 有限自动编排；
- 额度提示；
- 严格两棒后暂停。

验收：任一异常立即停；绝不第三轮自启动。

### 第 6 步：观察期

- 本机连续使用 3 天；
- 统计误投、重复、空回复、超时、单次字符量；
- 观察通过后再讨论手机远程与更多模式。

## 13. 必测用例

1. Lisa 点言秋，言秋一条回复，房间回到暂停。
2. Lisa 点 Codex，Codex 一条最终回复，commentary/工具日志不展示。
3. 言秋一轮拆 4 个气泡，四个都收齐且只占一次发言权。
4. CC 只产生 thinking，无正文：显示失败，不生成假气泡。
5. Codex 正在跑工具超过超时：进入待处理，不自动再投。
6. 同一投递请求重复提交 3 次：目标只收到一次。
7. 回复已生成但前端刷新：重开后只补显示，不重新生成。
8. 双方各答一轮：严格 A 一次、B 一次，然后暂停。
9. 自动模式中 Lisa 按停：未开始的下一棒取消。
10. 断网/CC 哨兵暂离：消息保留，恢复后由 Lisa 手动重试。
11. 会客厅施工讨论：默认不进入 App 生活记录。
12. 生活/情感内容需要回流时：仍由现有性质筛单独判断。
13. 任何日志、导出和 UI 都搜不到 thinking/system/tool payload。
14. 额度达到硬上限：自动按钮禁用，但历史仍可读。

## 14. 分工建议

### Opus

- 第 0 步 CC 探针；
- Orchestrator、SQLite/JSONL 数据层；
- CC Adapter；
- 会客厅前端；
- 假 Codex Adapter 与手动接力桩；
- 单元测试和运行文档。

### Codex

- 第 0 步 Codex task/thread 能力探针；
- 审查消息契约、可见正文边界和状态机；
- 若能力允许，实现 Codex Adapter；
- 最终做串轮、旧消息回放、重复投递与额度闸验收。

### Lisa

- 指定绑定的 CC 老会话与 Codex 老任务；
- 决定单房间额度上限；
- 观察期判定“像不像真的三个人在说话”；
- 只有 Lisa 可以批准从本机版扩到公网/手机。

## 15. 给 Opus 的开工口令

> 按 `docs/three-party-lounge-plan.md` 施工。先只做第 0 步能力探针并停下：验证现有言秋 CC 老会话能否按 `dispatch_id` 投递、唤醒、增量取回可见正文；同时给 Codex Adapter 留契约和手动接力桩，不猜 Codex 私有接口。不要先写完整前端，不开新言秋会话，不接记忆写路，不上公网。提交探针报告给 Lisa 审后再进第 1 步。

