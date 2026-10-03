// 时刻（她 2026-10-03）：回头看里一格；纪念日和节日全算出来；横滑选角色、卡面用头像、可生成封面
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

function kit() {
  const g = { React: { useState: () => [], useMemo: f => f() } };
  new Function("window", "globalThis", "React", "h", "Svg", P("js/shike.js"))(g, g, g.React, () => null, () => null);
  return g.ShikeKit;
}
const D = (y, m, d, h) => new Date(y, m - 1, d, h || 12).getTime();

test("认识、在一起、生日都立；节日只有那天说过话才立", () => {
  const K = kit();
  const c = { id: "c1", name: "江识", birthday: "1998-03-15" };
  const chats = { c1: [{ role: "user", content: "嗨", ts: D(2025, 1, 10) }, { role: "assistant", content: "圣诞快乐", ts: D(2025, 12, 25) }] };
  const ms = K.momentsFor(c, { now: D(2026, 10, 3), chats, lib: [], couples: { c1: { status: "together", since: D(2025, 2, 14) } }, profile: { birthday: "05-01" }, uName: "Lisa" });
  const titles = ms.map(m => m.title).join("|");
  assert.match(titles, /第一次说上话/);
  assert.match(titles, /认识第 100 天/);
  assert.match(titles, /认识 1 周年/);
  assert.match(titles, /在一起了/);
  assert.match(titles, /江识 的生日/);
  assert.match(titles, /你的生日/);
  assert.match(titles, /圣诞节/, "那天说过话的节日要立");
  assert.doesNotMatch(titles, /万圣节/, "那天没说过话的节日不该立");
  assert.ok(ms.every(m => m.ts <= D(2026, 10, 3)), "不许出现还没到的日子");
  const xmas = ms.find(m => /圣诞节/.test(m.title));
  assert.equal(xmas.what.kind, "chat");
  assert.match(xmas.what.lines[0], /江识：圣诞快乐/);
});

test("农历生日不瞎换算", () => {
  assert.equal(kit().monthDay("农历八月十五"), null);
  assert.deepEqual(kit().monthDay("3月15日"), { mo: 3, d: 15 });
});

test("接进了回头看、页面路由、攻略、挂点名单", () => {
  assert.match(P("js/components.js"), /f_def_back:  \{ name: "回头看", keys: \["weekly", "impression", "shike"\] \}/);
  assert.match(P("js/components.js"), /st = placeNewAppOnce\(st, "shike", "impression", "x_shikePlaced"\);/);
  assert.match(P("js/app.js"), /screen === "shike"\) body = h\(window\.ShikeApp, \{/);
  assert.match(P("js/assistant-manual.js"), /id: "shike", app: "shike", zh: "时刻"/);
  assert.match(P("index.html"), /<script src="js\/shike\.js\?v=/);
});

test("两层：外层只有整屏高的卡横着滑，点进去才有时刻列表", () => {
  const s = P("js/shike.js");
  assert.match(s, /onClick: \(\) => setOpenId\(c\.id\)/, "卡片点了不进里层");
  assert.match(s, /height: "100%", width: "min\(80vw, 400px\)"/, "卡不是整屏高");
  const outer = s.slice(s.indexOf("// ── 外层"));
  assert.ok(!/list\.map\(row\)/.test(outer), "外层又摆出了时刻列表");
});

test("卡面默认用档案馆那张头像；里层时刻也是横着滑的高卡", () => {
  const s = P("js/shike.js");
  assert.match(s, /const coverOf = c => covers\[c\.id\] \|\| c\.avatarImage \|\| c\.chatAvatar \|\| "";/);
  const inner = s.slice(s.indexOf("// ── 里层"), s.indexOf("// ── 外层"));
  assert.match(inner, /scrollSnapType: "x mandatory"/, "里层不是横滑");
  assert.match(inner, /list\.map\(mcard\)/);
});

test("「第一次」从聊天和线下里找；那天的照片当卡面", () => {
  const K = kit();
  const c = { id: "c1", name: "江识" };
  const chats = { c1: [
    { role: "user", content: "嗨", ts: D(2025, 1, 10) },
    { role: "assistant", kind: "selfie", imgKey: "img_1", content: "", ts: D(2025, 2, 1) },
    { role: "system", kind: "callend", content: "通话", ts: D(2025, 3, 1) },
    { role: "assistant", content: "晚安啦", ts: D(2025, 3, 2) }
  ] };
  const ms = K.momentsFor(c, { now: D(2026, 1, 1), chats, lib: [], couples: {}, profile: {}, uName: "Lisa", offlines: { c1: [{ startTs: D(2025, 4, 5), msgs: [] }] } });
  const by = t => ms.find(m => m.title.indexOf(t) >= 0);
  assert.ok(by("第一张照片"), "第一张照片没立");
  assert.deepEqual(by("第一张照片").img, { imgKey: "img_1" }, "那天的照片没当卡面");
  assert.ok(by("第一次打电话"));
  assert.ok(by("第一次说晚安"));
  assert.ok(by("第一次见面"), "线下第一场没认出来");
});

test("「让 TA 说说」走 runProbe voice，点了才调", () => {
  const app = P("js/app.js");
  assert.match(app, /onRecall: async \(c, m\) => \{/);
  assert.match(app, /runProbe\(p, ctxFor\(c\), \{ voice: true, tag: "shike"/);
  assert.match(P("js/shike.js"), /props\.onRecall \? h\("button", \{ onClick: \(\) => recall\(m\)/);
});

test("每张时刻卡能画一张、贴一张、拿掉；自己的图压过当天照片", () => {
  const s = P("js/shike.js"), app = P("js/app.js");
  assert.match(app, /onDrawMoment: async \(c, m\) => \{/);
  assert.match(s, /\(\(arts\[cur\.id\] \|\| \{\}\)\[m\.key\] \|\| m\.img\) \? h\(MomentArt, \{ img: \(arts\[cur\.id\] \|\| \{\}\)\[m\.key\] \? \{ ref: arts\[cur\.id\]\[m\.key\] \} : m\.img \}\)/);
  assert.match(s, /"贴一张"/);
  assert.match(s, /saveJSON\("x_shikeArt", n\)/);
});

test("更多「第一次」、收着的时刻、往前看", () => {
  const K = kit();
  const c = { id: "c1", name: "江识", birthday: "10-05" };
  const chats = { c1: [
    { role: "user", content: "嗨", ts: D(2025, 1, 10) },
    { role: "system", kind: "callend", callMode: "video", content: "", ts: D(2025, 2, 1) },
    { role: "assistant", kind: "loveletter", content: "信", ts: D(2025, 3, 1) },
    { role: "assistant", content: "我爱你", ts: D(2025, 3, 2) }
  ] };
  const pins = { c1: [{ id: "p1", ts: D(2025, 5, 5), title: "他第一次吃醋", text: "你跟谁聊呢", role: "assistant" }] };
  const ctx = { now: D(2026, 10, 3), chats, lib: [], couples: {}, profile: {}, uName: "Lisa", pins };
  const titles = K.momentsFor(c, ctx).map(m => m.title).join("|");
  ["第一次视频", "TA 写来的情书", "第一次说爱你", "他第一次吃醋"].forEach(x => assert.match(titles, new RegExp(x)));
  const u = K.upcoming(c, ctx);
  assert.equal(u.days, 2);
  assert.match(u.title, /江识 的生日/);
});

test("聊天长按能「收进时刻」；快到的日子递进提示词", () => {
  const comp = P("js/components.js"), app = P("js/app.js"), eng = P("js/engine.js");
  assert.match(comp, /shike: \["收进时刻", "shikeStar"\]/);
  assert.match(comp, /\[\["copy", "fav", "shike", "quote"\]/);
  assert.match(app, /if \(act === "shike"\) \{ pinToShike\(activeChar\.id, m\); return; \}/);
  assert.match(app, /saveJSON\("x_shikePins", all\);/);
  assert.match(app, /shikeNote: \(!char\.npc && window\.ShikeKit/);
  assert.match(eng, /if \(!ctx\.notRoleplay && ctx\.shikeNote\) parts\.push\("【快到的日子】"/);
});
