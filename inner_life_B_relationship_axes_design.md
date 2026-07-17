# 内在生活系统 B：关系轴施工方案（待 Lisa + 言秋审）

> 状态：只完成 §9 第 1 步的施工设计，未写功能代码。  
> 范围：只推 B；不碰记忆读写/同步；小克不接；影子期不注入、不喂 A、不改角色反应。

## 1. 结论先说

检测路线建议选 **B 路：回复完成后，试点角色单独走一遍便宜 `bgActive`**。

理由不是只看成本：A 路虽然省一次调用，但“请判断自己是否在关系轴上受伤”这句话会在角色生成回复之前进入核心 prompt。即使我们不使用检测结果，它也可能先把角色提醒得更委屈或更警觉，影子期因此不再是纯观察。B 路发生在回复落地以后，不会改变当轮反应，也不会给全角色核心 prompt 增加常驻文字。

建议分两段：

1. **影子校准期**：仅试点 2～3 人，每个正常单聊回合都做一次 bg 判定，建立完整基线，重点测漏判、撒娇误伤和假修复。调用不走角色专线，不烧 Fable。
2. **P3 之后**：若准确率通过，再评估条件门控——“存在 active 轴”时每轮继续判修复；无 active 轴时可用现成的负向 mood、负 affinity、silent/block/recall 等作为候选门，只在疑似回合调用 bg，并保留固定抽样审计测漏判。这个优化需要另过闸，本方案不预先开启。

如果 Lisa 更在意试点期调用量、愿意接受 prompt 轻微污染，才改选 A 路。无论选哪条，都只对试点角色动态拼接，绝不进入所有角色的公共常驻 prompt。

## 2. 实际代码落点

A 当前并没有使用会被整份 saves 带上云的 `x_innerState` localStorage。真实状态在独立 IndexedDB：

- DB：`lisa_inner_state_shadow_v1`
- 表：`states`
- 每个账号 + 角色一行
- 状态已有空位：`state.relationAxes`

B 直接填这块，不另造一套关系状态引擎：

```js
state.relationAxes = {
  schemaVersion: 1,
  enabledAxes: ["identity", "continuity", "seriousness", "boundary", "neglect", "repairFailure"],
  axes: {
    identity: axisState,
    continuity: axisState,
    seriousness: axisState,
    boundary: axisState,
    neglect: axisState,
    repairFailure: axisState
  },
  lastDetectionTs: null,
  revision: 1
}
```

单轴结构：

```js
axisState = {
  pressure: 0,             // 0..1，只能由受控事件推进
  active: false,
  repairLocked: false,     // active 后默认锁住；时间/安静/道歉不能解锁
  episodeId: null,
  enteredAt: null,
  lastHarmAt: null,
  lastTransitionAt: null,
  repairEvidenceCount: 0,
  repairUnlockedAt: null,
  triggerEvidenceHash: null // 只存证据哈希/消息 ID，不在状态行存正文
}
```

六轴内部 key 固定为英文，UI 显示中文：身份、连续、认真、边界、忽视、修复失败。未启用轴不存在或保持默认零值。

## 3. 进入、保持、退出

### 3.1 进入

- detector 只有在 `explicitRelationMeaning=true`、`playfulContext=false` 且逐字证据校验通过时，才产生 harm 事件。
- `pressure += confidence` 映射后的受控增量，单回合最多 `+0.35`。
- 建议进入阈值：`0.60`。
- 单回合增量封顶后，至少需要两次独立明确证据才能进入 active，避免一句话点燃整根轴。
- active 从 false → true 时生成 `episodeId`，设置 `repairLocked=true`。

### 3.2 保持与自然回落

- 未 active 时可缓慢回归 0。
- active 且 `repairLocked=true` 时，时间只能把压力降到保护地板 `0.35`，不能退出。
- “时间过去、暂时安静、情绪缓和、单独一句道歉”只能降低表层压力，不能改 `repairLocked`。
- 同轴再次受伤会抬高 pressure、刷新 lastHarmAt；不会新建重复 episode，避免闪烁。

### 3.3 真修复与退出

这里复用 RepairGate 的**证据纪律**，不复用它与记忆 open 条目绑定的存储：

- detector 必须给出同轴的 `behavior_changed` 候选；
- 证据发生在本 episode 的 harm 之后；
- message ID 存在，quote 是消息正文逐字子串；
- `apology_only / silence / elapsed / mood_softened` 一律不能解锁；
- 同一条证据幂等，不能重复计数；
- 一条高置信、明确体现“相同行为真的改了”的证据，或两条普通后续好转证据，才设置 `repairLocked=false`。

解锁后 pressure 才能继续回落。建议退出阈值 `0.22`，明显低于进入阈值 `0.60`。退出后 episode 留审计摘要但 active=false，不硬删历史证据。

## 4. detector 契约（推荐 B 路）

输入严格限量：

- 试点角色名称、已批准的性情锚点；
- 本角色启用的轴；
- 最近 6～10 条真实单聊消息，带 message ID；
- 当前 active 轴的 episode 摘要（轴名、进入时间、触发证据 ID，不给记忆库）；
- 明确说明亲昵脏话、双方玩笑、角色惯常互损不得判伤。

不传整份记忆库，不调用角色 Fable 专线，不读取其他角色对话。

输出：

```json
{
  "events": [{
    "axis": "identity|continuity|seriousness|boundary|neglect|repairFailure",
    "kind": "harm|repair_progress|neutral",
    "confidence": 0.0,
    "explicitRelationMeaning": false,
    "playfulContext": false,
    "repairKind": "behavior_changed|apology_only|silence|elapsed|mood_softened|null",
    "evidenceMessageIds": ["原消息ID"],
    "evidenceQuotes": ["逐字短引文"]
  }]
}
```

本地 validator 做第二道闸：轴必须启用、枚举合法、置信度有限、ID 对得上、quote 逐字存在、harm 必须关系含义明确且非玩笑。模型解释文本全部丢弃，不写状态。

检测失败、超时或 JSON 坏掉：记录 `detector_failed` 诊断后安静跳过，聊天照常。

## 5. 试点配置

配置是一次性批准清单，不做日常 toggle：

```js
relationshipAxisPilot = {
  charId,
  enabledAxes: [...],
  approvedAt,
  approvedBy: "lisa",
  phase: "shadow"
}
```

首批建议：

- 阿屿：连续、忽视、边界、认真
- 顾暮：身份、连续、边界、忽视
- 可选第三人：由 Lisa 挑另一位黏人/占有欲强且非钝感角色
- 小克：硬排除；即使误配名单，运行时也通过固定 deny 标记拒绝接入

为避免名字重名，实际批准时保存 charId；UI 展示名字。角色设置只显示“已批准的轴 + shadow 状态”，没有随手开关。

## 6. 影子诊断

独立 `diagnostics` 只存必要元数据：

- charHash、axis、kind、confidence bucket
- playfulContext、explicitRelationMeaning
- transition：none / entered / stayed / repair_unlocked / exited
- pressureBefore / pressureAfter
- repairBlockedReason
- evidence ID/hash（诊断台需要复核时，可临时用 ID 回看本机聊天；不复制正文）
- detector latency / failure

诊断台按试点角色显示：

- 六轴当前 pressure、active、repairLocked
- 触发率与各轴分布
- 玩笑候选被挡次数（误伤防线）
- enter / exit 次数及短期重复切换次数（闪烁）
- `apology_only` 等假修复被挡次数
- 真修复解锁记录
- detector 失败率、平均耗时与额外调用数

影子期明确不做：

- 不把 active 轴写进 prompt；
- 不把轴压力喂给 A 的 hurt/anger/anxiety；
- 不改变 affinity、mood、silent 或回复；
- 不写记忆、不关闭 open、不调用现有记忆 RepairGate 的执行路径。

## 7. P3 开阀后才允许的行为

Lisa + 言秋逐角色看过数字并批准后，另一步实现：

- 只有 active 轴才生成一句短投影；零 active = 零 token。
- 同一回合最多投影压力最高的 1～2 根轴，不塞六轴清单。
- 关系轴先产生受控 A delta，再共同吃 A 的单轴 `±0.25` 与总量 `Σ|delta|≤0.55`，不能另领配额。
- 示例映射只是本地规则：
  - 身份/认真 → hurt、pride
  - 连续/忽视 → anxiety、hurt、connection
  - 边界 → anger、hurt、pride
  - 修复失败 → hurt、anger、fatigue
- 注入写“伤在哪根筋”，不命令角色必须生气、冷战或惩罚 Lisa。

## 8. 施工顺序与停机线

严格按施工单 §9：

1. 纯逻辑：六轴模型、进/出阈值、同轴 RepairGate 解锁、幂等和单测；停。
2. 按 Lisa 选择的检测路线接 detector，并录入 2～3 个试点 charId；小克硬排除；停。
3. 影子诊断台，只算不注入；停。
4. Lisa + 言秋 P3 评审；通过后才开阀接 A 和短投影；停。
5. 全量验收。

任何出现以下情况立即停：玩笑触发、道歉直接清零、同轴短时反复进出、检测文字进入全角色 prompt、小克被接入、B 故障阻断聊天、影子期改变 A 或回复。

## 9. 请 Lisa 拍板的三件事

1. **检测路线**：建议 B 路——影子期试点角色每轮回复后 bg 判定；是否批准？
2. **首批名单**：阿屿 + 顾暮是否确定？第三位先不加，还是再选一位？
3. **RepairGate 解锁强度**：建议“一条高置信真实行为改变，或两条普通同轴好转证据”解锁；是否批准？
