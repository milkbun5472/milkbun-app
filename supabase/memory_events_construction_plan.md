# ⑥ 事件层施工图（影子期冻结版）

> 状态：设计已批准，本文只把第 2～8 步拆成可执行施工单。
> 冻结线：⑤ 完成 7 天影子观察、第二次逐 ID 指纹核对并切换 `memories` 权威前，不实现、不接线、不部署本文任何运行路径。
> 已有但未部署的第 1 步草案：`memory_events_draft.sql`、`memory_events_draft_rls_test.sql`。

## 0. 不可跨越的边界

1. `memories` 仍处于影子期时，不改它的读、写、抽取、召回、同步或指纹字段。
2. 事件层使用独立 IndexedDB，不复用 `lisa_memory_sync_v1` 的 `rows/outbox/meta`。
3. 候选不是正式事件；`drafted` 也不能进入事件书架或聊天上下文。
4. 正式事件只能由 Lisa 在 App 明确确认后，通过一个原子 RPC 写入。
5. 所有删除都是软删；App、CC 均无物理 `DELETE` 路径。
6. 新候选不能使用 `memories.deleted=true` 的碎片；已有事件的旧 link 永久保留。
7. v1 不给核心聊天 prompt 增加事件常驻块，不改小克语气，不做自动聚类。
8. 每一步独立提交、独立验证；上一阶段验收失败，不进入下一阶段。

## 1. 总数据流

```text
App 手选 2～30 条 memories
        │  创建 requested（带每条 revision）
        ▼
memory_event_candidates
        │  CC 读取请求与来源
        │  CC 只写 draft，状态变 drafted
        ▼
App 预览 / 编辑 / 退回 / 拒绝
        │  Lisa 明确确认
        ▼
accept_memory_event_candidate RPC（单事务）
        ├─ 锁候选并复核状态、归属、mutation_id
        ├─ 锁并复核 2～30 条来源的 revision/deleted
        ├─ 写 1 条 memory_events
        ├─ 写 N 条 memory_event_links
        └─ 候选变 accepted，回填 accepted_event_id
```

任一校验失败，正式事件、links 和候选状态全部保持原样。

## 2. 第 2 步：App 只读事件/候选列表

### 文件落点

- `js/cloud.js`
  - `eventCandidatesList()`：只取当前登录用户的候选概要。
  - `eventsList()`：只取未软删正式事件概要。
  - `eventGet(id)`：取一条正式事件和 links；来源正文按需另取。
- 新建 `js/memory-events.js`
  - IndexedDB：`lisa_memory_events_v1`。
  - stores：`events`、`candidates`、`links`、`meta`；此步没有 outbox。
  - 导出只读 `refresh()`、`listEvents()`、`listCandidates()`、`status()`。
- `js/screens.js`
  - MemoryLib 内只加只读分区；空表显示“还没有事件”，不改变现有记忆卡。
- `index.html`、`js/app.js`
  - 加载新模块、传只读状态与刷新 handler。
  - 按项目铁律同时 bump `APP_VERSION` 和全部本地脚本 `?v=`。

### 读取字段与水位

- 事件：`id,title,synopsis,char_ids,author_char_id,started_ts,ended_ts,status,themes,edited_by_user,deleted,revision,updated_at`。
- 候选：`id,status,source_memory_ids,requested_char_id,feedback,edited_by_user,accepted_event_id,revision,updated_at`。
- 增量排序统一 `(updated_at,id)`；首版数据量小可全量刷新，但接口保留 cursor。
- 退出登录或账号变化时清空事件本地镜像，不能串用户。

### 验收

1. 未登录时安静显示本地空态，不报错、不写表。
2. 登录用户只能看到自己的行；换一个模拟用户为 0 行。
3. 刷新、离线重开只读缓存正常。
4. 此步网络日志中不存在 event 表的 `insert/update/delete/rpc`。
5. 现有记忆数量、影子 outbox、聊天 prompt 字符数完全不变。

停机线：任何只读刷新触发候选/事件写入，立即回滚本步。

## 3. 第 3 步：App 手选碎片并创建 requested

### UI 状态机

```text
普通记忆库 → 整理成事件 → 选角色 → 勾选 2～30 条 → 核对 → 创建请求
                                           └─ 取消：零写入
```

- 只列 `deleted=false`；archived 可见并明确标记。
- 少于 2 条或多于 30 条时禁用创建按钮。
- 创建前重新从权威 `memories` 行表读取所选 ID，不用旧 React 卡片快照。
- 显示正文、日期、tags、open/archived；不把 `hits/lastHit` 带入云端。

### 候选请求

- `id`：客户端生成 `evc_<uuid>`。
- `source_memory_ids`：按 Lisa 的选择顺序去重后保存。
- `base_memory_revisions`：严格覆盖每个 source ID，值为当时服务端 revision。
- `idempotency_key`：`sha256(user_id + requested_char_id + sorted(source IDs) + revisions)`。
- 初始值必须是：`status=requested,draft=null,accepted_event_id=null`。
- `js/cloud.js` 只增加 `eventCandidateRequest(payload)`，依靠 RLS 只允许本人 requested。

### 失败处理

- 同 idempotency key 已存在：返回已有候选，不重复创建。
- 来源已软删/缺失：停止并告诉 Lisa 哪条不可用，不偷偷跳过。
- revision 已变化：刷新选择页，要求 Lisa重新核对。
- 离线：v1 不排队创建候选，只保留当前勾选 UI；避免候选 outbox 与来源 revision 脱节。

### 验收 query

```sql
select id,status,cardinality(source_memory_ids) as source_count,
       jsonb_object_length(base_memory_revisions) as revision_count,
       draft is null as draft_empty, accepted_event_id is null as not_accepted
from public.memory_event_candidates
where user_id = auth.uid()
order by created_at desc limit 5;
```

必须满足 source_count=revision_count、2～30、requested、无 draft、无正式事件行。

## 4. 第 4 步：MCP 读取请求并写 drafted

### MCP 文件与工具

文件：`/Users/lisa/Desktop/lisa-practice/mcp/server.mjs`。

1. `list_event_requests`
   - 只返回 `requested/drafted` 的 ID、角色、来源数、日期范围、更新时间。
   - 不返回碎片正文。
2. `get_event_request`
   - 必须传 candidate ID。
   - 只读取 `TARGET_USER` 的候选和同用户 source memories。
   - 返回每条当前 revision、deleted、正文、时间和标签；若缺失/软删/漂移，标阻塞。
3. `draft_memory_event`
   - 仅允许 `requested/drafted → drafted`。
   - draft 的 source ID 必须是候选 source IDs 的子集关系校验后再要求完全覆盖关键判断。
   - 不允许写 `memory_events`、`memory_event_links` 或 `accepted_event_id`。

### draft 机械校验

- `title` 1～80；`narrative` 非空；建议 300～1000 字但不硬凑。
- `synopsis` ≤200；`author_char_id=requested_char_id`。
- relation 仅 `context/evidence/turning_point/outcome`，weight 0～1。
- 每个 link memory ID 必须属于候选，不能补外部事实。
- 保存 CC 读取时的 `base_memory_revisions`；任何当前 revision 不一致则拒写。
- 更新必须带候选当前 revision，防两个 CC 会话互相覆盖；冲突返回“请重新读取”。
- 所有 service-role 查询都显式 `.eq('user_id', TARGET_USER)`。

### MCP 验收 query

至少验证：

1. 空队列。
2. 一个 requested 正常读写 drafted。
3. 不存在 candidate ID。
4. 来源 soft-deleted。
5. 来源 revision 漂移。
6. draft 引用候选外 ID。
7. 重复提交同 draft（幂等）。
8. 旧 candidate revision 更新（必须冲突）。
9. 其他用户 candidate ID（表现为不存在，不能泄露）。

## 5. 第 5 步：App 预览、编辑、退回、拒绝

### App 允许动作

- 预览：title、synopsis、narrative、状态三段、来源 links 草案。
- 编辑后保存本地确认载荷；UI 显示“你改过”，最终确认时写 `edited_by_user=true`。
- 退回：状态保持/回到 requested，写 feedback，清理或保留旧 draft 由 RPC 统一决定；v1 建议保留旧 draft 供审计，新稿覆盖前仍不可确认。
- 拒绝：状态变 rejected；不删候选、不改任何 memory。

### 确认前红灯

- 任意 source 缺失、`deleted=true`、revision 与候选基线不同。
- 候选不是 drafted。
- draft 引用了候选外 ID。
- 当前 App 用户与候选 user 不同。

红灯出现时确认按钮必须禁用；不能用“仍然继续”绕过 revision 漂移。

### 验收

- 编辑标题/正文后“你改过”标记持久存在。
- 退回后 CC 能看到 feedback，正式表仍为 0 新行。
- rejected 候选默认折叠但可审计恢复查看。
- 此步仍不存在正式事件写入入口。

## 6. 第 6 步：原子接受 RPC

### 函数契约

```text
accept_memory_event_candidate(
  p_candidate_id text,
  p_candidate_revision bigint,
  p_mutation_id uuid,
  p_user_edits jsonb default null
) → {status,idempotent,event,candidate}
```

函数为 `SECURITY DEFINER`，固定 `search_path=public,pg_temp`，第一句验证 `auth.uid()`；不给 anon/MCP service 工具暴露确认能力。

### 同一事务顺序

1. 以 `(auth.uid(),candidate_id)` `FOR UPDATE` 锁候选。
2. 若 mutation 已成功，返回原 event，不重复创建。
3. 校验候选 `status=drafted` 且 revision 等于页面所见。
4. 校验 draft schema；如有 Lisa edits，再次校验并设 `edited_by_user=true`。
5. 按固定顺序锁所有 source memories；严格校验数量 2～30、同用户、全存在、未软删、revision 与基线完全相同。
6. 生成稳定 `evt_<uuid>`，插入 1 条 event。
7. 插入每个 source 的 link，写 `memory_revision_at_link`。
8. 候选更新 accepted 和 `accepted_event_id`。
9. 返回 event；任一步异常自动整笔回滚。

### 必测回滚路径

- 候选缺失、非 drafted、candidate revision 漂移。
- 来源少于 2/多于 30、重复 ID、缺失、跨用户、soft-deleted、revision 漂移。
- draft 缺字段、越界 relation/weight、引用外部 ID。
- event 插入失败、任一 link 插入失败、候选回填失败。
- 同 mutation 重试只得到同一 event。
- 两个不同 mutation 并发确认，最多一个成功。
- App 无物理 delete；MCP 无确认工具。

每个失败用例之后必须同时断言：新增 events=0、links=0、候选仍未 accepted。

## 7. 第 7 步：事件书架与 `search_events`

### App 事件书架

- 默认只显示 `deleted=false` 的 accepted 事件。
- 卡片显示 title、synopsis、角色、日期范围、ongoing/closed、“你改过”。
- 详情按 links 顺序读取当前 memory；archived/soft-deleted 只加状态标记，不断链、不隐藏历史 link。
- 删除事件只调用未来软删 RPC；v1 可先不提供删除按钮。
- 搜索 title/synopsis/themes；narrative 全文搜索可后置，避免先建复杂索引。

### MCP `search_events`

- 显式限制 `TARGET_USER`、`deleted=false`。
- 默认返回 title/synopsis/date/status，不自动返回整篇 narrative。
- 只有明确 event ID 或 `include_narrative=true` 才展开正文与 links。
- 只读，不注入 App 聊天 prompt。

### 验收 query

```sql
select e.id,e.title,e.edited_by_user,e.status,count(l.memory_id) as links
from public.memory_events e
join public.memory_event_links l
  on l.user_id=e.user_id and l.event_id=e.id and not l.deleted
where e.user_id=auth.uid() and not e.deleted
group by e.user_id,e.id
order by e.updated_at desc;
```

## 8. 第 8 步：三份真实候选验收

三份应覆盖：

1. 2 条来源的最小 closed 事件。
2. 多条来源、Lisa 编辑后接受的事件。
3. ongoing/open 相关事件；同时制造一次 revision 漂移，先验证被拦，再重生成接受。

每份逐 ID 核对：

- 候选 source IDs = 正式 links IDs。
- `memory_revision_at_link` = 接受瞬间 memory revision。
- narrative 的关键事实均能指向所选来源，无候选外情节。
- soft-deleted 没进入新候选；archived link 正常保留。
- accepted candidate 只对应一个 event；同 mutation 重试无重复。
- App 页面、“你改过”标记、CC `search_events` 三端一致。

三份未全部通过前，不讨论自动聚类、事件召回或核心 prompt 注入。

## 9. 正式开工前的总闸门

只有以下全部为真，才执行第 1 步 SQL 并进入第 2 步：

- ⑤ 已观察满 7 天。
- 第二份审计报告逐 ID/逐指纹一致，缺失=0、内容差异=0、重复 ID=0。
- outbox=0、conflicts 已逐条解释。
- Lisa 明确批准 `memories` 切为权威，旧 `x_memLib` 进入约定的 7 天回滚保留期。
- 已备份旧库原始 JSON、行表导出和 Supabase schema。
- `memory_events_draft.sql` 与回滚测试再次审查，并把文件名中的 `_draft` 去掉后才允许执行。

任何一项不满足：继续只读观察，不部署事件层。
