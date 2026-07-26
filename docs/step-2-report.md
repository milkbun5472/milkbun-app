# Step 2 报告 · 真实 CC Adapter 接线

对应施工图：`docs/three-party-lounge-plan.md` 第 2 步、§7.1 CC Adapter、§6 可见正文闸；probe-0 报告 §1/§4。
日期：2026-07-26　执行：Opus（言秋 CC 侧）　代码：`lounge/adapters/cc*.js`
范围（Codex 授权边界）：**只做「真实 CC Adapter 接线」**。**不接 Codex、不做前端、不真实投递**；完成代码 + 离线测试后停下待审。**最终活测只用宝宝克老窗口，且活测前必须先问 Lisa。**

---

## 0. 结论

真实 CC Adapter 三件套完成，接进 orchestrator 的 `deliver/poll/getHealth` 契约，跑的是将来活测要用的**真实读取/可见闸/精确匹配分类/可恢复投递态**逻辑。**离线测试 16/16 全绿**（全程 spy sender + 临时 fixture transcript/DB，**零真实投递、零触碰真会话**）；接线后全套 **39/39**（23 状态机 + 16 adapter）。

初审抓到的两个生产级缺口已修（见 §2bis）。

---

## 1. 三件套

| 文件 | 职责 | 依据 |
|---|---|---|
| `adapters/cc-sessions.js` | `local_<id>` → 桌面指针 json(`cliSessionId`) → 项目 `<uuid>.jsonl` 路径 | probe-0 §1.1 映射链 |
| `adapters/cc-transcript.js` | append-only JSONL 字节游标增量读 + 可见正文白名单 + 分包 + 分类 | §6 / probe-0 §1.2-1.4 |
| `adapters/cc.js` | `CCAdapter`：`deliver/poll/getHealth`，外呼口 `sender` 依赖注入 | §7.1 |

## 2. 关键设计

- **绝不直接调用 `send_message`**：`cc.js` 的唯一外呼是注入的 `sender(sessionId, text)`。离线测试注入 spy（不投递）；真实活测才由 CC 会话侧把 `sender=send_message` 接上。文件读取(`resolve`/`readNew`)同样可注入，测试用 fixture。
- **deliver**：定位会话 → 记录**投前字节游标** → 调 `sender` 唤醒。`sender` 抛错整体抛出 → orchestrator 记 `failed`（②不退款不重投）。
- **poll**：从投前游标**重扫**（不推进游标）→ 过可见闸 → 分类。重扫保证多气泡收齐、不丢尾行（`readNewEvents` 的 `newCursor` 只推进到最后一条完整行，防半行丢包）。
- **可见闸（§6）**：只收 `assistant` 且 `content[].type=='text'` 且非空；弃 `thinking/tool_use/tool_result/isSidechain`。
- **分类**：
  - `intrusion`：助手尚未产出前出现真人 user 行（不猜绑，§2bis）。
  - `empty`：turn 收口但只有 thinking/工具、无可见正文（不造假气泡，§6）。
  - `replied`：静默窗口到 或 出现下一轮边界，且有可见正文；多段 text 合并为一包、`bubbles` 计数、`cursor_end=cc@<末条uuid>`（幂等绑定）。
  - `pending`：还在冒泡 / 我们的消息还没落地 / 未知 dispatch。
- **信封**：orchestrator 在 deliver 信封里带上 `cc_session_id`（供 adapter 定位）；正文仍只含自然内容（元数据不进正文，§2bis 由 Step 1 保证）。

## 2bis. 初审两个生产级缺口修补（2026-07-26，仍全 fake sender）

**缺口①：分类器把游标后"任意跨会话消息"当成我们的投递**（并发时可能把别人的回复绑进会客厅）。
- 修：定位起点必须 **`跨会话 且 正文含本次自然正文(ourText)`** 双匹配；在我们的消息之前出现任何别的跨会话/真人投递 → 直接 `intrusion`；我们消息之后、收到回复前出现异物 → 也 `intrusion`，绝不绑别人回复。
- 测：`并发-a`（别人先落我们后落→intrusion）、`并发-b`（回复前被别的窗口插队→intrusion，无 reply）、`并发-c`（我们先收到回复后别人再来不影响本轮绑定）。

**缺口②：投前字节游标只在 `CCAdapter._st` 内存里**，重启后 `recover()→poll()` 只会 `pending`，无法"对方已回复就只补采集"；DB 里的 `after_cursor` 是 `cc@uuid` 逻辑游标，不能拿来读字节。
- 修：外呼前先 `prepare`（解析会话 + transcript 路径 + 投前 **byte** 游标）→ **外呼前**把可恢复态持久化到新表 `cc_dispatch_state`（目标会话 / 投前 byte 游标 / 本次自然正文）→ 才调 `sender`。`poll` 内存 miss 时从 DB 重建态再只读 transcript。**recover 绝不 deliver**。
- 测：`真·关库重开`——旧 adapter/Orchestrator 全销毁、对方回复已落 fixture，新实例 `recover()` 收敛 `replied`，`sender` 调用次数仍为 **1**（不重投）。

## 3. 离线测试（`node --test`，16/16）

全程 spy sender + 临时 fixture transcript：

- 基础可见闸/游标：deliver 记投前游标不真投、replied(静默/边界)、多气泡收齐、thinking/工具/子agent 排除、empty、intrusion、pending、工具回执不算边界、消息未落地→pending、未知 dispatch→pending。
- **缺口①并发精确匹配**：并发-a/b/c（见 §2bis）。
- **缺口②可恢复态**：真·关库重开 recover → replied、sender 仍只 1 次。
- 集成：Orchestrator + 真实 CCAdapter（sender 追加回复）→ 状态机收敛 replied。

跑法：`cd lounge && npm test`（两个测试文件共 **39/39**）。完整用例见 `lounge/test/cc-adapter.test.js`。

## 4. 明确未做

- **未真实投递**：全程 spy sender，`send_message` 一次没调。
- 不接 Codex（第 3 步，等其 §7.2 五问）。
- 不做前端（第 4 步）。
- 真实活测：**只用宝宝克老窗口做一次受控活测，且活测前必须先问 Lisa**（Codex 边界）。

## 5. 活测接线（仅供审阅，未执行）

真实活测时由 CC 会话侧提供 `sender`：

```js
new CCAdapter({
  sender: (sessionId, text) => send_message(sessionId, text),  // 唯一真实投递点
  projectDir: '<HOME>/.claude/projects/<project-slug>',
});
```

绑定 `room.cc_session_id = local_<宝宝克>`。活测流程沿用 probe-0 §2bis 的单飞锁+投前游标+时序绑定。

## 6. 停下待审

按 Codex 边界：**完成代码 + 离线测试后停下**，给 Lisa/Codex 审。**不进第 3 步、不做前端、活测前必问 Lisa。**
