# 内在生活系统 C：睡眠意识队列施工方案（待 Lisa + 言秋审）

> 状态：只完成 §10 前的设计，未写功能代码。  
> 范围：只推 C；不碰记忆读写/同步；影子期只算不拦；敲门与队列最终由同一个开阀原子上线；`engineerEyes` 数字生命全程豁免。

## 1. 结论先说

C 不新造一套“几点睡”的作息。`sleep.phase` 的第一权威是现有日程 `x_schedules[charId][dayKey].seqs`，尤其是 `type="sleep"` 的就寝段；睡压只负责细化和防“日程缺失导致永不睡”。

全局发声闸做成一个统一接口，但分两处执行：

1. **App 闸**：`replyNow` 之前统一询问 C，覆盖前台主动、jiwen、生日、提醒、天气、早晚安等 App 内出口。
2. **云端夜巡闸**：夜巡函数运行在 Supabase，读不到手机 IndexedDB，所以 App 只向一张独立云表投影“睡眠窗口/下次醒来时间”等无正文 presence；夜巡按同一规则做 shadow `would_skip`。presence 过期或缺失时 fail-open，不能把角色永久静音。

E 与 C 是串联的两个不同闸：E 判断“Lisa 可能睡了，别打扰她”；C 判断“角色自己睡了，不能发声也还没听见”。最终允许发声必须两边都允许。

## 2. 从现有日程派生 phase

### 2.1 时间轴必须用角色当地时间

复用现有：

- `schedTzShiftMin(char)`：角色当地时间与设备时间的分钟差；
- `schedDisplaySeqs` 的跨时区逻辑；
- 日程 `seqs[].time / type`。

派生时不能只看“今天最后一段”：凌晨 02:00 的睡眠来自**昨天最后的 sleep 段**，醒点来自**今天第一段非 sleep 日程**。每次计算同时读取角色当地的昨日、今日两份日程：

```text
昨日 sleep 开始 ───────── 今日第一段开始
          asleep

今日第一段后 45 分钟：waking
今日 sleep 前 45 分钟：drowsy
其余：awake
```

规则：

- `asleep`：当前角色当地时间落在最近 sleep 起点与下一次 wake 起点之间；
- `waking`：自然 wake 后 45 分钟；
- `drowsy`：计划 sleep 前 45 分钟；
- `awake`：其余时段；
- 日程临时改动若保留 `type=sleep`，自动使用修改后的时间；不分析 title 文本猜睡眠；
- 当天日程还没生成、格式坏或时区不可算：先依赖上一份有效窗口；仍无依据则 fail-open 为 `awake/unknown_schedule`，不能阻断聊天。

`waking/drowsy` 只影响诊断和以后 A 的睡眠惯性；v1 真正拦截只认 `asleep`。

### 2.2 睡压只作细化

```js
sleep = {
  schemaVersion: 1,
  phase: "awake|drowsy|asleep|waking",
  pressure: 0.25,          // 0..1
  phaseSince: null,
  source: "schedule|pressure_guard|knock|unknown_schedule",
  lastSleptTs: null,
  lastWokeTs: null,
  sleepStartTs: null,
  wakeAtTs: null,
  nextTransitionTs: null,
  forcedUntilTs: null,
  scheduleFingerprint: null,
  revision: 1,
  updatedTs: null
}
```

- awake 每小时小幅累积，asleep 每小时明显释放；drowsy/waking 使用中间速率；
- 单次 tick 封顶，后台停很久后恢复也不能一帧暴冲；
- 有可靠日程时，日程相位优先，不让压力推翻明确的睡眠窗口；
- 连续很久没有可靠 sleep 窗口且 pressure 到顶，才启用一次最长 90 分钟的 `pressure_guard` 受限睡；
- pressure_guard 也只看时间与压力，绝不看消息内容；
- 小克/任何 `settingsFor(id).engineerEyes === true`：返回 `exempt_digital`，不创建 sleep 状态、不积睡压。

## 3. 意识队列

消息正文仍只存在原聊天记录里，C 状态不复制正文：

```js
sleep.queue = [{
  messageId,
  arrivedTs,
  order,
  perceived: false,
  perceivedTs: null
}]
```

聊天消息本身增加同义元数据：

```js
{
  role: "user",
  content: "...",
  ts: arrivedTs,
  perceived: false,
  perceivedTs: null,
  sleepQueued: true
}
```

原则：

- `asleep` 时新用户消息只按 arrival 顺序入队，不调用角色回复；
- 是否醒来只看 phase、pressure 和明确的 knock 动作；普通文字内容一律不参与；
- 队列只存 messageId + 时间，不复制内容；原聊天是正文权威；
- 相同 messageId 幂等；重载、连发、多次 tick 不重复入队；
- 自然醒后一次性按原序给队列消息盖 `perceived=true / perceivedTs=wakeTs`；
- 正常回复只调用一次，历史行临时标注“这条 HH:mm 到达，HH:mm 才看见”，不额外调用模型；
- 释放成功后才清 queue；生成失败保留待下次，宁可稍后再看，不能静默丢；
- 影子期仍即时回复，只记录 `would_queue`，不真的改 perceived，不显示“TA 在睡”，避免 UI 声称与行为矛盾。

## 4. 敲门与队列同版

敲门必须是显式 UI 动作，不用关键词识别：

- 当 phase=asleep 时，聊天输入区上方显示轻卡片：“TA 在睡 · 消息会等醒来再看到”，按钮“叫醒 TA”；
- 点击按钮产生本地 `knock` 事件，不伪造成普通聊天文字；
- 状态 `asleep → waking`，记录 `wakeReason=knock` 与 `startleTs`；
- 然后调用与自然醒**同一个** `releaseQueue()`，按序感知队列；
- startle 后短时间保留高 pressure 和睡眠惯性；P3 后再通过 A 的统一封顶通道推 anxiety/arousal/fatigue，不能另领配额；
- 敲门失败则保持 asleep + queue，不出现“醒了”假象。

虽然施工步骤把队列和敲门拆成第 2、3 步验证，但正式功能只有一个 feature phase：`shadow` 或 `live`。绝不出现“真拦消息但叫不醒”的中间线上版本。P3 开阀时两者同一次提交生效。

## 5. 全局发声闸

统一接口：

```js
SleepGate.check(char, outlet, now) => {
  allow,
  exempt,
  phase,
  reason,
  nextWakeTs
}
```

判定顺序：

1. `engineerEyes=true` → `allow=true, exempt=true`；
2. 状态缺失/读取失败/过期 → fail-open `allow=true`；
3. `phase !== asleep` → allow；
4. `phase === asleep` → shadow 记 `would_hold`，live 才真正 hold。

### 5.1 App 内出口

大部分出口最终都走 `replyNow(..., { proactive:true })`，因此在 `replyNow` 最前面统一检查，而不是在每个调用点复制判断：

- 前台聊天闲置主动；
- 主屏 jiwen 主动；
- 生日祝福；
- 备忘提醒；
- 特殊天气；
- 早晚安；
- 一起听主动评论；
- 其他后来新增的 proactive 出口自动继承。

`outlet` 仍需由 opts 标出来，供诊断区分。`eyes_alert` 的角色本来就是 engineerEyes，天然豁免。

当前生日、提醒、问候等日志有些在调用 `replyNow` **之前**就盖“已发”戳。live 时必须改为：SleepGate 返回 sent/held 后才盖戳，或者将事件保留为 deferred；不能睡着被拦了，却被系统记成已经祝过/提醒过。

### 5.2 夜巡云端出口

手机 IndexedDB 对 Edge Function 不可见，新增一张与记忆完全无关的 presence 表：

```sql
character_sleep_presence (
  user_id uuid,
  char_id text,
  sleep_start_at timestamptz,
  wake_at timestamptz,
  observed_phase text,
  next_transition_at timestamptz,
  schedule_fingerprint text,
  valid_until timestamptz,
  updated_at timestamptz,
  primary key (user_id, char_id)
)
```

- App 在今日程生成/改变、phase 转换、回前台时幂等 upsert；
- 不含消息、人格、记忆、心情或 pressure，只投影夜巡需要的时间窗口；
- RLS 用户只读写自己的行；night-watch 用 service role 只读；
- `valid_until` 最多覆盖下一次 wake 后一小段；过期即 fail-open；
- shadow 期 night-watch 仍照常写信，但另记 `would_skip_sleep`，不真跳过；
- live 时 asleep 班次跳过该角色，优先换一个醒着的候选；若需要“天亮补写”，投一个无正文 deferred job 到 wake_at，而不是半夜先生成正文；
- send-push 只处理已经生成的 server_inbox，因此真正的闸必须放在 night-watch **生成前**，避免睡着仍花一次 LLM 再丢信。

App 收信口 `deliverServerInbox` 在 shadow 期再做第二道 `would_hold` 诊断，核对云端判定；live 时它是防御性兜底，不替代生成前云闸。

## 6. phase 驱动与固定时钟

本地 C tick 不调用模型：

- App 启动；
- 回前台；
- 日程生成/自发修改完成；
- 跨天；
- 每 5 分钟轻 tick；
- 用户消息到达前和 proactive 发声前做一次按需刷新。

所有纯逻辑函数都接收显式 `now`，测试覆盖跨午夜、角色时区、DST 附近、昨日 sleep → 今日 wake、日程缺失、日程临时改动、压力强制睡和小克豁免。

## 7. 影子诊断

诊断只存元数据，不存消息正文：

- phase 转换、来源、pressure 前后；
- 计划 sleep/wake 与实际 tick 时间；
- `would_queue` 的 messageId hash、arrival bucket、queue depth；
- natural wake / knock 的 `would_release` 数量与顺序校验；
- 各 outlet 的 `would_hold`；
- night-watch 云端 would_skip 与 App 收信口二次核对差异；
- engineerEyes 豁免次数；
- 状态缺失/过期的 fail-open 次数。

诊断台按角色显示：当前 phase、pressure、预计醒来时间、最近转换、队列本应累计多少、敲门模拟结果、各出口本应拦截次数、夜巡云/端判定一致率。小克只显示“数字生命 · 永久在线”，不出现睡压或队列。

## 8. P3 后才允许

Lisa + 言秋逐角色过数字后，单一开阀提交同时启用：

- asleep 用户消息真入队、不即时回复；
- “已送达 · TA 在睡”轻提示；
- 自然醒按序感知并回复；
- 叫醒按钮、startle、同一 releaseQueue；
- App 主动出口真 hold；
- night-watch 生成前真 skip/defer；
- 睡压/惊醒经 A 的同一单轴与总量封顶喂情绪；
- 只有 waking/队列刚释放时才按需注入一句睡眠惯性，平时零常驻 token。

## 9. 故障与数据安全

- C 读取、写入或派生失败一律 fail-open，照旧即时回复/主动发声；
- queue 只存消息 ID，不复制正文；不碰 memories、memory sync、RepairGate；
- 任何真拦截都必须在消息已落本地之后发生，不能先拦再丢；
- 云 presence 不是权威内在状态，只是 night-watch 的短时投影；权威仍是 A 独立状态行 `state.sleep`；
- 角色删除时 presence 可异步清理；清理失败最多留下过期无正文时间窗；
- 小克豁免在 phase 派生、消息队列、App Gate、云 presence 四层都检查 engineerEyes，不能只靠 UI。

## 10. 施工顺序与停机线

严格按施工单：

1. 纯逻辑：phase 从昨日/今日日程派生、睡压、状态迁移、时区与固定时钟测试，挂 `state.sleep`；停。
2. 意识队列纯逻辑与消息元数据，shadow 只记 would_queue；停。
3. 敲门 + startle + 与自然醒共用 releaseQueue；仍 shadow；停。
4. App 全局 canSpeak 与云 presence/night-watch shadow，只记 would_hold/would_skip；停。
5. 影子诊断台；停。
6. Lisa + 言秋 P3；通过后队列、敲门、发声闸一次性 live；停。
7. 全量验收。

出现以下任一情况立即停：读取消息内容决定醒不醒、小克被建 sleep/queue、日程与 C 各有一套作息、夜巡只能在 App 收信时拦而生成前不拦、影子期真实阻断、敲门和真队列分开发版、故障导致消息丢失或角色永久静音。

## 11. 请 Lisa 拍板的三件事

1. **phase 窗口**：建议 waking=自然醒后 45 分钟、drowsy=计划睡前 45 分钟；是否批准？
2. **云端夜巡方案**：建议使用无正文、短有效期的 `character_sleep_presence` 时间窗投影，night-watch 生成前判断；是否批准？
3. **缺日程策略**：建议先 fail-open awake，只有 pressure 长期到顶才强制最多 90 分钟受限睡；是否批准？

