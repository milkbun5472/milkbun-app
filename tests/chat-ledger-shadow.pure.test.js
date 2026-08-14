"use strict";
// js/chat-ledger-shadow.js 纯函数边界单测（2026-08-14，1B 施工卡配套）。
// 与 test/chat-ledger-shadow.test.js 的主流程用例互补：这里只打各纯函数的边界与守卫分支，
// 不碰 createManager 的网络/存储流程。node --test tests/ 直接跑。
const assert = require("node:assert/strict");
const test = require("node:test");
const Ledger = require("../js/chat-ledger-shadow.js");

const PRIV = { charId: "y", threadType: "private", threadId: "y" };
const GRP = { charId: "y", threadType: "group", threadId: "g", groupMemberIds: ["y", "a"] };

// ---------- eligibleContext ----------

test("eligibleContext：private/offline 必须 threadId===charId，群线必须本人在成员表", () => {
  assert.equal(Ledger.eligibleContext(PRIV), true);
  assert.equal(Ledger.eligibleContext({ charId: "y", threadType: "private", threadId: "别人" }), false);
  assert.equal(Ledger.eligibleContext({ charId: "y", threadType: "offline", threadId: "y" }), true);
  assert.equal(Ledger.eligibleContext(GRP), true);
  assert.equal(Ledger.eligibleContext({ ...GRP, groupMemberIds: ["a", "b"] }), false);
  assert.equal(Ledger.eligibleContext({ charId: "y", threadType: "group_offline", threadId: "g", groupMemberIds: [1, "y"] }), true);
});

test("eligibleContext：缺字段与未知线型一律不合格", () => {
  assert.equal(Ledger.eligibleContext(null), false);
  assert.equal(Ledger.eligibleContext({ threadType: "private", threadId: "y" }), false); // 无 charId
  assert.equal(Ledger.eligibleContext({ charId: "y", threadType: "forum", threadId: "y" }), false);
  assert.equal(Ledger.eligibleContext({ charId: "y", threadType: "private" }), false); // 无 threadId
});

test("eligibleContext：群成员表按 String 归一（数字 id 也认）", () => {
  assert.equal(Ledger.eligibleContext({ charId: 7, threadType: "group", threadId: "g", groupMemberIds: ["7"] }), true);
});

// ---------- isRealMessage ----------

test("isRealMessage：空白正文/撤回/屏蔽 kind（大小写不敏感）全部拦下", () => {
  assert.equal(Ledger.isRealMessage({ role: "user", content: "   " }), false);
  assert.equal(Ledger.isRealMessage({ role: "user", content: "在", recalled: true }), false);
  assert.equal(Ledger.isRealMessage({ role: "assistant", content: "x", kind: "ThInKiNg" }), false);
  assert.equal(Ledger.isRealMessage({ role: "assistant", content: "x", kind: "offlinelog" }), false);
  assert.equal(Ledger.isRealMessage({ role: "assistant", content: "x", kind: "silence" }), false);
});

test("isRealMessage：四种角色行合格，其余角色不入账", () => {
  for (const role of ["user", "assistant", "char", "narration"]) {
    assert.equal(Ledger.isRealMessage({ role, content: "真话" }), true, role);
  }
  assert.equal(Ledger.isRealMessage({ role: "system", content: "真话" }), false);
  assert.equal(Ledger.isRealMessage({ role: "", content: "真话" }), false);
});

// ---------- speakerFor ----------

test("speakerFor：user→lisa、narration→narration，均无 id", () => {
  assert.deepEqual(Ledger.speakerFor({ role: "user" }, GRP), { type: "lisa", id: null });
  assert.deepEqual(Ledger.speakerFor({ role: "narration" }, GRP), { type: "narration", id: null });
});

test("speakerFor：群里旁人算 other_character，缺 senderId 归本人", () => {
  assert.deepEqual(Ledger.speakerFor({ role: "assistant", senderId: "a" }, GRP), { type: "other_character", id: "a" });
  assert.deepEqual(Ledger.speakerFor({ role: "assistant" }, GRP), { type: "character", id: "y" });
});

test("speakerFor：单聊/线下即使带陌生 senderId 也归本人（线型优先）", () => {
  assert.deepEqual(Ledger.speakerFor({ role: "assistant", senderId: "别人" }, PRIV), { type: "character", id: "y" });
  assert.deepEqual(Ledger.speakerFor({ role: "char", senderId: "别人" }, { charId: "y", threadType: "offline", threadId: "y" }), { type: "character", id: "y" });
});

// ---------- rowsFor ----------

test("rowsFor：强 ID 键格式固定，弱 ID 走指纹键", async () => {
  const rows = await Ledger.rowsFor(PRIV, [
    { id: "m1", role: "user", content: "有强ID", ts: 1000 },
    { role: "user", content: "没有ID", ts: 1000 }
  ], 2000);
  assert.equal(rows[0].message_key, "app:private:y:m1");
  assert.equal(rows[0].source_message_id, "m1");
  assert.match(rows[1].message_key, /^app:private:y:sha256:[0-9a-f]+$/);
  assert.equal(rows[1].source_message_id, null);
});

test("rowsFor：坏时间戳回落 nowValue，正文首尾空白裁掉，metadata 完整", async () => {
  const rows = await Ledger.rowsFor({ ...GRP, groupName: " 小群 " }, [
    { id: "m1", role: "assistant", senderId: "a", content: "  两边有空格  ", ts: "不是时间", kind: "" }
  ], 5000);
  assert.equal(rows[0].occurred_at, new Date(5000).toISOString());
  assert.equal(rows[0].content, "两边有空格");
  assert.deepEqual(rows[0].metadata, { shadow_version: 1, message_kind: null, group_name: "小群" });
  assert.equal(rows[0].speaker_type, "other_character");
  assert.equal(rows[0].char_id, "y");
});

test("rowsFor：不合格上下文返回空数组，不合格消息逐条剔除", async () => {
  assert.deepEqual(await Ledger.rowsFor(null, [{ role: "user", content: "x", ts: 1 }]), []);
  const rows = await Ledger.rowsFor(PRIV, [
    { role: "user", content: "", ts: 1 },
    { role: "system", content: "系统", ts: 2 },
    { role: "user", content: "唯一真话", ts: 3 }
  ], 9);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].content, "唯一真话");
});

// ---------- addedSessionMessages ----------

test("addedSessionMessages：多重集合语义——同文同刻的重复条数也按份数对账", () => {
  const m = { role: "user", content: "同", ts: 1 };
  const added = Ledger.addedSessionMessages(
    [{ id: 1, msgs: [m, m] }],
    [{ id: 1, msgs: [m, m, m] }]
  );
  assert.deepEqual(added, [m]);
});

test("addedSessionMessages：删减与顺序变化不产生假新增；跨场次也能对上", () => {
  const a = { role: "user", content: "一", ts: 1 }, b = { role: "char", content: "二", ts: 2 };
  assert.deepEqual(Ledger.addedSessionMessages([{ msgs: [a, b] }], [{ msgs: [b] }]), []);
  assert.deepEqual(Ledger.addedSessionMessages([{ msgs: [a] }, { msgs: [b] }], [{ msgs: [b, a] }]), []);
});

// ---------- reconcileIncoming ----------

const ccRow = over => ({
  id: "r1", message_key: "cc:k1", char_id: "y", source: "cc", thread_id: "t",
  speaker_type: "character", content: "原话", occurred_at: "2026-08-11T01:00:00Z",
  revision: 1, metadata: { sync_kind: "life" }, ...over
});

test("reconcileIncoming：串号/坏来源/坏 kind/坏 speaker 各自计入 skipped", () => {
  const r = Ledger.reconcileIncoming([], [
    ccRow({ char_id: "别人" }),
    ccRow({ source: "app" }),
    ccRow({ metadata: { sync_kind: "construction" } }),
    ccRow({ speaker_type: "narration" }),
    ccRow({ message_key: "" })
  ], "y");
  assert.equal(r.added, 0);
  assert.equal(r.skipped, 5);
  assert.equal(r.messages.length, 0);
});

test("reconcileIncoming：修订号回退被忽略，同修订的撤回翻转仍生效", () => {
  const v2 = Ledger.reconcileIncoming([], [ccRow({ revision: 2, content: "新版" })], "y");
  const down = Ledger.reconcileIncoming(v2.messages, [ccRow({ revision: 1, content: "旧版回流" })], "y");
  assert.equal(down.updated, 0);
  assert.equal(down.messages[0].content, "新版");
  const flip = Ledger.reconcileIncoming(v2.messages, [ccRow({ revision: 2, content: "新版", deleted_at: "2026-08-11T02:00:00Z" })], "y");
  assert.equal(flip.updated, 1);
  assert.equal(flip.deleted, 1);
  assert.equal(flip.messages[0].recalled, true);
});

test("reconcileIncoming：首次就带 deleted_at 的行入列但不产人格证据", () => {
  const r = Ledger.reconcileIncoming([], [ccRow({ deleted_at: "2026-08-11T02:00:00Z" })], "y");
  assert.equal(r.added, 1);
  assert.equal(r.deleted, 1);
  assert.equal(r.messages[0].recalled, true);
  assert.equal(r.personalityEvents.length, 0);
});

test("reconcileIncoming：完整 turn 只压同侧句段——lisa 侧句段不受 character 侧完整 turn 影响", () => {
  const rows = [
    ccRow({ message_key: "full", metadata: { sync_kind: "continuity", turn_id: "t1" } }),
    ccRow({ message_key: "seg-char", content: "角色句段", metadata: { sync_kind: "emotion", turn_id: "t1" } }),
    ccRow({ message_key: "seg-lisa", speaker_type: "lisa", content: "Lisa句段", metadata: { sync_kind: "life", turn_id: "t1" } })
  ];
  const r = Ledger.reconcileIncoming([], rows, "y");
  assert.equal(r.messages.some(m => m.content === "角色句段"), false); // 同侧被压
  assert.equal(r.messages.some(m => m.content === "Lisa句段"), true);  // 异侧照常投影
  assert.equal(r.personalityEvents.some(e => e.content === "角色句段"), true); // 证据保留
});

test("reconcileIncoming：eventKey 带修订号且修订下限为 1", () => {
  const r = Ledger.reconcileIncoming([], [ccRow({ revision: 0 })], "y");
  assert.equal(r.personalityEvents[0].eventKey, "cc:k1:1");
  assert.equal(r.messages[0].ledgerRevision, 1);
});

test("reconcileIncoming：产出按 ts 升序排好，App 原消息保持在正确时间位", () => {
  const base = [{ role: "user", content: "App", ts: Date.parse("2026-08-11T01:30:00Z") }];
  const r = Ledger.reconcileIncoming(base, [
    ccRow({ message_key: "late", occurred_at: "2026-08-11T02:00:00Z" }),
    ccRow({ message_key: "early", occurred_at: "2026-08-11T01:00:00Z" })
  ], "y");
  assert.deepEqual(r.messages.map(m => m.ledgerKey || "app"), ["early", "app", "late"]);
});

// ---------- reconcileContinuity ----------

const contRow = (i, over) => ({
  message_key: "k" + String(i).padStart(2, "0"), char_id: "y", source: "cc", thread_id: "s",
  speaker_type: "character", content: "第" + i + "句",
  occurred_at: new Date(Date.parse("2026-08-11T00:00:00Z") + i * 60000).toISOString(),
  metadata: { sync_kind: "continuity" }, ...over
});

test("reconcileContinuity：窗口下限 10、上限 200，超窗只留最新", () => {
  const rows = Array.from({ length: 12 }, (_, i) => contRow(i));
  const kept = Ledger.reconcileContinuity([], rows, "y", 5); // 5 被抬到下限 10
  assert.equal(kept.length, 10);
  assert.equal(kept[0].message_key, "k02"); // 最旧两条被裁
  assert.equal(kept[9].message_key, "k11");
});

test("reconcileContinuity：deleted_at 从滚动窗移除既有行；坏行（串号/非 continuity/空正文）不进窗", () => {
  const base = Ledger.reconcileContinuity([], [contRow(1)], "y");
  const afterDel = Ledger.reconcileContinuity(base, [contRow(1, { deleted_at: "2026-08-11T09:00:00Z" })], "y");
  assert.equal(afterDel.length, 0);
  const junk = Ledger.reconcileContinuity([], [
    contRow(2, { char_id: "别人" }),
    contRow(3, { metadata: { sync_kind: "life" } }),
    contRow(4, { content: "  " })
  ], "y");
  assert.equal(junk.length, 0);
});

test("reconcileContinuity：同刻并列按 message_key 字典序稳定排序，同键覆盖不重复", () => {
  const t = "2026-08-11T05:00:00Z";
  const kept = Ledger.reconcileContinuity([], [
    contRow(9, { message_key: "b", occurred_at: t }),
    contRow(8, { message_key: "a", occurred_at: t }),
    contRow(7, { message_key: "a", occurred_at: t, content: "覆盖后" })
  ], "y");
  assert.deepEqual(kept.map(r => r.message_key), ["a", "b"]);
  assert.equal(kept[0].content, "覆盖后");
});

// ---------- continuityPrompt ----------

test("continuityPrompt：空窗/全被时间闸滤掉时返回空串（不产生空亲历块）", () => {
  assert.equal(Ledger.continuityPrompt([], "Lisa"), "");
  const rows = [contRow(1)];
  assert.equal(Ledger.continuityPrompt(rows, "Lisa", 30, Date.parse("2026-08-12T00:00:00Z")), "");
});

test("continuityPrompt：来源标签与人称——stackchan=桌面身体、cc=CC窗口、lisa 用称呼、character 用「你」", () => {
  const p = Ledger.continuityPrompt([
    contRow(1, { speaker_type: "lisa", source: "stackchan" }),
    contRow(2, { speaker_type: "character", source: "cc" })
  ], "阿栗");
  assert.match(p, /桌面身体\] 阿栗：/);
  assert.match(p, /CC窗口\] 你：/);
});

test("continuityPrompt：limit 夹在 4~60，maxLineChars 下限 80 并按上限截断加省略号", () => {
  const rows = Array.from({ length: 6 }, (_, i) => contRow(i));
  const p1 = Ledger.continuityPrompt(rows, "Lisa", 1); // 1 → 至少 4 条
  assert.doesNotMatch(p1, /第0句|第1句/);
  assert.match(p1, /第2句/);
  const long = contRow(1, { content: "长".repeat(200) });
  const p2 = Ledger.continuityPrompt([long], "Lisa", 30, 0, 10); // 10 → 抬到 80
  assert.match(p2, new RegExp("长{79}…"));
  assert.doesNotMatch(p2, new RegExp("长{80}"));
});

test("continuityPrompt：坏 occurred_at 标「时间未知」，多空白正文压成单空格", () => {
  const p = Ledger.continuityPrompt([contRow(1, { occurred_at: "咕", content: "两  行\n正文" })], "Lisa");
  assert.match(p, /时间未知/);
  assert.match(p, /两 行 正文/);
});

// ---------- modelHistory ----------

test("modelHistory：只裁「ledgerImported+continuity+cc/stackchan」三条件齐备的行", () => {
  const keepers = [
    { id: 1, ledgerImported: true, syncKind: "emotion", crossSource: "cc" },     // 非 continuity
    { id: 2, syncKind: "continuity", crossSource: "cc" },                         // 非 imported
    { id: 3, ledgerImported: true, syncKind: "continuity", crossSource: "bridge" }, // 来源不在名单
    { id: 4 }
  ];
  const cut = [
    { id: 5, ledgerImported: true, syncKind: "continuity", crossSource: "cc" },
    { id: 6, ledgerImported: true, syncKind: "continuity", crossSource: "stackchan" }
  ];
  assert.deepEqual(Ledger.modelHistory([...keepers, ...cut]).map(m => m.id), [1, 2, 3, 4]);
  assert.deepEqual(Ledger.modelHistory(null), []);
});

// ---------- restoreAppRows ----------

const cloudRow = over => ({
  message_key: "app:private:y:legacy", source: "app", thread_type: "private", thread_id: "y",
  speaker_type: "lisa", content: "云端有的", occurred_at: "2026-08-13T10:00:00Z",
  metadata: {}, ...over
});

test("restoreAppRows：不合格上下文与坏行（软删/非 app/串线/appcc:/桥行/空文）全滤", async () => {
  assert.deepEqual(await Ledger.restoreAppRows(null, [], [cloudRow()]), { missing: [] });
  const r = await Ledger.restoreAppRows(PRIV, [], [
    cloudRow({ deleted_at: "x" }),
    cloudRow({ source: "cc" }),
    cloudRow({ thread_type: "offline" }),
    cloudRow({ thread_id: "别人" }),
    cloudRow({ message_key: "appcc:桥来的" }),
    cloudRow({ metadata: { bridge_kind: "note" } }),
    cloudRow({ content: "  " })
  ]);
  assert.deepEqual(r.missing, []);
});

test("restoreAppRows：强 ID 命中与「同侧同文±15分钟」软对账都算已有，宁漏不重", async () => {
  const T = Date.parse("2026-08-13T10:00:00Z");
  const existing = [
    { id: "m1", role: "user", content: "有强ID的", ts: T },
    { id: "m2", role: "user", content: "同文软对账", ts: T }
  ];
  const r = await Ledger.restoreAppRows(PRIV, existing, [
    cloudRow({ message_key: "app:private:y:m1", content: "有强ID的" }),                       // 键命中
    cloudRow({ message_key: "app:private:y:另一个键", content: "同文软对账",
      occurred_at: new Date(T + 14 * 60000).toISOString() }),                                  // 14 分钟内 → 跳过
    cloudRow({ message_key: "app:private:y:超窗", content: "同文软对账",
      occurred_at: new Date(T + 16 * 60000).toISOString() })                                   // 16 分钟外 → 补
  ]);
  assert.equal(r.missing.length, 1);
  assert.match(r.missing[0].id, /^rst_/); // 无 source_message_id → 造稳定还原 id
  assert.equal(r.missing[0].content, "同文软对账");
  assert.equal(r.missing[0].ledgerRestored, true);
});

test("restoreAppRows：角色映射——线下角色行还原成 char，群线才带 senderId，kind 随 metadata", async () => {
  const ctx = { charId: "y", threadType: "group_offline", threadId: "g", groupMemberIds: ["y", "a"] };
  const r = await Ledger.restoreAppRows(ctx, [], [
    cloudRow({ thread_type: "group_offline", thread_id: "g", speaker_type: "character",
      speaker_id: "a", content: "旁人的线下话", metadata: { message_kind: "action" },
      occurred_at: "2026-08-13T11:00:00Z" }),
    cloudRow({ thread_type: "group_offline", thread_id: "g", speaker_type: "narration",
      content: "旁白", occurred_at: "2026-08-13T10:30:00Z" })
  ]);
  assert.equal(r.missing.length, 2);
  assert.deepEqual(r.missing.map(m => m.role), ["narration", "char"]); // 按 ts 升序
  const charMsg = r.missing[1];
  assert.equal(charMsg.senderId, "a");
  assert.equal(charMsg.kind, "action");
  assert.equal(r.missing[0].senderId, undefined); // 旁白不带 senderId
});

test("restoreAppRows：source_message_id 还原为原 id，缺失时造 rst_ 前缀稳定 id", async () => {
  const r = await Ledger.restoreAppRows(PRIV, [], [
    cloudRow({ message_key: "app:private:y:orig9", source_message_id: "orig9", content: "有原ID" }),
    cloudRow({ message_key: "app:private:y:sha256:abcd", content: "只有指纹键" })
  ]);
  const byContent = c => r.missing.find(m => m.content === c);
  assert.equal(byContent("有原ID").id, "orig9");
  assert.match(byContent("只有指纹键").id, /^rst_/);
});

// ---------- findYanqiu ----------

test("findYanqiu：engineerEyes 标记多于一人时弃用标记、按名字后备；无线索返回 null", () => {
  const chars = [{ id: "a", name: "阿屿" }, { id: "k", name: "小克" }];
  const marked2 = { a: { engineerEyes: true }, k: { engineerEyes: true } };
  assert.equal(Ledger.findYanqiu(chars, marked2).id, "k"); // 双标记 → 名字正则找到小克
  assert.equal(Ledger.findYanqiu([{ id: "q", name: "言秋" }], {}).id, "q");
  assert.equal(Ledger.findYanqiu([{ id: "x", name: "许言秋" }], null).id, "x");
  assert.equal(Ledger.findYanqiu([{ id: "a", name: "阿屿" }], {}), null);
  assert.equal(Ledger.findYanqiu(null, null), null);
});
