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

// 第二批（她 2026-10-14「都做吧。还有让它可以把网易云换成 GD 音乐台，知道世界书有什么用、照做，生图能干啥」）
test("群聊设置、线下设置、全局开关：照名单改，名单外和超范围不认", () => {
  const got = [];
  const ctx = { characters: [{ id: "c1", name: "陆衍" }], groupsList: () => [{ id: "g1", name: "一家人", memberIds: ["c1"] }],
    onPatchGroupSetting: (id, p) => got.push(["g", id, p]), onPatchOfflineSetting: (id, p) => got.push(["o", id, p]),
    onSetGlobal: (k, v) => got.push(["G", k, v]), apiProfiles: [{ id: "r1", name: "便宜的" }] };
  X.TARGETS.gsetting.write("g1:memoryInterop", { text: "开" }, ctx);
  X.TARGETS.gsetting.write("g1:autoChatMin", { text: "15" }, ctx);
  X.TARGETS.osetting.write("c1:tastePace", { text: "慢慢磨" }, ctx);
  X.TARGETS.osetting.write("c1:maxTokens", { text: "8000" }, ctx);
  X.TARGETS.global.write("musicProvider", { text: "GD音乐台" }, ctx);
  X.TARGETS.global.write("bgApi", { text: "无" }, ctx);
  X.TARGETS.global.write("bgApi", { text: "便宜的" }, ctx);
  X.TARGETS.global.write("geoAware", { text: "关" }, ctx);
  assert.deepEqual(got, [["g", "g1", { memoryInterop: true }], ["g", "g1", { autoChatMin: 15 }], ["o", "c1", { tastePace: "slow" }], ["o", "c1", { maxTokens: 8000 }],
    ["G", "musicProvider", "gd"], ["G", "bgApi", "__off__"], ["G", "bgApi", "r1"], ["G", "geoAware", false]]);
  assert.throws(() => X.TARGETS.gsetting.write("g9:drama", { text: "开" }, ctx), /找不到这个群/);
  assert.throws(() => X.TARGETS.osetting.write("c1:fontSize", { text: "99" }, ctx), /12～22/);
  assert.throws(() => X.TARGETS.global.write("apiKey", { text: "x" }, ctx), /没有/);
});

test("行程、情侣档案、愿望、纪念日、表情包分配", () => {
  const sc = []; const home = { c1: { archive: {}, wishes: [{ id: "w1", title: "去看海", status: "wish" }] } };
  let packs = [{ id: "p1", name: "猫猫", global: true, charIds: [] }]; const ann = [];
  const ctx = { characters: [{ id: "c1", name: "陆衍" }, { id: "c2", name: "沈砚" }],
    onEditSchedSeq: (c, d, n, p) => { sc.push([c, d, n, p]); return 1; },
    coupleHomeOf: id => home[id] || {}, onSaveCoupleHome: (id, fn) => { home[id] = fn(home[id] || {}); },
    annivList: () => ann, onAddAnniv: (ch, name, m, d, y, l, yr) => ann.push({ id: "a1", characterId: ch.id, name, m, d, y, yr }), onRemoveAnniv: id => ann.splice(0),
    emotePacks: () => packs, onSaveEmotePacks: n => { packs = n; return true; } };
  X.TARGETS.sched.write("c1:2026-10-14:2", { name: "去书店", time: "9:30" }, ctx);
  assert.deepEqual(sc[0], ["c1", "2026-10-14", 2, { title: "去书店", time: "09:30" }]);
  X.TARGETS.couple.write("c1:nicknames", { text: "他叫我小狗" }, ctx);
  assert.equal(home.c1.archive.nicknames, "他叫我小狗");
  X.TARGETS.wish.write("c1:new", { name: "一起包饺子", type: "一起吃" }, ctx);
  X.TARGETS.wish.write("c1:w1", { done: true }, ctx);
  assert.equal(home.c1.wishes[0].title, "一起包饺子");
  assert.equal(home.c1.wishes.find(w => w.id === "w1").status, "done");
  X.TARGETS.anniv.write("c1:new", { name: "第一次见面", date: "2024-03-14" }, ctx);
  assert.deepEqual([ann[0].m, ann[0].d, ann[0].yr, ann[0].y], [3, 14, 2024, true]);
  X.TARGETS.emote.write("p1", { text: "陆衍、沈砚" }, ctx);
  assert.deepEqual([packs[0].global, packs[0].charIds], [false, ["c1", "c2"]]);
  X.TARGETS.emote.write("p1", { text: "全局" }, ctx);
  assert.equal(packs[0].global, true);
  assert.throws(() => X.TARGETS.emote.write("p1", { text: "路人甲" }, ctx), /没有叫/);
  assert.ok(X.okWithoutText({ target: "wish", id: "c1:w1", done: true }));
});

test("秋秋说明里写着世界书怎么起作用、生图去哪查、音乐源怎么换；App 两处都接了写口", () => {
  const doc = X.docLines();
  ["照做", "生图", "always:true", "stamps", "priority", "GD音乐台", "gsetting", "osetting", "anniv", "emote"].forEach(w => assert.ok(doc.includes(w), w));
  const app = R("js/app.js");
  ["onSetGlobal:", "groupSettingsOf:", "offlineSettingsOf:", "onEditSchedSeq: (id", "onSaveCoupleHome:", "onAddAnniv:", "onSaveEmotePacks:"].forEach(w => assert.ok(app.includes(w), w));
  const man = R("js/assistant-manual.js");
  assert.ok(man.includes('id: "imagegen"') && man.includes("GD音乐台"));
  const as = R("js/assistant.js");
  assert.ok(/stampsOf/.test(as) && /"cat", "stamps", "priority"/.test(as));
});

// 文风台（她 2026-10-16「文风台秋秋能搞吗，比如给它文件」）
test("preset 新建一份：新写的落进模块库、现成的直接勾；presetmod 改／加／勾／拿掉", () => {
  let mods = [], presets = [], edits = {};
  const builtin = { cam_hands: { id: "cam_hands", name: "近景在手上", text: "..." } };
  window.StylePresets = {
    moduleById: id => builtin[id] || mods.find(m => m.id === id) || null,
    importBundle: d => { mods = mods.concat(d.modules || []); },
    upsert: p => { presets = presets.some(x => x.id === p.id) ? presets.map(x => x.id === p.id ? p : x) : presets.concat([p]); },
    byId: id => presets.find(p => p.id === id) || null,
    saveModuleEdit: (id, p) => { edits[id] = p; },
    list: () => presets, allCats: () => []
  };
  X.TARGETS.preset.write("new", { name: "冷笔", text: JSON.stringify([{ name: "不贴情绪标签", hint: "写征兆", text: "别写情绪名" }, { use: "cam_hands" }]) }, {});
  assert.equal(presets.length, 1);
  assert.equal(presets[0].name, "冷笔");
  assert.equal(presets[0].mods.length, 2);
  assert.equal(presets[0].mods[1], "cam_hands");
  assert.equal(mods[0].catZh, "秋秋写的");
  const pid = presets[0].id, mid = presets[0].mods[0];
  X.TARGETS.presetmod.write(pid + ":" + mid, { text: "改短了" }, {});
  assert.equal(edits[mid].text, "改短了");
  X.TARGETS.presetmod.write(pid + ":new", { name: "不写收尾句", text: "最后一句别总结" }, {});
  assert.equal(presets[0].mods.length, 3);
  X.TARGETS.presetmod.write(pid + ":cam_hands", { drop: true }, {});
  assert.ok(presets[0].mods.indexOf("cam_hands") < 0);
  X.TARGETS.presetmod.write(pid + ":+cam_hands", {}, {});
  assert.ok(presets[0].mods.indexOf("cam_hands") >= 0);
  assert.throws(() => X.TARGETS.preset.write("new", { text: "[{\"use\":\"nope\"}]" }, {}), /没有/);
  assert.ok(X.okWithoutText({ target: "presetmod", id: pid + ":+cam_hands" }));
  assert.ok(/preset 文风台/.test(X.docLines()));
});
