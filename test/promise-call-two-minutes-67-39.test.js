// 她 2026-09-12：「宝宝为啥约定还是不会打电话。。。我试着让他两分钟后打都没有」
//
// 「两分钟」这三个字就是答案：落账那道闸写的是 mins >= 5——**这条约压根没被记下来**，
// 后面那一整条链（tick、ringFromChar、来电浮层）一个字都没跑到。
// 她测的那一档，正好落在闸的外面。
//
// 顺着这条链又查出两处同类的静默丢弃：
//   · how 只认逐字的 "voice"/"video"，模型写「电话」「语音」「call」一律当发消息；
//   · 到点那一头还压着「允许 TA 主动发消息」那个开关，而且是 drop——
//     开关关着的话，约定连同日历上那一格一起悄悄没了。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const A = strip(app);

// 落账那道闸真跑：给它一个 laterPromise，看存不存得下来
const take = lp => {
  const i = app.indexOf("        const lp = parsed.laterPromise;");
  const j = app.indexOf("\n        }\n      } catch (e) {}", i);
  assert.ok(i > 0 && j > i, "抠不出落账那一段");
  const lim = app.match(/const PROMISE_MIN_MINUTES = [^;]+;/)[0];
  const via = app.slice(app.indexOf("const PROMISE_VIA = {"), app.indexOf("\n", app.indexOf("const promiseVia = ")));
  let row = null;
  new Function("parsed", "charId", "setPromises", "promisesRef", "saveJSON",
    lim + "\n" + via + "\n" + app.slice(i, j + 10))
    .call(null, { laterPromise: lp }, "c1", fn => { row = fn([]).slice(-1)[0]; }, { current: [] }, () => true);
  return row;
};

// ⭐她试的那一次
test("「两分钟后打给我」存得下来，而且是一通电话", () => {
  const row = take({ minutes: 2, about: "打给她", how: "voice" });
  assert.ok(row, "两分钟的约整条被扔了——她那次测的就是这一档");
  assert.equal(row.via, "voice");
  assert.equal(row.charId, "c1");
  assert.ok(row.dueTs > Date.now(), "到期时间没往后放");
});

test("一分钟也算数（tick 是 45 秒一轮，送得到）", () => {
  assert.ok(take({ minutes: 1, how: "voice" }), "1 分钟被挡了");
});

test("再短和再长的还是不收", () => {
  assert.ok(!take({ minutes: 0, how: "voice" }));
  assert.ok(!take({ minutes: -5, how: "voice" }));
  assert.ok(!take({ minutes: 60 * 24 + 1, how: "voice" }), "别让它约到下辈子");
  assert.ok(!take({ minutes: "两分钟", how: "voice" }), "认不出的数字不许当成 0");
  assert.ok(!take({ how: "voice" }));
});

test("字符串写的分钟数照收（模型常这么写）", () => {
  const row = take({ minutes: "2", how: "电话" });
  assert.ok(row);
  assert.equal(row.via, "voice");
});

test("他说「打电话」就真的是电话，不缩水成一条消息", () => {
  ["voice", "语音", "电话", "打电话", "call", "phone", "VOICE"].forEach(h =>
    assert.equal(take({ minutes: 30, how: h }).via, "voice", h + " 被当成发消息了"));
  ["video", "视频", "视频通话", "FaceTime"].forEach(h =>
    assert.equal(take({ minutes: 30, how: h }).via, "video", h + " 没认出来"));
});

test("认不出的仍旧当发消息——宁可少响一次", () => {
  ["chat", "", "随便写的", "语音消息", "true"].forEach(h =>
    assert.equal(take({ minutes: 30, how: h }).via, "chat", h + " 被当成了打电话"));
  assert.equal(take({ minutes: 30, how: true }).via, "chat");
  assert.equal(take({ minutes: 30 }).via, "chat");
});

// ── 到点那一头 ────────────────────────────────────────────
test("约回不再压在「允许 TA 主动发消息」那个开关上", () => {
  const pi = app.indexOf("// ── 约回（v56.49）");
  assert.ok(pi > 0, "约回那一段没了");
  const raw = app.slice(pi, app.indexOf("      try {\n        for (const c of characters) {", pi));
  const seg = strip(raw);
  assert.ok(seg.indexOf("settingsFor(pm.charId).proactive") < 0,
    "那个开关管的是动念那条链；约是他当面答应的事，两件事不是一个开关");
  // 该销约的照旧销，该等的照旧等——不是把闸全拆了
  assert.match(seg, /if \(!c\) \{ drop\(\); continue; \}/);
  assert.match(seg, /if \(laneBusy\("c:" \+ pm\.charId\)\) continue;/);
  assert.match(seg, /if \(currentlyTogetherWithChar\(pm\.charId\)\) continue;/);
  assert.match(seg, /if \(pm\.via === "voice" \|\| pm\.via === "video"\) \{/, "打电话那一支没了");
  assert.match(seg, /ringFromChar\(c, pm\.via, pm\.dueTs/);
});

test("响铃那一支排在「她正看着这个聊天」前面（她就坐在那儿等电话）", () => {
  const pi = app.indexOf("// ── 约回（v56.49）");
  const seg = strip(app.slice(pi, app.indexOf("      try {\n        for (const c of characters) {", pi)));
  assert.ok(seg.indexOf('if (pm.via === "voice"') < seg.indexOf("viewRef.current.charId === pm.charId"),
    "响铃被那道防双发的闸挡住了——拖过 20 分钟就变成一条未接来电");
});

// ── 提示词那头：原来给的量级全是小时起步 ──────────────────
test("提示词里说清了短的那几档也算数", () => {
  assert.match(A, /\*\*她说几分钟就是几分钟\*\*/);
  assert.match(A, /她说「两分钟后打给我」而你答应了，就填 2/, "不说的话，它照着「开个会 60」那几个量级去填");
  assert.match(A, /最短 1 分钟、最长一天/);
  assert.match(A, /how 照你自己刚说出口的那句来/, "老那句不许丢");
});

test("那两个数只写一处，落账那儿直接取", () => {
  assert.equal((A.match(/const PROMISE_MIN_MINUTES = /g) || []).length, 1);
  assert.match(A, /mins >= PROMISE_MIN_MINUTES && mins <= PROMISE_MAX_MINUTES/);
  assert.equal((A.match(/const PROMISE_VIA = /g) || []).length, 1);
  assert.match(A, /const via = promiseVia\(lp\.how\);/);
});

test("病历留在代码里", () => {
  const i = app.indexOf("const PROMISE_MIN_MINUTES");
  const doc = app.slice(Math.max(0, i - 700), i);
  assert.match(doc, /我试着让他两分钟后打都没有/);
  assert.match(doc, /下限原来写的是 5 分钟/);
});
