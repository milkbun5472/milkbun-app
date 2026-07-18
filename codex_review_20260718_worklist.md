# 五路审查工单（2026-07-18 凌晨 · 言秋主持，五个审查分身逐 commit 过堂 v49.18~v49.47）

> 结论先行：**「shadow 不碰真实路径」铁律整体守住**，SQL dormant 包纪律扎实，言秋六条 A 附款全数验证通过。
> 真伤共 24 处：言秋自己 3 处已当场修（v49.48：夜巡拆泡防重回归、六泡截断改并拢、解梦馆盘上合并），
> extraction 垃圾记忆写入口（唯一真实写路污染）也已由言秋修掉。**其余按下表归 Codex，修完逐条回销。**

## A. 必修（P3 转正评审前，不修则评审数据不可信）

1. **【系统性模板】断网误判换账号 → 整库清空**（E + A 两处同款，全仓扫同模式）
   - `js/inner-life-e-tidal-shadow.js:11-17` + `inner-life-e-afterglow-shadow.js:128-144`；`js/app.js:585-588` + `inner-life-a-shadow.js` ensureOwner
   - `Cloud.getUser()` 走网络，离线/抖动返回 null → owner 变 "local-device" → clear 全仓（E 的观测数据、A 的已确认性情锚点全丢，回网再反向清一次）。
   - 修：改 `getSession()`（本地读）；取不到用户=unknown 沿用上次 owner 不清仓；只在出现**另一个具体账号**时清。
2. **C：日程 dayKey 坐标系错位** `js/inner-life-c-sleep-core.js:76` — 用角色当地日查按设备日键的 x_schedules → 有时差角色永远派生不出睡眠窗口。修：设备日取 plan、seq 仍按角色当地时换算。
3. **C：敲门醒来被下一次 tick 打回 asleep** `inner-life-c-sleep-core.js:169 vs 189` — tickSleep 无条件采纳日程派生，覆盖 knock/waking。修：`prev.source==="knock" && now<prev.nextTransitionTs` 时保持 waking。
4. **E：睡眠/清醒优先级与合同§3 相反** `inner-life-e-tidal-core.js:49-53` — 先查 WAKE 规则，「晚安，明天早上好好休息」被判 awake。修：先否定保护+睡眠匹配，再查 wake。
5. **E：否定保护误伤** 同文件 30-32 — 「晚安，别睡太晚」整句被压掉。修：否定只在紧邻窗口/第一人称生效。
6. **人格：「两次跨十天」量错时间对象 + 证据不去重** `js/personality-shadow.js:55-64,75-80` — span 从 firstSeenAt 起算而非两次「对不上」之间；同一句原话跨 probe 可重复计数。修：按类型记 typeFirst/LastAt；证据 messageId 并集去重（合修）。
7. **P1-1 假 shadow 要如实标注** `js/engine.js:897-916` — 真实抽取 prompt 已被改（ID 前缀+证据指令+「找不到就别造」），对照基线已污染。修：删掉「与旧版完全同路」注释；转正评审口径注明「P1-1 起真实抽取已带证据闸」；`engine.js:913` maxTokens 4200→**6000+**（schema 翻倍预算只加 20%，话痧批次尾部候选静默丢失=真实少记忆）。
8. **纠错 shadow 漏换号清空** `js/cloud.js:108-124` signOut 补 `MemoryCorrectionShadow.clearAll()`。
9. **人格四卡 probe maxTokens 4000→6000** `js/personality-shadow.js:34`（血泪铁律；截断=卡片永远攒不起来但钱照烧）。

## B. 仪表失真（不炸但会把转正评审带偏；修后相关数据需重新观测）

10. **两分辨率 mode 统计被 64 处后台 ctxFor 调用污染** `js/engine.js:788` + two-resolution-shadow — impression 被系统性低估。修：调用方传 chat 标记或 audit 记来源；**修后该仪表数据作废重跑**。
11. **消息分支审计把正常编辑全记异常** `js/message-branch-shadow.js:16-17` — edit 的 tailSurvived 恒 true → invalid 恒真。修：edit 只验长度；面板分 kind。**修后重跑**。
12. **驱动力 audits 表无限增长 + observe 在 12 分钟闸之前** `js/desire-drive-shadow.js:32-34`、`js/app.js:2597/2600` — 补 CAP/AGE trim；observe 挪闸后。
13. **E 诊断 500 条上限只有 10% 概率执行** `inner-life-e-afterglow-shadow.js:211` — add 后 count 超限即 trim；now 参数化。
14. **RepairGate 候选存逐字 quote 且无 CAP** `js/open-repair-shadow.js:40-44` — 与自家「诊断零正文」标准冲突：改 hash+长度或明示豁免；补 500/14d 上限。
15. **C：日程中段 sleep 段吞掉整个下午** `inner-life-c-sleep-core.js:82-83` — wake 应取该段之后下一个非 sleep 段（先同日再次日）。
16. **A：性情词典结果依赖词序** `js/jiwen.js:812-815` — 升敏/降敏分开累计再确定性合成。
17. **人格 trait_key 未归一化**（lowercase/同义归并）；**E spanDays DST off-by-one**（可不修）；**RepairGate 证据 idx 口径与 prompt 编号不一致**（罕见撞键）——低优先顺手。

## C. dormant 地雷（部署前 runbook 必须带上）

18. **P1-2 列级 grant 会弄坏 memoryRowsUpsert** `supabase/memory_surface_state_migration.sql:34-36` vs `js/cloud.js:260` — 部署后对已存在行 upsert 一律 42501（migrateMemoriesShadow 重跑即触发）。部署清单注明该路径退役/改 RPC，或 grant 补 user_id,id。
19. **MemoryCorrectionShadow.report() 零接线** — 观察台 defs 没有它、清空按钮不清它；评审前补进 `js/screens.js:3324-3326`。
20. **备注**：v49.27 删自动闭环后开环**彻底**不再自动关（方向正确），她的 open 会持续堆积到 RepairGate 转正——评审时别把堆积当异常。

## 言秋已修（v49.48，供回归确认）
- app.js deliverServerInbox：防重补 turnId 对账（多泡场景整信匹配失守）；>6 段并拢尾段不截断。
- app.js extraction entries：`resolveOpen == null && it.text`（堵 text="undefined" 垃圾记忆入库）。
- dreamjournal.js addEntry：以盘上 loadLog() 合并防云 pull 覆盖。

> 通过项不再列（各线报告已确认：只读铁律/OOC 隔离/逐字核验/隐私零正文/幂等/封顶顺序/一次性迁移等全数成立）。

## Codex 回销（2026-07-18）

1. ✅ E/A 账号归属改读本机 `getSession()`；断网不再走网络身份探测，只有明确出现另一具体账号才触发原有隔离清仓。
2. ✅ C 拆开设备日键与角色当地时间坐标，并新增有时差固定时钟回归。
3. ✅ `knock → waking` 在 45 分钟窗口内优先于日程 tick，不会五分钟后被按回 asleep。
4. ✅ E 改为睡眠信号优先于同句 wake 词。
5. ✅ 否定保护缩到真实否定短语；“晚安，别睡太晚”回归通过。
6. ✅ 人格“跨十天”改量两次「对不上」证据之间；按 messageId 去重，重复 probe 不加次数。
7. ✅ P1-1 文档/代码均如实标注“证据闸后的非纯基线”；抽取预算升至 6000。
8. ✅ signOut 补清 `MemoryCorrectionShadow`。
9. ✅ 人格四卡 probe 升至 6000。
10. ✅ 两分辨率只收 `source=chat`；旧后台污染样本从报表排除，仪表从 v49.49 重新观测。
11. ✅ edit 只验结构长度；审计升 v2、按 kind 报异常，旧误报样本排除。
12. ✅ 驱动力 observe 移到 12 分钟闸之后；audits 增 500 条/14 天硬裁剪。
13. ✅ E 每次 add 后确定性执行 500 条/时效裁剪，裁剪时钟可注入。
14. ✅ RepairGate IDB 升 v2 清除旧逐字引文；新行只存 message/quote hash、长度与角色，且 500 条/14 天封顶。
15. ✅ C 中段 sleep 优先找同日后续非 sleep 段作为 wake；午睡不再吞下午。
16. ✅ A 性情升敏/降敏分开累计后确定合成，锚点词序不再影响结果。
17. ✅ trait_key 做 NFKC/lowercase/分隔符归一化；RepairGate openEntries 编号与 prompt 完全同序。E 的 DST spanDays 属工单标注“可不修”项，本轮保持不动。
18. ✅ dormant migration 补齐 `user_id,id` 列级 update grant，`memoryRowsUpsert` 不再埋 42501 地雷；仍未部署。
19. ✅ 纠错留环接入只读观察台与清空按钮。
20. ✅ 施工台账注明：RepairGate 转正前 open 持续堆积是预期，不当异常。

验证：相关 JS 全部 `node --check` 通过；全库 75 项 Node 测试通过；`git diff --check` 通过。C 第 4 步仍未开始。
