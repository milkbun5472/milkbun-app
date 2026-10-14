// 她 2026-10-14：「都做吧，特别是各种设置按钮和拉条可以给清楚，包括小房间各种开关是干啥的」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
global.window = {};
const X = require("../js/assistant-extras.js");

test("聊天设置：开关、数字、选项都认；超范围、名单外的不认", () => {
  const got = []; const ctx = { characters: [{ id: "c1", name: "陆衍" }], onPatchChatSetting: (id, p) => got.push([id, p]) };
  X.TARGETS.setting.write("c1:autoTts", { text: "开" }, ctx);
  X.TARGETS.setting.write("c1:ctxN", { text: "80 条" }, ctx);
  X.TARGETS.setting.write("c1:actPerson", { text: "他／她（第三人称）" }, ctx);
  assert.deepEqual(got, [["c1", { autoTts: true }], ["c1", { ctxN: 80 }], ["c1", { actPerson: "ta" }]]);
  assert.throws(() => X.TARGETS.setting.write("c1:ctxN", { text: "9999" }, ctx), /10～300/);
  assert.throws(() => X.TARGETS.setting.write("c1:apiId", { text: "x" }, ctx), /没有/);
});

test("小房间开关：照 ChatRooms.GROUPS 的名单拨，写回那间房", () => {
  let saved = null;
  window.ChatRooms = { GROUPS: { writeback: [["memoryCandidate", "这里的事可以进记忆", "重要的能进候选箱"]] },
    list: () => [{ id: "main", main: true, writeback: { memoryCandidate: false } }], save: (cid, r) => { saved = r; } };
  X.TARGETS.roomset.write("c1:main:writeback.memoryCandidate", { text: "开" }, { onRoomsChanged() {} });
  assert.equal(saved.writeback.memoryCandidate, true);
  assert.throws(() => X.TARGETS.roomset.write("c1:main:writeback.nope", { text: "开" }, {}), /没有/);
  assert.equal(X.roomSwitchRows({ writeback: {} })[0].叫什么, "这里的事可以进记忆");
});

test("记忆库能改能删；衣柜加改删；日历新建改删", () => {
  let mem = [{ id: "m1", text: "旧", charIds: ["c1"] }, { id: "m2", text: "删我" }];
  const mctx = { memList: () => mem, onSaveMemLib: l => { mem = l; } };
  X.TARGETS.memedit.write("m1", { text: "新" }, mctx); X.TARGETS.memedit.write("m2", { drop: true }, mctx);
  assert.deepEqual(mem.map(e => e.text), ["新"]);
  let box = {}; const cctx = { closetOf: () => box, onSaveCloset: (id, b) => { box = b; } };
  X.TARGETS.closet.write("c1", { name: "冬天大衣", text: "驼色长款", occasion: "出门" }, cctx);
  X.TARGETS.closet.write("c1", { name: "冬天大衣", text: "黑色长款" }, cctx);
  assert.equal(box.closet[0].sets[0].note, "黑色长款");
  X.TARGETS.closet.write("c1", { name: "冬天大衣", drop: true }, cctx);
  assert.equal(box.closet.length, 0);
  let cal = { world: {}, chars: {}, mine: {} }; const kctx = { calendarGet: () => cal, onSaveCalendar: n => { cal = n; } };
  X.TARGETS.cal.write("new", { date: "2026-03-14", name: "第一次见面", text: "" }, kctx);
  const id = cal.mine["2026-03-14"][0].id;
  X.TARGETS.cal.write(id, { date: "2026-03-15" }, kctx);
  assert.ok(cal.mine["2026-03-15"] && !cal.mine["2026-03-14"]);
  X.TARGETS.cal.write(id, { drop: true }, kctx);
  assert.deepEqual(cal.mine, {});
  assert.ok(X.okWithoutText({ target: "memedit", id: "m1", drop: true }));
  assert.ok(!X.okWithoutText({ target: "persona", id: "c1", drop: true }));
});

test("查毛病只看不改：线路没选模型要写明；密钥本身不给", () => {
  const out = X.snapshotExtra({ characters: [{ id: "c1", name: "陆衍" }], routeInfo: () => ({ name: "主线", model: "", hasKey: true, own: false }), autoInfo: () => "日记：开" }, new Set(["c1"]));
  assert.match(out.线路和自动功能[0].模型, /没选模型/);
  const app = R("js/app.js");
  assert.match(app, /hasKey: !!\(r\.apiKey \|\| r\.proxyRef\)/);
  assert.doesNotMatch(app.slice(app.indexOf("const assistExtraCtx"), app.indexOf("const assistExtraCtx") + 2000), /apiKey: r\.apiKey/);
});

test("接进秋秋：整页和悬浮屏都给；说明书写进提示词；脚本挂在 assistant.js 前面", () => {
  const app = R("js/app.js"), a = R("js/assistant.js"), idx = R("index.html");
  assert.equal((app.match(/\.\.\.assistExtraCtx\(\),/g) || []).length, 2);
  assert.match(a, /Object\.assign\(TARGETS, window\.AssistExtras\.TARGETS\)/);
  assert.match(a, /window\.AssistExtras\.docLines\(\)/);
  assert.ok(idx.indexOf("assistant-extras.js") > 0 && idx.indexOf("assistant-extras.js") < idx.indexOf("js/assistant.js?v="));
  assert.match(X.docLines(), /autoTts「新消息自动念」/);
});

test("线路、面具、自动功能、会删东西的那几样也能出卡；删的卡必带先导出", () => {
  const got = []; const ctx = { characters: [{ id: "c1", name: "陆衍" }], apiProfiles: [{ id: "r1", name: "便宜线" }],
    masks: () => [{ id: "k2", name: "小号" }], onPatchChatSetting: (id, p) => got.push(p) };
  X.TARGETS.setting.write("c1:apiId", { text: "便宜线" }, ctx);
  X.TARGETS.setting.write("c1:apiId", { text: "跟随全局" }, ctx);
  X.TARGETS.setting.write("c1:maskId", { text: "小号" }, ctx);
  assert.deepEqual(got, [{ apiId: "r1" }, { apiId: null }, { maskId: "k2" }]);
  assert.throws(() => X.TARGETS.setting.write("c1:apiId", { text: "不存在" }, ctx), /现有的：便宜线/);
  window.AutoRefreshPolicy = { FEATURES: [{ id: "proactive", title: "主动私聊", sub: "", rates: [{ id: "high", zh: "高频" }] }] };
  const a = []; const actx = { onSetAuto: (f, c, on) => a.push([f, on]), onSetAutoRate: (f, c, r) => a.push([f, r]) };
  X.TARGETS.auto.write("c1:proactive", { text: "开" }, actx); X.TARGETS.auto.write("c1:proactive", { text: "高频" }, actx);
  assert.deepEqual(a, [["proactive", true], ["proactive", "high"]]);
  const d = []; const dctx = { characters: [{ id: "c1" }], onDeleteChar: id => d.push("del " + id), onClearChat: (id, m) => d.push("clear " + id + " " + m) };
  X.TARGETS.danger.write("delchar:c1", {}, dctx); X.TARGETS.danger.write("clearchatmem:c1", {}, dctx);
  assert.deepEqual(d, ["del c1", "clear c1 true"]);
  assert.match(X.DANGER_WARN, /导出全部数据/);
  assert.match(X.docLines(), /reply 里必须先说这一句/);
});
