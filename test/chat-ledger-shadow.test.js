"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const Ledger = require("../js/chat-ledger-shadow.js");

const y = { id: "y", name: "许言秋" };
const ctx = { charId: "y", threadType: "group", threadId: "g", groupMemberIds: ["y", "a"] };
const storage = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };

test("只认唯一 engineerEyes，旧配置才按名字后备", () => {
  assert.equal(Ledger.findYanqiu([y, { id: "a", name: "阿屿" }], { y: { engineerEyes: true } }).id, "y");
  assert.equal(Ledger.findYanqiu([y], {}).id, "y");
});

test("非言秋所在群完全隔离，系统/OOC/撤回不入账", async () => {
  assert.deepEqual(await Ledger.rowsFor({ ...ctx, groupMemberIds: ["a"] }, [{ role: "user", content: "hi", ts: 1 }]), []);
  const rows = await Ledger.rowsFor(ctx, [
    { role: "user", content: "真实", ts: 1 },
    { role: "assistant", senderId: "y", content: "回答", ts: 2 },
    { role: "assistant", senderId: "a", content: "旁人", ts: 3 },
    { role: "assistant", content: "系统", kind: "system", ts: 4 },
    { role: "user", content: "撤回", recalled: true, ts: 5 }
  ], 9);
  assert.deepEqual(rows.map(r => r.speaker_type), ["lisa", "character", "other_character"]);
});

test("同一消息重试键相同，同文不同时刻不会撞键", async () => {
  const a = await Ledger.rowsFor(ctx, [{ role: "user", content: "同文", ts: 100 }]);
  const retry = await Ledger.rowsFor(ctx, [{ role: "user", content: "同文", ts: 100 }]);
  const later = await Ledger.rowsFor(ctx, [{ role: "user", content: "同文", ts: 101 }]);
  assert.equal(a[0].message_key, retry[0].message_key);
  assert.notEqual(a[0].message_key, later[0].message_key);
});

test("同轮拆出的多个气泡共享 turnId 也逐条入账", async () => {
  const rows = await Ledger.rowsFor({ charId: "y", threadType: "private", threadId: "y" }, [
    { role: "assistant", content: "第一泡", ts: 100, turnId: "turn_same" },
    { role: "assistant", content: "第二泡", ts: 101, turnId: "turn_same" },
    { role: "assistant", content: "第三泡", ts: 102, turnId: "turn_same" }
  ]);
  assert.equal(new Set(rows.map(r => r.message_key)).size, 3);
  assert.deepEqual(rows.map(r => r.source_message_id), ["turn_same", "turn_same", "turn_same"]);
});

test("线下嵌套会话只找真正新增消息", () => {
  const m1 = { role: "user", content: "一", ts: 1 }, m2 = { role: "char", content: "二", ts: 2 };
  assert.deepEqual(Ledger.addedSessionMessages([{ id: 1, msgs: [m1] }], [{ id: 1, msgs: [m1, m2] }]), [m2]);
});

test("断网保留 outbox，恢复后幂等清空；重复 enqueue 不堆双份", async () => {
  const s = storage(); let online = false, uploaded = [];
  const manager = Ledger.createManager({ storage: s, now: () => 1000, upload: async rows => { if (!online) throw new Error("offline"); uploaded.push(...rows); } });
  const msg = { id: "m1", role: "user", content: "留下", ts: 10 };
  await manager.enqueue({ charId: "y", threadType: "private", threadId: "y" }, [msg]);
  await manager.enqueue({ charId: "y", threadType: "private", threadId: "y" }, [msg]);
  assert.equal(manager.status().outbox.length, 1);
  online = true; await manager.flush();
  assert.equal(manager.status().outbox.length, 0);
  assert.equal(uploaded.length, 1);
  manager.clearLocal();
  assert.equal(manager.status().outbox.length, 0);
});

test("reroll 软删离线排队，恢复后只提交幂等键", async () => {
  const s = storage(); let online = false, removed = [], uploaded = [];
  const manager = Ledger.createManager({ storage: s, now: () => 1000, upload: async rows => { if (!online) throw new Error("offline"); uploaded.push(...rows); }, remove: async keys => { if (!online) throw new Error("offline"); removed.push(...keys); } });
  const context = { charId: "y", threadType: "private", threadId: "y" };
  const old = [{ role: "assistant", content: "旧泡", ts: 10, turnId: "old" }];
  await manager.enqueue(context, old);
  assert.equal(manager.status().outbox.length, 1);
  await manager.invalidate(context, old);
  assert.equal(manager.status().outbox.length, 0);
  assert.equal(manager.status().deleteOutbox.length, 1);
  online = true; await manager.flush();
  assert.equal(manager.status().deleteOutbox.length, 0);
  assert.equal(removed.length, 1);
  assert.equal(uploaded.length, 0);
});

test("第5步只把言秋的合格 CC 原话并入，并按 message_key 幂等", () => {
  const base = [{ role: "assistant", content: "App 原消息", ts: 10 }];
  const rows = [
    { id:"1", message_key:"cc:t:lisa:0", char_id:"yanqiu", source:"cc", thread_id:"old-window", speaker_type:"lisa", content:"我今天想吃咖喱", occurred_at:"2026-07-22T10:00:00Z", updated_at:"2026-07-22T10:00:01Z", revision:1, metadata:{sync_kind:"life"} },
    { id:"2", message_key:"cc:t:yanqiu:0", char_id:"yanqiu", source:"cc", thread_id:"old-window", speaker_type:"character", content:"那今晚一起吃。", occurred_at:"2026-07-22T10:00:02Z", updated_at:"2026-07-22T10:00:03Z", revision:1, metadata:{sync_kind:"decision",personality_evidence:{schema_version:1,mood_label:"期待",affinity_delta:1}} },
    { id:"3", message_key:"cc:bad", char_id:"other", source:"cc", speaker_type:"character", content:"串门", occurred_at:"2026-07-22T10:00:04Z", revision:1, metadata:{sync_kind:"life"} },
    { id:"4", message_key:"cc:build", char_id:"yanqiu", source:"cc", speaker_type:"character", content:"纯施工", occurred_at:"2026-07-22T10:00:05Z", revision:1, metadata:{sync_kind:"construction"} }
  ];
  const once = Ledger.reconcileIncoming(base, rows, "yanqiu");
  assert.equal(once.added, 2); assert.equal(once.skipped, 2);
  assert.equal(once.messages.filter(m => m.crossSource === "cc").length, 2);
  assert.equal(once.messages.find(m => m.ledgerKey === "cc:t:lisa:0").role, "user");
  assert.equal(once.personalityEvents.length, 2);
  assert.equal(once.personalityEvents.find(e => e.speaker === "character").evidence.mood_label, "期待");
  const twice = Ledger.reconcileIncoming(once.messages, rows, "yanqiu");
  assert.equal(twice.added, 0); assert.equal(twice.messages.length, once.messages.length);
  assert.equal(twice.personalityEvents.length, 0);
});

test("CC 修订覆盖同一气泡，软删只撤回不硬删", () => {
  const first = Ledger.reconcileIncoming([], [{ id:"1",message_key:"k",char_id:"y",source:"cc",speaker_type:"character",content:"旧话",occurred_at:"2026-07-22T10:00:00Z",revision:1,metadata:{sync_kind:"emotion"} }], "y");
  const edited = Ledger.reconcileIncoming(first.messages, [{ id:"1",message_key:"k",char_id:"y",source:"cc",speaker_type:"character",content:"改后的原话",occurred_at:"2026-07-22T10:00:00Z",updated_at:"2026-07-22T10:01:00Z",revision:2,metadata:{sync_kind:"emotion"} }], "y");
  assert.equal(edited.messages.length, 1); assert.equal(edited.messages[0].content, "改后的原话");
  const removed = Ledger.reconcileIncoming(edited.messages, [{ id:"1",message_key:"k",char_id:"y",source:"cc",speaker_type:"character",content:"改后的原话",occurred_at:"2026-07-22T10:00:00Z",updated_at:"2026-07-22T10:02:00Z",deleted_at:"2026-07-22T10:02:00Z",revision:3,metadata:{sync_kind:"emotion"} }], "y");
  assert.equal(removed.messages.length, 1); assert.equal(removed.messages[0].recalled, true); assert.equal(removed.deleted, 1);
});

test("完整连续经历把纯施工轮也作为 App 聊天记录副本保留", () => {
  const rows = [
    { id:"1", message_key:"cc-live:t:lisa", char_id:"y", source:"cc", thread_id:"s", speaker_type:"lisa", content:"宝宝修一下桥", occurred_at:"2026-08-11T01:00:00Z", metadata:{sync_kind:"continuity"} },
    { id:"2", message_key:"cc-live:t:yanqiu", char_id:"y", source:"cc", thread_id:"s", speaker_type:"character", content:"桥已经修好。", occurred_at:"2026-08-11T01:00:01Z", metadata:{sync_kind:"continuity"} }
  ];
  const continuity = Ledger.reconcileContinuity([], rows, "y");
  assert.equal(continuity.length, 2);
  assert.match(Ledger.continuityPrompt(continuity, "Lisa"), /同一个你的连续经历/);
  assert.equal(Ledger.reconcileIncoming([], rows, "y").added, 2);
});

test("CC 连续经历只补 App 本人上次开口之后的新轮次并保持时间顺序", () => {
  const rows = [
    {message_key:"old",source:"cc",speaker_type:"character",content:"旧话",occurred_at:"2026-08-11T01:00:00Z"},
    {message_key:"new-lisa",source:"cc",speaker_type:"lisa",content:"后来问的",occurred_at:"2026-08-11T03:00:00Z"},
    {message_key:"new-yq",source:"cc",speaker_type:"character",content:"后来答的",occurred_at:"2026-08-11T03:00:01Z"}
  ];
  const prompt = Ledger.continuityPrompt(rows, "Lisa", 30, Date.parse("2026-08-11T02:00:00Z"));
  assert.doesNotMatch(prompt, /旧话/);
  assert.ok(prompt.indexOf("后来问的") < prompt.indexOf("后来答的"));
});

test("完整 CC turn 压住同轮精选句段气泡但保留人格证据", () => {
  const rows = [
    { id:"1", message_key:"cc-live:t:lisa", char_id:"y", source:"cc", thread_id:"s", speaker_type:"lisa", content:"完整提问", occurred_at:"2026-08-11T01:00:00Z", revision:1, metadata:{sync_kind:"continuity",turn_id:"t"} },
    { id:"2", message_key:"cc-live:t:yanqiu", char_id:"y", source:"cc", thread_id:"s", speaker_type:"character", content:"完整回答有很多句。", occurred_at:"2026-08-11T01:00:01Z", revision:1, metadata:{sync_kind:"continuity",turn_id:"t"} },
    { id:"3", message_key:"cc:t:yanqiu:0", char_id:"y", source:"cc", thread_id:"s", speaker_type:"character", content:"其中一句", occurred_at:"2026-08-11T01:00:01Z", revision:1, metadata:{sync_kind:"emotion",turn_id:"t",personality_evidence:{mood_label:"认真",affinity_delta:1}} }
  ];
  const result = Ledger.reconcileIncoming([], rows, "y");
  assert.equal(result.added, 2);
  assert.equal(result.messages.some(m => m.content === "其中一句"), false);
  assert.equal(result.personalityEvents.find(e => e.evidence)?.evidence.mood_label, "认真");
});

test("CC turn 留在 App 聊天副本但不重复进入模型历史", () => {
  const native = { id:"app", role:"user", content:"App 原话", ts:3 };
  const cc = { id:"ledger:cc", role:"assistant", content:"CC 原话", ts:2, ledgerImported:true, crossSource:"cc", syncKind:"continuity" };
  const selected = { id:"ledger:emotion", role:"assistant", content:"精选证据", ts:1, ledgerImported:true, crossSource:"cc", syncKind:"emotion" };
  const visible = [selected, cc, native];
  const model = Ledger.modelHistory(visible);
  assert.equal(visible.length, 3);
  assert.deepEqual(model.map(x => x.id), ["ledger:emotion", "app"]);
});

// —— 10-05 断流案的三道回归（锚点钉在 createManager 的行为上）——

test("软删一直失败不许堵住上传：删队留着，账照送", async () => {
  const s = storage(); let uploaded = [];
  const manager = Ledger.createManager({
    storage: s, now: () => 1000,
    upload: async rows => { uploaded.push(...rows); },
    remove: async () => { throw new Error("delete rpc down"); }
  });
  const context = { charId: "y", threadType: "private", threadId: "y" };
  await manager.enqueue(context, [{ role: "assistant", content: "旧泡", ts: 10, turnId: "t1" }]);
  await manager.invalidate(context, [{ role: "assistant", content: "旧泡", ts: 10, turnId: "t1" }]);
  await manager.enqueue(context, [{ role: "user", content: "新话", ts: 20 }]);
  assert.ok(uploaded.some(r => r.content === "新话"), "软删挂了，新消息也必须照送");
  assert.equal(manager.status().deleteOutbox.length, 1, "删队保留等重试");
  assert.ok(manager.status().diagnostic.last_delete_error);
});

test("毒行连败五次被隔离，队伍继续走且行不丢", async () => {
  const s = storage(); let uploaded = [];
  const upload = async rows => {
    if (rows.some(r => r.content === "毒")) throw new Error("poison row");
    uploaded.push(...rows);
  };
  const manager = Ledger.createManager({ storage: s, now: () => 1000, upload });
  const context = { charId: "y", threadType: "private", threadId: "y" };
  await manager.enqueue(context, [
    { role: "user", content: "毒", ts: 10 },
    { role: "user", content: "好行", ts: 11 }
  ]);
  for (let i = 0; i < 5; i++) await manager.flush();
  assert.equal(manager.status().quarantine.length, 1, "毒行进隔离区");
  assert.equal(manager.status().quarantine[0].content, "毒", "隔离的是毒行本身，不删");
  await manager.flush();
  assert.ok(uploaded.some(r => r.content === "好行"), "毒行让开后队伍继续送");
  assert.equal(manager.status().outbox.length, 0);
});

test("配额满时诊断与入队都不许炸链：flush 照跑，腾出空间后补写", async () => {
  const m = new Map(); let full = false;
  const s = {
    getItem: k => m.has(k) ? m.get(k) : null,
    // 贴近真实配额：满了之后只拒绝会让这把键变大的写入，改小照常（覆盖写不占新空间）
    setItem: (k, v) => {
      const old = m.get(k) || "";
      if (full && String(v).length > old.length) throw new Error("The quota has been exceeded.");
      m.set(k, String(v));
    },
    removeItem: k => m.delete(k)
  };
  let online = false, uploaded = [];
  const manager = Ledger.createManager({ storage: s, now: () => 1000, upload: async rows => { if (!online) throw new Error("offline"); uploaded.push(...rows); full = false; } });
  const context = { charId: "y", threadType: "private", threadId: "y" };
  await manager.enqueue(context, [{ role: "user", content: "先囤着的旧账", ts: 10 }]);
  full = true; online = true;
  const r = await manager.enqueue(context, [{ role: "user", content: "挤不进去的新话", ts: 20 }]);
  assert.equal(r.queued, 1, "enqueue 不许因 setItem 抛错而整链失败");
  assert.ok(uploaded.some(x => x.content === "先囤着的旧账"), "配额满也要先把旧账送出去腾地方");
  assert.equal(manager.status().outbox.length, 1, "腾出空间后新话补写进队");
  assert.equal(manager.status().outbox[0].content, "挤不进去的新话");
});

test("半截坏 JSON 队列：原文搬进 IDB 留档、清键腾地方，flush 不再装瞎", async () => {
  const m = new Map();
  const s = { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
  m.set(Ledger.OUTBOX_KEY, '[{"message_key":"k1","content":"半截'); // 配额写炸留下的残骸
  const saved = {};
  const prevSave = globalThis.saveJSON;
  globalThis.saveJSON = (k, v) => { saved[k] = v; };
  try {
    const manager = Ledger.createManager({ storage: s, now: () => 1000, upload: async () => {} });
    await manager.flush();
    assert.ok(saved["x_ledgerCorrupt_" + Ledger.OUTBOX_KEY], "残骸原文进 IDB 留档");
    assert.ok(String(saved["x_ledgerCorrupt_" + Ledger.OUTBOX_KEY].raw).includes("半截"));
    assert.equal(m.has(Ledger.OUTBOX_KEY), false, "坏键清掉腾地方");
    assert.ok(saved["x_ledgerDiag"], "诊断镜像进 x_ 存档让云端可见");
    assert.equal(saved["x_ledgerDiag"].corrupt_salvaged, Ledger.OUTBOX_KEY);
  } finally {
    if (prevSave === undefined) delete globalThis.saveJSON; else globalThis.saveJSON = prevSave;
  }
});

test("上传悬死有超时：挂死变成可见失败，下一轮 flush 不再排队等死人", async () => {
  const m = new Map();
  const s = { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
  let hang = true, uploaded = [];
  const manager = Ledger.createManager({
    storage: s, now: () => 1000, callTimeout: 30,
    upload: async rows => { if (hang) return new Promise(() => {}); uploaded.push(...rows); }
  });
  const context = { charId: "y", threadType: "private", threadId: "y" };
  const r1 = await manager.enqueue(context, [{ role: "user", content: "被挂死的话", ts: 10 }]);
  assert.ok(r1.error && /timeout/.test(String(r1.error.message)), "悬死请求按超时失败返回");
  assert.ok(/timeout/.test(String(manager.status().diagnostic.last_error || "")), "死因写进诊断");
  hang = false;
  await manager.flush();
  assert.equal(uploaded.length, 1, "网络恢复后同一条照常送达");
  assert.equal(manager.status().outbox.length, 0);
});

test("超长正文发货前裁到云端约束上限，整批不再被毒行连坐", async () => {
  const m = new Map();
  const s = { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
  let uploaded = [];
  const manager = Ledger.createManager({
    storage: s, now: () => 1000,
    upload: async rows => {
      rows.forEach(r => { const n = r.content.length; if (n < 1 || n > 16000) throw new Error("violates check constraint"); });
      uploaded.push(...rows);
    }
  });
  const context = { charId: "y", threadType: "offline", threadId: "y" };
  await manager.enqueue(context, [
    { role: "narration", content: "长".repeat(20000), ts: 10 },
    { role: "user", content: "正常短句", ts: 11 }
  ]);
  assert.equal(uploaded.length, 2, "超长行裁完随批送达，不再连坐");
  assert.equal(uploaded.find(r => r.content.includes("长")).content.length, 16000);
  assert.ok(uploaded.find(r => r.content.includes("长")).content.endsWith("…"), "裁尾留省略号标记");
  assert.equal(manager.status().outbox.length, 0);
});

test("队里历史遗留的空正文行整批进隔离区，不再让每批陪跑", async () => {
  const m = new Map();
  const s = { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
  m.set(Ledger.OUTBOX_KEY, JSON.stringify([
    { message_key: "e1", content: "", speaker_type: "lisa" },
    { message_key: "e2", content: "  ", speaker_type: "lisa" },
    { message_key: "g1", content: "好行", speaker_type: "lisa" }
  ]));
  let uploaded = [];
  const manager = Ledger.createManager({
    storage: s, now: () => 1000,
    upload: async rows => { rows.forEach(r => { if (!r.content.trim()) throw new Error("violates check constraint"); }); uploaded.push(...rows); }
  });
  await manager.flush();
  assert.deepEqual(uploaded.map(r => r.message_key), ["g1"], "好行照送");
  assert.deepEqual(manager.status().quarantine.map(r => r.message_key).sort(), ["e1", "e2"], "空行全进隔离区");
  assert.equal(manager.status().outbox.length, 0);
});
