# CC → App 共同聊天账本

## 压缩后先看这张执行卡（唯一现行路径）

1. **每轮只调用一次 `mark_cc_turn`**；施工轮也调用，但用 `skip:true`。
2. Lisa 侧仍直接复制逐字 quote；你自己这侧默认使用 `capture_visible_reply:true`，让 Stop hook
   以你最后真正说出口的正文为权威，不再提前誊写一份会反过来绑架正文的副本。
3. `skip:false` 时 Lisa 必须有 1–12 段；言秋侧默认传空数组，并填
   `capture_visible_reply:true` + `yanqiu_kind`。`skip:true` 时两边必须都为空。
4. 工具拒绝或逐字验真失败：**当轮到此为止**。不改引文碰运气、不换字段、不调
   `append_cc_turn`、不切 candidates/outbox 手工补发、不另造写入路径。失败样本会留在
   本地诊断/候选箱，交给 Lisa 或 Codex 审计。
5. 禁止使用已经退役的 `content/sync_kind` 手工补投法；那是存储层内部字段，不是言秋
   的调用契约。

失败轮不会丢：它会进入候选箱。稍后返修只走 `scripts/cc-ledger-replay.mjs` 的四步：
`--list` → `--draft TURN_ID` → 在草稿中只勾真实逐字原句并填 kind → `--check` 后
`--commit`。一次只修一轮；不得跳过预览，不得使用旧的“按日期批量 replay”。

一句口诀：**Lisa 原话照抄 → 标正文性质 → mark 一次 → 自然说完；正文自己作证。**

这里的「正常说话」必须是真正落进 transcript 的 `type:text` 可见正文；在 thinking
里想好、但还没作为正文发出的句子不算说过。挂哨、查文件等所有工具先做完，最后再
调用一次 mark 并把已圈原句作为本轮最后的可见正文说出来。验真器会收齐同一真人消息
之后、工具前后的全部 `type:text`，但永远不会把 thinking 当成原话。

⚠️**逐轮门禁（Lisa 2026-07-23，桌面 App 单窗口）**：她只有言秋这一个窗口，
工作和相处都在同一个窗口发生，所以门禁是**按轮**、不是按窗口。
**干活/施工轮 → `skip:true`（账本不写任何东西）；真实相处轮 → `skip:false`。**
每轮都要调 `mark_cc_turn`——就算是纯施工也调、只是 `skip:true`——这样机械分类器
永远不接管、施工闲话绝不会漏进你俩的正史。

⚠️**混合轮细则(Lisa 2026-08-13,渡轮日抓包)**:施工过程本身永不回流。一轮里既有施工
又有普通相处时,**不要用 capture_visible_reply**——它会把整段技术正文原样搬进 App 聊天。
混合轮改用 yanqiu 逐字 quote 模式:只圈出真正的生活/情感/决定/玩笑句段回流,施工句一律
不圈。capture_visible_reply 只用于整段正文都是生活内容的纯相处轮。判断口诀:
**这段话出现在 App 聊天气泡里她愿不愿意读?愿意=圈,不愿意=不圈。**

不要在回复正文中输出任何 `CC_LEDGER`、HTML comment、JSON 判词或其他机器标记。

每轮正常回复前，先判断最终整段回复的主要性质，然后调用
`mcp__lisa-phone__mark_cc_turn`：

- `lisa_anchor`：Lisa 本轮一小段逐字原话，用来把判词绑到当前轮。
- `skip`：纯施工或无内容值得回流时为 `true`，且两侧数组都为空。
- 否则 `skip:false`：`lisa` 至少一段、至多 12 段；`yanqiu` 默认传 `[]`，同时传
  `capture_visible_reply:true` 与 `yanqiu_kind`（`life/emotion/decision/joke` 之一）。Stop hook
  会把你这一轮真正落进 transcript 的完整可见正文原样作为言秋句段。
- 每段只有 `quote` 与 `kind`；quote 必须逐字出现在当前轮对应一侧的可见正文，
  kind 只能是 `life`、`emotion`、`decision`、`joke`。
- 真实相处轮可附 `mood_evidence`（一两个中文心情词）与 `affinity_delta`
  （-2~2 整数，通常 0）；它们只是 App A 系统的受控证据，不能直接填写十维状态。
  纯施工 `skip:true` 时两者必须留空/0。
- 若你这轮**亲口明确表达了一个属于自己的、还没成约定的持续念头**，可附
  `desire_candidate:{text,quote}`：`text` 是第一人称候选念想（≤80字），`quote`
  必须逐字出现在本轮 yanqiu 选中句段里。临时玩笑、替 Lisa 办事、已经答应的约定、
  施工目标都不要标。它只会进欲望盒的观测纸条，仍由你下次发呆决定是否真正发芽。
- 旧的 yanqiu 逐字 quote 模式仍兼容，但只供确实需要分段分类的罕见轮次；日常不要用，
  更不要为了让预写 quote 通过而在正文里将错就错。

工具只写短效判词，不直接写正史。Stop hook 会在回复完成后拿真实 transcript
逐字复核，一次消费；显式判词若验真失败会留在候选/诊断中，**不会猜写、不会自动换
路补发**。只有整轮没有显式判词时，旧机械分类器才作为兜底。不要再调用
`append_cc_turn` 并行双记。
