# Step 3 · Codex Adapter 受控活测报告

对应：`docs/step-3-report.md` §6。  
日期：2026-07-26　执行：Codex  
范围：只续接一个已确认 `notLoaded` 的既有测试 task，只发一条极短自然正文，**全程只启动一次 CLI；成功失败均不自动重试**。

## 0. 结论：✅ 通过

真实链路完整打通：

```text
Lisa 单次确认
→ task 状态只读预检
→ Orchestrator 预算/单飞闸
→ codex exec resume --json <既有 thread>
→ 本地单次 JSONL spool
→ completed + 最终 agent_message 可见闸
→ reply/usage 原子落库
→ room paused
```

## 1. 验收结果

- 目标为既有闲置测试 task，不是当前工作窗口；
- CLI 只启动 **1 次**；
- `thread.started` 返回并复用原 thread id，没有新建 task；
- 桌面端只读复核：只新增本次一个 completed turn，随后恢复 `notLoaded`；
- 最终可见正文 1 段，过程事件未进入会客厅；
- `turn.completed.usage` 存在，包含输入、缓存、输出与推理相关字段；
- 本地 `dispatch.status=replied`；
- `codex_dispatch_state.state=completed`；
- `adapter_usage` 有且只有本 dispatch 的一条诊断；
- messages 中只有 Lisa 原文与 Codex 最终可见回复各一条；
- `room.status=paused`；
- 当日调用计数为 1；
- 未触发 retry、未启动第二个 CLI。

## 2. 数据边界

真实 thread id、完整 JSONL spool、原始 usage 数字、DB 和回复原文仅留本机临时私有目录，不进入 Git。本文只记录布尔结果、字段类别和状态。

## 3. 结论

Step 3 Codex Adapter 的真实能力、额度确认闸、既有 task 复用、完成边界、可见正文闸、usage 诊断与落库均通过。未发现需要代码修补的问题。

Step 3 可以封板。下一步可进入 Step 4：本地 HTTP/SSE 与三方会客厅前端；默认仍保持 Lisa 主持，不自动让两侧自由循环。
