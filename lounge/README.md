# 三方会客厅 · Orchestrator（Step 1）

对应施工图 `docs/three-party-lounge-plan.md` 第 1 步：**只做本地数据层 + 状态机**。
Adapter 一律用 fake，**不调用 `send_message` / `codex exec resume` / 任何真实模型**，**不含前端**。

## 运行

```bash
cd lounge
npm test          # = node --test test/*.test.js
```

零依赖：只用 Node 内置 `node:sqlite` + `node:test`（需 Node ≥ 22；本机 v26 已验）。

## 结构

| 文件 | 职责 |
|---|---|
| `db.js` | SQLite schema（rooms/messages/dispatches/delivery_attempts/adapter_cursors）+ WAL 原子 + 幂等唯一键 |
| `budget.js` | 额度预算闸：`max_auto_turns` 硬上限 + 日字符软上限（70% 黄 / 90% 禁自动）；手动主持不受 auto 上限约束 |
| `lock.js` | 单飞锁：一房间同时至多一个未闭合投递（进程内 Set + DB status 双保险） |
| `clock.js` | 可注入时钟（生产真实 / 测试可推进，无真实 sleep） |
| `adapters/fake.js` | Fake CC/Codex adapter：`deliver` 计数 + `poll` 脚本化，绝不碰真实接口 |
| `orchestrator.js` | 状态机唯一写入者：投递(begin/resolve 两段)、幂等、超时、预算、单飞锁、立即暂停、重启恢复 |
| `test/orchestrator.test.js` | §12 第1步 + §13 必测的 12 条验收 |

## 状态机（§5）

- room.status：`paused → dispatching → waiting_reply →`（`paused` 收到回复 / `needs_attention` 空回复·插队·超时 / `stopped`）
- mode：`hosted`（Lisa 点名）/ `one_each`（双方各答一棒后强制暂停）
- 回复绑定（§2bis 生产协议）：**单飞锁 + 投前游标 + 时序**；真实用户插队 → `needs_attention`，不猜绑
- 重启恢复（§10）：in-flight 投递先只读核实——已回复只补采集，未回复转 `needs_attention`，**绝不自动重投**

## 边界（Step 1 明确不做）

- 不写前端 / HTTP / SSE（第 4 步）。
- 不接真实 CC/Codex（CC Adapter 第 2 步、Codex Adapter 第 3 步）。
- 不写记忆 / 欲望盒 / 生活账本。
- Codex 半边契约见施工图 §7.2，等 Codex 五问后接线。
