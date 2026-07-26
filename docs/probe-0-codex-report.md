# 第 0 步 · Codex 侧能力探针报告

对应施工图：`docs/three-party-lounge-plan.md` §7.2、§12 第 0 步  
日期：2026-07-26  
执行：Codex  
性质：能力探针与两次极短活体测试；未写 Adapter、Orchestrator 或前端，未新建任务。

## 0. 结论速览

| §7.2 五问 | 结论 |
|---|---|
| 能否向指定既有 Codex 任务投递 | ✅ 能 |
| 能否取得该任务的新最终可见回复 | ✅ 能 |
| 是否有稳定的 thread id、完成状态与增量边界 | ✅ 有 |
| 是否会意外新建任务 | ✅ 两条实测路径均续接原任务，没有新建 |
| 本地程序是否被允许使用该能力 | ✅ 官方随桌面 App 提供的 Codex CLI 可直接使用 |

一句话：**Codex 老任务的“定向续接 → 生成一轮 → 只取最终可见正文”全链路成立；但长任务的上下文成本可能非常高，生产版必须把额度闸置于功能闸之前。**

## 1. 只读能力

Codex 桌面连接器提供：

- 列出既有任务；
- 返回稳定 `thread_id`、任务状态、工作目录与标题；
- 读取指定任务的近期 turns；
- 区分 turn 的 `inProgress / completed / error`；
- 区分消息阶段：用户消息、commentary、最终 `agentMessage`、工具或文件事件；
- 使用分页 cursor 读取更早 turns。

对当前正在执行的任务做只读检查时，返回：

- 当前 turn 明确为 `inProgress`；
- 先前 turn 明确为 `completed`；
- commentary 与最终回复分型，没有把工作进度误作最终正文。

因此会客厅可见闸无需正则猜测，只接收：

```text
turn.status == completed
AND item.type == agentMessage
AND item.phase == final_answer
```

若走 CLI JSONL，则只接收该次进程中的最终 `agent_message`，并要求后续出现 `turn.completed`。

## 2. 桌面连接器活体投递

测试目标：一个已经闲置的既有 Codex 小任务。  
测试内容：不调用工具，只返回一行固定 ACK。

结果：

- 定向投递成功；
- 原任务中新增一个 turn；
- 约 11 秒完成；
- 最终可见正文精确为目标 ACK；
- `thread_id` 前后相同；
- 没有创建新任务；
- 读取结果明确包含本轮 user message 与最终 `agentMessage`。

连接器会把跨任务投递包装为带来源信息的 delegation，而非伪装成 Lisa 直接输入。这一来源边界应保留。

## 3. 本机程序活体投递

桌面 App 内附官方 CLI，支持：

```text
codex exec resume --json [SESSION_ID] [PROMPT]
```

受控测试使用同一个闲置既有任务，结果 JSONL 依次出现：

```text
thread.started  （返回原 thread_id）
turn.started
item.completed  （type=agent_message，正文为目标 ACK）
turn.completed  （含 usage）
```

结论：

- 本地 Orchestrator 可以直接续接指定既有任务；
- 不依赖 Codex 模型内部连接器；
- 不需要坐标点击、OCR、剪贴板或私有数据库写入；
- stdout 本身就是单次 dispatch 的天然结果流，不必扫整份任务历史猜哪条是回复；
- 原 `thread_id` 被复用，没有新建任务。

生产 Adapter 优先使用 CLI，而不是尝试调用桌面内部连接器。

## 4. 关键成本发现

本机 CLI 的一行 ACK 测试在 `turn.completed.usage` 中报告了非常大的输入与缓存数字，而真正可见输出仅一行。

该 usage 可能受到长任务历史、缓存统计口径或累计口径影响；本探针不继续烧额度追查口径。无论具体计费口径如何，它都证明：

1. “发一句短消息”不等于“便宜的一轮”；
2. 续接超长老任务时，模型仍可能携带巨量历史上下文；
3. 三方会客厅若频繁自动叫 Codex，会迅速消耗额度；
4. v1 绝不能默认自由讨论或后台自动续聊。

生产硬闸：

- `max_auto_turns = 2` 保持不变；
- Codex 每次调用前必须由 UI 明示并计数；
- 默认使用 Lisa 主持；
- “双方各答一轮”必须二次确认；
- 同一时间只允许一个 Codex dispatch；
- 当前 task 状态为 `active/inProgress` 时禁止 CLI 并发续接；
- 达到房间预算后自动禁用 Codex 自动发言；
- usage 原样落本地诊断，但不上传公网；
- v1 观察期必须测“每轮真实额度变化”，不能只看字符数估价。

## 5. 推荐 Codex Adapter 契约

```ts
sendToCodex(envelope):
  1. 确认绑定 thread_id 与 host
  2. 检查 room 单飞锁
  3. 检查目标任务不是 active/inProgress
  4. 检查额度/轮数预算
  5. 启动官方 CLI：
       codex exec resume --json <thread_id> <natural_prompt>
  6. 保存子进程 pid、dispatch_id、started_at
  -> { accepted:true, dispatch_id }

waitForCodexReply(dispatch_id, timeout_ms):
  1. 逐行解析该子进程 stdout JSONL
  2. 只保存最终 agent_message 可见正文
  3. 收到 turn.completed 才封包成功
  4. 收到 turn.failed / 进程异常 / 超时：
       room -> needs_attention
  5. 保存 usage 诊断并释放单飞锁
  -> VisibleReply

getCodexHealth():
  - CLI 是否存在且版本可读
  - 目标 thread 是否仍存在
  - thread 状态是否可续接
  - 是否已有 dispatch 占锁
```

## 6. 正文与元数据边界

与 CC 侧结论保持一致：

- `room_id / round_id / dispatch_id` 只留在 Orchestrator；
- 不要求 Codex 回吐机器 token；
- 投给 Codex 的正文自然标明来源，例如“言秋说：……”；
- 不冒充 Lisa；
- 不把 thinking、commentary、工具事件或 usage 当正文；
- CLI stdout 与当前 dispatch 天然绑定，不需要用回复内容做关联；
- 最终只向会客厅发布 `completed` turn 的可见 `agent_message`。

## 7. 五问正式回答

### 7.1 能否向指定既有 task 投递？

能。桌面连接器与官方 CLI 都已实测。

### 7.2 能否订阅或轮询新最终回复？

能。桌面连接器可读 turns；本地生产方案更适合直接消费 CLI `--json` 的单次 stdout 事件流。

### 7.3 能否稳定获得 thread id、游标和完成状态？

能。

- `thread_id` 稳定；
- 每轮有 turn id；
- 状态包含 started/completed/error；
- CLI 单进程 stdout 是天然增量边界；
- 桌面读取另有分页 cursor，可用于人工诊断。

### 7.4 会不会新建任务？

不会。两次测试都返回并更新原 `thread_id`。生产实现仍需在运行后核对 `thread.started.thread_id == room 绑定 id`；不一致立即停止。

### 7.5 本地程序是否被允许使用？

允许。能力由桌面 App 内附的官方 Codex CLI 暴露，无需调用私有接口。生产实现不得改写 Codex 内部数据库或依赖 UI 自动点击。

## 8. Step 0 联合结论

```text
CC 老窗口：
  定向投递 ✅
  暖/冷唤醒 ✅
  游标增量回读 ✅
  可见正文闸 ✅

Codex 老任务：
  定向续接 ✅
  原任务复用 ✅
  最终正文事件流 ✅
  完成状态与 usage ✅
  本地程序入口 ✅
```

因此，从能力上可以进入 Step 1（本地数据层与状态机）。

但进入条件附加一条：

> Step 1 必须先实现额度预算、单飞锁和手动暂停，再实现任何真实 Adapter 调用；不能把成本保护留到前端收尾阶段。

## 9. 本探针未做

- 未向当前正在使用的 Codex 老任务发测试消息；
- 未新建任务；
- 未写 Adapter、Orchestrator 或前端；
- 未接记忆、人格、欲望盒子或 App 写路；
- 未测试 Codex 与 CC 自动互答；
- 未将真实 thread id、绝对路径或 usage 数字写入报告；
- 未触碰用户已有的 `supabase/photo_bridge.sql` 修改。
