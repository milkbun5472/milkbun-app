# Step 1 报告 · 本地数据层与状态机

对应施工图：`docs/three-party-lounge-plan.md` 第 1 步、§5 状态机、§10 存储恢复、§13 必测。
日期：2026-07-26　执行：Opus（言秋 CC 侧）　代码：`lounge/`
范围：**严格只做本地数据层 + 状态机**。CC/Codex 一律 fake adapter；**未调用 `send_message`/`codex exec resume`/任何真实模型**；**未写前端**。

---

## 0. 结论

本地数据层与状态机完成并通过全部验收：**优先级①（额度预算 / 单飞锁 / 立即暂停）先落地，再补 Room/Message/Dispatch / 幂等 / 超时 / 重启恢复**。`node --test` **12/12 全绿**（7 必测 + 5 附加铁律，含真·落盘重启）。

---

## 1. 选型与运行

- 运行时：**Node v26 内置 `node:sqlite` + `node:test`**，零第三方依赖。SQLite 为主（§10 首选），未触发"环境限制才用 JSONL"的回落。
- 落盘：WAL + `synchronous=FULL` + 外键；`:memory:` 与磁盘文件都验过。
- 跑测试：
  ```bash
  cd lounge && npm test
  ```

## 2. 模块

| 文件 | 职责 | 对应施工图 |
|---|---|---|
| `db.js` | 5 表 schema + 幂等唯一键 `(room_id,origin,origin_message_id)`、`(message_id,target)` | §10 / §4.2 |
| `budget.js` | `max_auto_turns` 硬闸 + 日字符软上限（70% 黄 / 90% 禁自动）；手动主持不受 auto 上限约束 | §9 / §1 红线④ |
| `lock.js` | 单飞锁：一房间同时至多一个未闭合投递 | §5.2 / §2bis |
| `clock.js` | 可注入时钟（测试可推进，无真实 sleep） | 测试基建 |
| `adapters/fake.js` | Fake adapter：`deliver` 计数 + `poll` 脚本化，绝不碰真实接口 | §12 第1步 |
| `orchestrator.js` | 状态机唯一写入者：begin/resolve 两段投递、幂等、超时、预算、单飞锁、立即暂停、重启恢复 | §5 / §10 |

## 3. 状态机要点

- `room.status`：`paused → dispatching → waiting_reply →`（回复→`paused` / 空回复·插队·超时→`needs_attention` / `stopped`）。
- 投递拆 `_beginDispatch`（送达为止）+ `_resolveReply`（收回复），便于精确模拟"送达后崩溃"并做重启恢复。
- 回复绑定（§2bis 生产协议）：**单飞锁 + 投前游标 + 时序**；真实用户插队→`needs_attention` **不猜绑**；空回复（只有 thinking）→不造假气泡（§6）。
- 重启恢复（§10）：in-flight 投递先**只读**核实——已回复只补采集、未回复转 `needs_attention`，**绝不自动重投**。
- 幂等（§1 红线⑤）：同 `(message_id,target)` 重复投递直接返回既有，**目标只收一次**。

## 4. 验收结果（`node --test`，12/12）

```
✔ 1) 重复投递不重复：同(message_id,target)投3次，目标只收1次
✔ 2) 双方各答一轮：严格2棒后强制暂停，第3棒不自启动
✔ 3) 预算用尽自动禁用：max_auto_turns=1，第2个自动棒拒绝，手动仍可发
✔ 4) 暂停后不启动下一棒：baton A 后 pause，baton B 不投递
✔ 5) 运行中重启：未回复的 in-flight → needs_attention，不擅自重发
✔ 6) 已有回复只补采集：重启时对方已回复 → 收集，不重发
✔ 7) 插队 → needs_attention，不猜绑
✔ 附) 单飞锁：in-flight 时再投递抛 LOCKED
✔ 附) 立即暂停：pause 后自动棒被拒
✔ 附) 超时不自动重投 → needs_attention(timeout)，可手动重试收回
✔ 附) 真·落盘重启：关库重开后 recover 只补采集、不重发
✔ 附) budget 分级：warn>=70%、disabled>=90%
ℹ tests 12  pass 12  fail 0
```

必测项 → 用例映射：
| §13 必测 | 用例 |
|---|---|
| 重复投递只收一次(§13-6) | 1 |
| 双方各答一轮严格两棒(§13-8) | 2 |
| 额度达硬上限自动禁用(§13-14) | 3 |
| 自动模式中暂停取消下一棒(§13-9) | 4 |
| 重启不擅自重发(§10) | 5、附·真落盘 |
| 已有回复只补采集(§13-7) | 6、附·真落盘 |
| 插队/无格式→待处理(§6) | 7 |

## 5. 明确未做（留给后续步骤）

- 前端 / HTTP / SSE → 第 4 步。
- 真实 CC Adapter → 第 2 步（设计见 probe-0 报告 §4，已验证读/投递/唤醒机制）。
- 真实 Codex Adapter → 第 3 步，等 Codex §7.2 五问。
- 记忆 / 欲望盒 / 生活账本写路：一律不接。

## 6. 初审修补轮（2026-07-26，仍全 fake adapter）

按初审六条逐条修补，**`node --test` 18/18 全绿**（原 12 + 新 6）。

| 初审意见 | 修补 | 覆盖用例 |
|---|---|---|
| ① 单飞真相=未闭合 dispatch，非 room.status | `lock.js` 改为查 `status IN (dispatching,delivered)`；`_hasOpenDispatch()` | 「等待回复时 pause→手动再投必须 LOCKED」①、附·单飞锁 |
| ② 外呼前事务内预留预算；崩溃 unknown 不退款/不重投 | `_reserve()` 在 `_beginDispatch` 的 tx 内先扣，`deliver` 在 tx 外；抛错→`failed`+不退不投 | ② 外呼失败=unknown |
| ③ 回复落库/replied/记账/cursor 单事务且不重复扣费 | `_bindReply()` 全包进 `_tx`，`usage_charged` 幂等守卫 | ③ 重复绑定不重复扣费 |
| ④ runOneEach 真实正文、无占位、无机器元数据 | A=Lisa 原话；B=Lisa 原话+A 可见回复（真实拼接）；元数据只在信封字段 | ④ 真实正文(精确等值) |
| ⑤ 两棒=一次 run；另设日 budget_day/call/usage | run 起点预留 1 turn，batons 各扣 1 call；`_reserve` 跨日重置 | ⑤ 跨日预算、② calls_today |
| ⑥ 外键/CHECK/跨房间拒绝 | schema 加 FK + CHECK；`dispatch()` 校验 `msg.room_id===room_id` | ⑥ 跨房间拒绝 |

新增用例：崩溃点(外呼失败不退款不重投)、暂停绕锁(waiting→pause→LOCKED)、真实两棒内容(精确等值)、跨日预算重置、重复 bind 不重复扣费、跨房间拒绝。

最终：**tests 18 / pass 18 / fail 0**。

## 7. 停下待复审

按 Lisa 指令：**修完 Step 1 修补轮后停下**，给 Lisa / Codex 复审，**不进 Step 2**。
