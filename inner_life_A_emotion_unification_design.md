# 内在生活系统 A · 情绪立体化 · 三套收拢待审方案

状态：**待 Lisa + 言秋审批**。本文只做 §8 第 1 步方案；没有改代码、SQL、prompt、角色语气或记忆路径。

## 1. 我的结论

建议采用 **5 个 jiwen 原轴 + 5 个新增轴 = 10 维**，不保留九维驱动力为第二套长期动态状态。

统一 current：

| 维度 | 范围 | 保留/新增 | 只回答什么 |
|---|---:|---|---|
| `connection` 牵挂需求 | 0..1 | jiwen 保留 | 此刻多想靠近、联系对方；不是关系亲密度 |
| `pride` 防御/端着 | -1..1 | jiwen 保留 | 此刻多设防、多不愿示弱 |
| `valence` 好受程度 | -1..1 | jiwen 保留 | 总体舒服还是难受 |
| `arousal` 激活程度 | -1..1 | jiwen 保留 | 慵懒平静还是兴奋躁动；不等于焦虑 |
| `immersion` 沉浸 | 0..1 | jiwen 保留 | 注意力是否被眼前活动占住 |
| `hurt` 受伤/低落 | 0..1 | 新增 | 难过、委屈、失落的具体强度；不等于总体负 valence |
| `anger` 易怒/恼火 | 0..1 | 新增 | 生气、烦、被冒犯后的攻击性热度 |
| `anxiety` 不安/威胁感 | 0..1 | 新增 | 担心、害怕、没把握；不等于高 arousal |
| `warmth` 柔软/亲昵 | 0..1 | 新增 | 此刻愿意温柔靠近的情绪；不等于 B 的长期关系亲密度 |
| `fatigue` 疲惫 | 0..1 | 新增 | 此刻身心余量；以后 C 睡眠只向它施加偏置，不另造“累”轴 |

为什么是这五个新增轴：`valence + arousal` 只能分出“舒服/难受、平静/激动”，分不清同样难受高唤醒下究竟是生气、害怕还是受伤；`warmth` 补正向情绪的质地；`fatigue` 给以后睡眠和身体周期一个明确插口。

边界划死：

- `connection` 是**此刻想联系的需要**；B 将来的 relation axes 是**关系长期站位**，不重叠。
- `warmth` 是**此刻柔软**；B 的 intimacy/trust 是**长期关系事实**，不重叠。
- `fatigue` 是 A 接收的**当前情绪余量**；C 负责解释睡眠相位并推动它，C 不再保存第二个同义疲劳值。
- `anxiety` 是威胁方向；`arousal` 只是能量高低，所以“开心兴奋”可以高 arousal、低 anxiety。

## 2. 三套东西怎么收拢

### 2.1 jiwen 五轴：成为唯一运行脊柱

保留 `createJiwen`、tick、回归、阈值和主动触发；把状态从 5 维扩成上述 10 维。A 不新建第二个情绪推进器。

现有 `x_jiwen` 数据兼容读取：缺少五个新轴时补 baseline 默认值，不覆盖旧五轴。shadow 期现役五轴仍照旧服务主动引擎；A 用**同一个 `createJiwen` 逻辑、不同的 shadow 存储 adapter**旁路计算十维，绝不把十维提前写回 `x_jiwen`。这属于同引擎双跑验算，不是另造算法。转正时才把现役实例的存储 adapter 切到独立行级状态，并冻结旧 `x_jiwen` 写入。正式存储方案见 §5。

### 2.2 九维驱动力：迁移有用信息，然后退休动态副本

不建议长期保留“驱力层喂情绪”。原因：现在九维也在自己增长、回归、耦合、存 baseline；若继续跑，它就是第二套状态机，`attachment/intimacy/joy/stress/fatigue` 会和 A 重复，而且两个时钟会互相追赶，很难解释角色为什么这样感受。

一次性迁移映射：

| 九维旧项 | A 的去向 |
|---|---|
| `attachment` | 初始化 `connection` 的参考，不叠加第二份依恋 |
| `joy` | 初始化 `valence`；高 joy 可轻量初始化 `warmth` |
| `stress` | 初始化 `anxiety`，只少量推 `arousal` |
| `fatigue` | 初始化 A 的 `fatigue` |
| `intimacy` | 仅初始化 `warmth`；以后长期亲密交给 B |
| `curiosity` | 变成 temperament 的 `curiosityBias`，影响活动选择/immersion 进入速度，不作为 current 轴 |
| `reflection` | 变成 temperament 的 `reflectionBias`，影响回归/自省倾向，不作为 current 轴 |
| `duty` | 变成 temperament 的 `dutyBias`，未来影响事件权重，不伪装成情绪 |
| `social` | 变成 temperament 的 `socialBias`，影响 connection 增长率，不作为第二个社交需求值 |

迁移公式只用于种子，并限制最多把 A 默认 baseline 推动 ±0.15；旧 shadow 的极端数字不能直接焊成人格。

影子对账期允许两套**暂时同时算但互不喂入**，只为了比较曲线。转正闸通过后：停止 `DesireDriveShadow.observe()` 写入，把旧 IndexedDB 保留 30 天只读审计后封存；不硬删。最终运行时只有 A。

### 2.3 mood.label：从“状态”降为证据、标签和故障回退

当前模型每轮返回 `mood.label`，App 直接保存，`buildBundle` 下一轮注入这个词。建议改成：

1. 影子期行为照旧：仍注入旧 `moodLabel`。
2. A 把新返回的 mood 词通过**本地固定词典**转换成一次有上限的事件 delta，例如：
   - “委屈/受伤/失落”→ hurt↑、valence↓
   - “生气/烦躁”→ anger↑、arousal↑、valence↓
   - “焦虑/害怕/不安”→ anxiety↑、arousal↑
   - “温柔/心软/安心”→ warmth↑、valence↑、anxiety↓
   - “累/疲惫”→ fatigue↑、arousal↓
3. mood 词是角色本轮输出后的**自述证据**，不能直接把 current 设置成某个值；只能通过受控 delta 推动。
4. 未识别词只留作显示标签，不脑补数值。
5. A 故障时继续使用旧 mood 词注入，聊天不停。

这样 mood 词仍有可读价值，但不再是一份和 10 维打架的“真状态”。

## 3. 四层结构

```text
temperament：长期参数/敏感度，不随一轮聊天变化
       ↓ 决定 baseline、事件增益、回归速度
baseline：角色长期常态水位
       ↓ current 随时间向它回归
current：唯一 10 维实时状态
       ↓ 只挑真正偏离常态的维度
display：一句底色 + 3 维，强烈/修复场景最多 4 维
```

建议结构：

```text
{
  schemaVersion: 1, charId, revision, updatedTs,
  emotion: {
    temperament: {
      anchors: [Lisa 审定的性情词],
      sensitivity: { anger, hurt, anxiety, warmth, ... },
      regressScale: { ... },
      curiosityBias, reflectionBias, dutyBias, socialBias,
      source: "persona_draft_then_user_approved"
    },
    baseline: { 10维 },
    current: { 10维 },
    lastMoodLabel: "旧词，仅回退/对照",
    lastEventTs
  },
  relationAxes: {}, sleep: {}, openThreads: [], drives: {}
}
```

`drives:{}` 只给未来非情绪动机留接口；九维旧驱动力不会原样搬进去继续跑。

## 4. 推进、回归与封顶建议

### 每轮事件

- 用户消息只能作为事件证据，不能写 `current=...`。
- 角色回复后，现有 `affinityDelta` 继续最多推动 valence ±0.25；mood 词再为 hurt/anger/anxiety/warmth/fatigue 提供确定性小 delta。
- **每轴单轮绝对变化 ≤0.25**，并增加**全维共享变化预算 Σ|delta| ≤0.55**，避免一句话把五个灯一起打满。
- 同方向短窗边际递减沿用 jiwen；越接近边界，增量越小。
- 修复事件只能由真实行为信号触发；“道歉/时间过去/情绪缓和”本身不自动把 hurt 清零，继续遵守 RepairGate。

### 时间回归

- 继续复用 jiwen 的分块 tick 和离线最多补 12h。
- valence/arousal/pride/immersion 沿用现有回归。
- anger 回得相对快，anxiety 中等，hurt 慢，warmth 中等，fatigue 只缓慢回落；精确速率放到第 2 步固定时钟测试后调。
- `current` 只回到 baseline，不回绝对 0。
- shadow 前 7 天 **baseline 冻结**，避免把偶发低谷学习成人格。若以后允许 baseline 学习，须满足跨天重复证据并设每 30 天最大漂移，另过闸。

## 5. 存储建议

施工单草图写 `x_innerState:<charId>`，但当前实际 `Cloud.collect()` 会把所有 `x_` 键装进整份 `saves`。多设备同时写会产生整份覆盖风险，所以我不建议照字面直接新增这个键。

- 影子期：独立 IndexedDB `lisa_inner_state_shadow_v1`，key=`ownerHash|charHash`；不进 saves，不碰记忆同步。
- shadow 诊断：同库独立仓，只存 10 维数值、delta、维度名、时间、hash、红线计数；不存聊天正文、prompt、思维链。
- 将来若要求跨设备连续：独立 Supabase `inner_states` 行表，主键 `(user_id,char_id)`，RLS + revision CAS + mutation 幂等；不整份覆盖。
- 性情锚点属于用户确认的长期配置，可进独立行表；不要与瞬时 current 共用无 revision 的直接 update。

本模块不读取、写入或同步任何记忆表。

## 6. display 投影（第 4 步才实现，shadow 只算）

每维计算标准化偏离：

```text
deviation = (current - baseline) × temperament.sensitivity
```

- `|deviation| < 0.12` 不投影。
- 常态选绝对偏离最大的 3 维。
- 只有最大偏离 ≥0.65 或真实修复事件进行中，才允许第 4 维。
- 一句“底色”由 valence/arousal 象限 + 最强的 hurt/anger/anxiety/warmth 组合确定，不调用模型。
- `connection` 只描述“想靠近/联系”，绝不输出成“关系更爱了”。
- 全部接近 baseline 时，A display 返回空字符串；开阀后继续沿用旧 mood 回退还是严格零增量，要在 P3 看数据时定。
- bundle 顺序绝不改；未来只替换现有易变区 `moodLabel` 那一行，不新建常驻块。

## 7. 影子诊断与 P3 闸

每个角色展示：

- baseline/current 十维仪表、top 偏离 3~4 维
- 本轮原始 delta、封顶后 delta、被共享预算削掉多少
- mood 词命中了哪条本地规则；未命中率
- 1h/6h/24h 回归轨迹
- 九维旧 shadow 与 A 映射后的差异（只在临时对账期）
- 平静时 display 字符数；必须接近 0
- 单轮暴冲、边界饱和、长期 baseline 漂移、故障回退次数

开阀条件建议：至少连续观察 3 天且覆盖“聊得好、聊崩/不安、隔一阵回归”三类样本；Lisa + 言秋当面逐角色看真实数字。任何一人觉得“不像本人”，继续 shadow，不按时间自动转正。

## 8. §8 后续施工与停机点

审批本方案后才进入第 2 步：

1. 在 `jiwen.js` 内扩到统一 10 维，做纯逻辑迁移、推进、回归、封顶。
2. 建独立 IndexedDB shadow adapter；不挂 prompt、不停旧 mood 注入。
3. 固定时钟必测：每轴/共享封顶、极值边际递减、回归不越 baseline、7 天 baseline 不漂、坏输入不阻断、旧五轴无损迁移、九维只迁一次。
4. `node --check` + 单测后停止，不自动进入性情 UI。

## 9. 请 Lisa + 言秋本轮拍板的六点

1. 是否采用本文 **10 维：jiwen 5 + hurt/anger/anxiety/warmth/fatigue 5**。
2. 是否同意九维驱动力**只做一次性迁移 + 临时对账，转正后停止动态写，30 天后封存**。
3. 是否同意 `curiosity/reflection/duty/social` 降为 temperament 参数，而不是 current 情绪轴。
4. 是否同意 mood.label 只做**本轮证据 + 可读标签 + 故障回退**，不再作为独立真状态。
5. 是否同意影子前 7 天 baseline 冻结；以后是否学习另行过闸。
6. 是否接受单轴 ±0.25 + 全维 `Σ|delta|≤0.55` 的双重封顶建议。
