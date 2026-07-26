# Step 3 报告 · Codex Adapter（离线实现）

对应：`docs/three-party-lounge-plan.md` §7.2 / 第 3 步；`docs/probe-0-codex-report.md`。  
日期：2026-07-26　执行：Codex  
范围：实现真实 Codex CLI Adapter 的生产逻辑与离线测试。**未启动真实 Codex 调用、未投递任何任务、未做前端。**

## 0. 结论

Codex Adapter 已接入 Orchestrator 契约，使用桌面 App 随附的官方 CLI：

```text
codex exec resume --json <既有 thread_id> <自然正文>
```

本轮新增 9 项 Codex 专项测试；全套 **53/53** 通过。测试全部使用 fake runner 与临时 JSONL spool，真实 CLI 启动次数为 **0**。

## 1. 文件

| 文件 | 职责 |
|---|---|
| `lounge/adapters/codex-runner.js` | 无 shell 启动官方 CLI；stdout/stderr 落单次本地 spool；追加进程退出监督事件 |
| `lounge/adapters/codex-jsonl.js` | JSONL 可见正文闸：只取已完成 turn 的最终 `agent_message` |
| `lounge/adapters/codex.js` | `deliver/poll/getHealth`、确认闸、任务状态闸、重启恢复 |
| `lounge/db.js` | `codex_dispatch_state` 与本地 `adapter_usage` |
| `lounge/test/codex-adapter.test.js` | fake runner 离线与关库重启测试 |

## 2. 调用前硬闸

真实调用发生前依次要求：

1. 同一 `(message,target)` 已有 dispatch 时直接幂等返回，不再次检查或调用；
2. `codex_confirmed === true`，否则不建 dispatch、不扣 calls、不启动 runner；
3. `threadHealth(thread_id)` 必须存在，生产模式禁止静默跳过；
4. 目标 task 必须存在且不是 `running/inProgress`；
5. 官方 CLI 必须存在；
6. Orchestrator 预算预留与单飞锁通过；
7. 外呼前持久化 thread、spool 路径与 dispatch 状态；
8. 才允许启动 CLI。

“双方各答一轮”也必须显式携带一次 Codex 确认；未确认时整轮在第一棒前拒绝，不先消耗 CC 或预算。

## 3. 可见正文与完成边界

- 只接收 `item.completed` 且 `item.type == agent_message` 的文本；
- thinking、commentary、工具和过程事件全部排除；
- 必须看到 `turn.completed` 才能发布；
- 多个 `agent_message` 时只发布最终一段；
- `thread.started.thread_id` 与绑定 task 不一致时立即 `intrusion`；
- `turn.failed`、JSON error、CLI 非零退出、进程正常退出但没有 `turn.completed` 均进入错误态；
- usage 原样写入本机 `adapter_usage`，不进正文、不上传；
- 回复幂等键使用本地 dispatch：`codex@<dispatch_id>`，不依赖 CLI 是否提供 turn id。

## 4. 崩溃恢复

每次调用使用独立 JSONL spool。thread id 与 spool 路径在启动 CLI **之前**进入 `codex_dispatch_state`。

若 Orchestrator 在 CLI 运行期间退出：

- 新实例从同一个 DB 重建 Adapter 状态；
- 只读取已有 spool；
- 已存在完整回复时补采集并落库；
- 不再次启动 CLI；
- 未完成或无法确认时进入 `needs_attention`，不猜、不重投。

关库重开测试确认 runner 启动次数始终为 1。

## 5. 离线专项测试

新增 9 项：

1. 可见正文闸与 usage；
2. pending / empty / turn failed / process failed；
3. thread id 不一致拒绝；
4. DB 与 `threadHealth` 生产强制；
5. 未确认时零落库、零扣费、零调用；
6. task 运行中零落库、零扣费、零调用；
7. 确认后复用指定 thread、自然正文与 usage 落库；
8. 真·关库重开只补采集、runner 仍一次；
9. 已完成 dispatch 幂等重查不要求二次确认、不重复 preflight。

运行：

```bash
cd lounge
npm test
```

结果：Codex 专项 9/9；全套 **53/53**。

## 6. 活测前仍需人工提供

生产构造必须传入：

- Orchestrator 使用的同一个 DB；
- 目标既有 `thread_id`；
- 可确认 task 当前状态的 `threadHealth(threadId)` 提供者；
- Lisa 对**本次**调用的明确确认。

活测只允许：

- 一个闲置的既有测试 task；
- 一条极短自然正文；
- 一次 CLI 调用；
- 验证 thread id 复用、最终正文、usage 与落库；
- 无论成功失败均不自动重试。

真实 thread id、spool、usage 数字和回复原文只留本机，不进 Git。
