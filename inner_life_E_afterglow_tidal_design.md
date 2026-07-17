# 内在生活系统 E · 余温 + 潮汐 · 实施前设计稿

状态：**待 Lisa + 言秋审批**。本文只定义 SQL、存储、纯逻辑契约和未来接线点；当前没有运行 SQL、没有改 App、没有注入 prompt、没有 hold 主动消息、没有碰记忆读写/同步路径。

## 1. 结论先行

- E 对所有角色生效，包括小克。
- v1 影子期只计算 `wouldSurface` / `wouldHold`，真实聊天行为完全不变。
- 余温默认 36 小时；潮汐睡眠窗口 90 分钟。
- `awake + 无有效余温包` 时未来注入严格为 0 字。
- 余温不是经历、日记、记忆或人格：`writesExperience=false` 是数据库约束，不只是约定。
- 不使用普通 `x_` localStorage 键：当前 `Cloud.collect()` 会把所有 `x_` 键装进整份 `saves`，与红线冲突。

## 2. 分层存储

### 2.1 影子期本机权威

新增独立 IndexedDB：`lisa_inner_life_e_shadow_v1`，不进入 `saves`、导出备份或记忆同步。

对象仓：

1. `afterglow_packets`，key=`ownerHash|charHash`
2. `tidal_state`，key=`ownerHash`
3. `diagnostics`，自增 key；最多 500 条、14 天，只存枚举/时间/计数/hash，不存消息正文、余温正文或用户原话
4. `meta`，保存 ownerHash；账号变化立即清空前三仓，防串号

本机余温包：

```text
ownerHash, charId, charHash,
lastAnchor, moodSketch, unfinishedThreads[1..3],
strength, createdTs, expiresTs,
surfaceOnce=true, surfacedAt=null,
shadowWouldSurfaceAt=null,
writesExperience=false, schemaVersion=1
```

本机潮汐：

```text
ownerHash,
state=awake|maybe_sleeping|uncertain,
signalTs|null,
signalKind=sleep|wake|typed_message|timeout|boot,
transitionReason,
updatedTs, schemaVersion=1
```

影子期 `surfaceOnce` 的演练只写 `shadowWouldSurfaceAt`，不写正式 `surfacedAt`；否则开阀前的模拟会消耗真实余温。

### 2.2 未来跨设备/夜巡行表（本轮不部署）

潮汐最终必须让夜巡读到，因此不能永远只存在手机 IndexedDB。开阀前部署独立行表；不修改 `saves`，不进入记忆表。

```sql
create table public.user_tidal_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state text not null default 'awake'
    check (state in ('awake','maybe_sleeping','uncertain')),
  signal_ts timestamptz,
  signal_kind text not null default 'boot'
    check (signal_kind in ('sleep','wake','typed_message','timeout','boot')),
  transition_reason text not null default '',
  revision bigint not null default 1 check (revision >= 1),
  last_mutation_id uuid not null,
  updated_at timestamptz not null default now()
);

alter table public.user_tidal_state enable row level security;
alter table public.user_tidal_state force row level security;

create policy tidal_select_own on public.user_tidal_state
  for select to authenticated using (auth.uid() = user_id);
create policy tidal_insert_own on public.user_tidal_state
  for insert to authenticated with check (auth.uid() = user_id);
-- 不直接 grant update；更新只走带 revision + mutation_id 的 CAS RPC。
```

余温若需要跨设备连续性，再部署独立行表；影子期先证明值得同步：

```sql
create table public.afterglow_packets (
  user_id uuid not null references auth.users(id) on delete cascade,
  char_id text not null,
  last_anchor text not null,
  mood_sketch text not null default '',
  unfinished_threads jsonb not null default '[]'::jsonb,
  strength numeric(4,3) not null default 1.0 check (strength between 0 and 1),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  surface_once boolean not null default true,
  surfaced_at timestamptz,
  writes_experience boolean not null default false check (writes_experience = false),
  revision bigint not null default 1 check (revision >= 1),
  last_mutation_id uuid not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, char_id),
  check (jsonb_typeof(unfinished_threads) = 'array'),
  check (jsonb_array_length(unfinished_threads) <= 3),
  check (expires_at > created_at)
);

alter table public.afterglow_packets enable row level security;
alter table public.afterglow_packets force row level security;
```

正式 SQL 包还必须包含：own-row RLS、禁止匿名、CAS upsert RPC、重复 mutation 幂等、过期清理、跨账号测试、并发/旧 revision 测试和物理删除权限测试。影子期不需要先建空云表；避免没有消费者的云数据成为第二事实源。

## 3. 潮汐纯状态机契约

函数保持纯逻辑：

```text
reduceTidal(previous, event, now) -> { next, transition|null }
```

事件只有：

- `SLEEP_SIGNAL`
- `WAKE_SIGNAL`
- `USER_TYPED_MESSAGE`
- `SESSION_OPEN_NO_MESSAGE`
- `FOREGROUND_TICK_NO_MESSAGE`

转移表：

| 当前 | 事件 | 条件 | 下一状态 |
|---|---|---|---|
| 任意 | USER_TYPED_MESSAGE | 用户真实发出消息 | awake；清空睡眠推断的约束窗口 |
| 任意 | WAKE_SIGNAL | “醒了/起了/早”等 | awake |
| 任意 | SLEEP_SIGNAL | “睡会儿/睡了/晚安/躺了”等 | maybe_sleeping；刷新 signalTs |
| maybe_sleeping | SESSION_OPEN/FOREGROUND_TICK | now-signalTs ≤ 90m | maybe_sleeping，不得变 awake |
| maybe_sleeping | SESSION_OPEN/FOREGROUND_TICK | now-signalTs > 90m | uncertain |
| uncertain | SESSION_OPEN/FOREGROUND_TICK | 任意 | uncertain |
| awake | SESSION_OPEN/FOREGROUND_TICK | 任意 | awake |

同一条用户消息的优先级：明确睡眠信号 > 明确清醒信号 > 其他真实消息；无消息事件只处理时间窗口。也就是说，“晚安我睡了”落 `maybe_sleeping`，“我醒了”落 `awake`，普通新消息落 `awake`。新窗口、reload、compact、focus 和 app 重启本身永远不是 `awake` 证据。

睡眠/清醒识别 v1 只用本地规范化词组和否定保护，不调用模型。例如“我没睡”“别睡”不得命中睡眠。影子诊断记录命中规则编号，不记原句。若几天数据证明规则召回不足，再单独评审是否需要便宜模型语义兜底；不得偷用小克线。

## 4. 余温生成契约

```text
deriveAfterglow({char, messages, mood, openEntries, now}) -> packet|null
```

- 生成时机建议 N=30 分钟静置；另有 `visibilitychange` 进入后台和跨天补生成。
- 同一 `lastAnchor` 幂等：重复触发只更新时间诊断，不重建包、不重置“只浮一次”。
- `lastAnchor`：优先消息 `id`；当前消息并非都有 id，fallback=`ts:<ts>:<role>:<contentShortHash>`，不保存完整正文。
- `moodSketch`：只取现有 `mood.label`，通过固定轻量映射生成；无 mood 就空，不下人格结论。
- `unfinishedThreads`：最多 3 条；只读复用当前角色 `open=true` 的现成条目和最近真正未回应的话题。不得写回、修改、关闭或重新排序记忆库。
- 没有真实消息锚点时不生成；不能用日程/朋友圈推演冒充会话余温。
- 新包覆盖同角色旧包属于此独立临时层的按 key 替换，不影响任何记忆/事件。

## 5. 影子诊断

每条诊断只存：

```text
t, ownerHash, charHash,
kind=packet_created|packet_expired|would_surface|tidal_transition|would_hold,
fromState, toState, triggerRule,
packetAgeBucket, threadCount, strengthBucket,
outlet=foreground_proactive|jiwen|greeting|night_watch|null
```

禁止保存：聊天正文、睡眠原句、moodSketch、unfinishedThreads、记忆正文、prompt、模型输出。

报告至少提供：

- 包生成数、同锚重复数、过期数、would-surface 数、一次性约束违规数
- 睡眠/清醒/超时转移数，session-open 误转 awake 数（必须为 0）
- `wouldHold` 按出口分布
- 睡眠信号后 90 分钟内用户又发消息的恢复耗时
- awake 且无包时拟注入字符数（必须为 0）

## 6. 未来接线位置（本轮不接）

### 消息入口

不能只接 `replyNow(extraText)`：用户可先连续发气泡而不请求回复。需要一个无副作用入口 `TidalShadow.onUserMessage(text, ts)`，由以下所有真实用户发送路径调用：

- 单聊 `pushUser`
- `replyNow` 直接附带的 `extraText`
- 群聊用户发送
- 单人线下 `offlineSend`
- 群线下用户发送
- 富消息/语音转文字等最终落成用户消息的统一发送口

调用顺序：先分类整条消息，再投递唯一事件；睡眠信号消息 → `SLEEP_SIGNAL`，清醒信号消息 → `WAKE_SIGNAL`，其他消息 → `USER_TYPED_MESSAGE`。不得对同一条消息先投递睡眠事件、再补投普通打字事件，避免一句“我睡了”被立刻翻回 awake。

### 无消息会话事件

- 打开角色聊天、app focus、visibility 回前台、reload 恢复：只调用 `onSessionOpenNoMessage(now)`。
- 这些入口只推进 maybe_sleeping→uncertain，永不写 awake。

### wouldHold 出口

影子期每个出口只调用 `noteWouldHold(outlet)`，绝不 return/skip：

- 前台主动定时器 `replyNow(...,{proactive:true})`
- jiwen 主动
- 生日/备忘录/体征/天气等主动出口
- 早晚安握手
- 夜巡 server 生成早安信之前

夜巡在手机外运行，只有部署 `user_tidal_state` 行表后才能参与真实 shadow；在此之前 App 只能统计“本机若收到同类出口会 hold”，不能冒充夜巡已验收。

### 未来注入位置

- 只在 `buildBundle` 易变区追加，不新建常驻块、不移动现有 bundle 顺序。
- 余温和潮汐分别最多一句；有效才出现。
- shadow 阶段不调用此函数；开阀前做逐字符快照，证明默认态输出空字符串。

## 7. 第 1 步计划与停机点

Lisa 审批本文后，才进入 §8 第 1 步：

1. 生成未部署 SQL 文件与 SQL 测试文件。
2. 只实现纯 `reduceTidal`、信号分类器和单元测试，不接 App、不建表。
3. 必测：晚安消息不被同一条“用户打字”覆盖成 awake；90m 边界；新窗口不醒；新睡眠信号刷新窗口；否定句不误判；任何异常返回旧状态/默认 awake 且不阻断。
4. `node --check` + 固定时钟测试通过后停下，给 Lisa 看；不自动进入第 2 步。

## 8. 需要 Lisa + 言秋本轮审批的四点

1. 静置收尾 N 是否采用 **30 分钟**。
2. 影子期是否同意**只用 IndexedDB，不先建云表**；夜巡的真实 would-hold 统计推迟到潮汐独立行表部署后。
3. 余温 `unfinishedThreads` 是否允许只读取现有 open 条目正文进入临时包（不写回记忆）；若“别碰记忆读路径”连只读复用也禁止，则 v1 只取最近未回话题。
4. “晚安我睡了”属于睡眠信号消息，必须落 `maybe_sleeping`，不能被“能打字就是醒着”在同一条消息里覆盖；本文建议以睡眠信号优先。
