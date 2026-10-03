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
  assert.doesNotMatch(titles, /在一起了|在一起第/, "在一起的日子留给情侣空间「第一次们」，这里不再立");
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


test("「让 TA 说说」走 runProbe voice，点了才调", () => {
  const app = P("js/app.js");
  assert.match(app, /onRecall: async \(c, m\) => \{/);
  assert.match(app, /runProbe\(p, ctxFor\(c\), \{ voice: true, tag: "shike"/);
  assert.match(P("js/shike.js"), /props\.onRecall \? \[saying === m\.key \? "TA 在想…"[^\n]*\(\) => recall\(m\)/);
});

test("每张时刻卡能画一张、贴一张、拿掉；自己的图压过当天照片", () => {
  const s = P("js/shike.js"), app = P("js/app.js");
  assert.match(app, /onDrawMoment: async \(c, m\) => \{/);
  assert.match(s, /\(\(arts\[cur\.id\] \|\| \{\}\)\[m\.key\] \|\| m\.img\) \? h\(MomentArt, \{ img: \(arts\[cur\.id\] \|\| \{\}\)\[m\.key\] \? \{ ref: arts\[cur\.id\]\[m\.key\] \} : m\.img \}\)/);
  assert.match(s, /\["贴图", \(\) => \{ pickFor\.current = m;/);
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
  assert.match(titles, /他第一次吃醋/, "她收进来的那一刻没出现");
  ["第一次视频", "TA 写来的情书", "第一次说爱你"].forEach(x => assert.doesNotMatch(titles, new RegExp(x), "「第一次」留给情侣空间，这里不该再立：" + x));
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

test("那天的照片当卡面", () => {
  const K = kit();
  assert.deepEqual(K.dayImage(D(2025, 2, 1), [{ role: "assistant", kind: "selfie", imgKey: "img_1", ts: D(2025, 2, 1) }]), { imgKey: "img_1" });
});

test("收进来的一段、自己开的卡、日历世界事件都成时刻，按日子排", () => {
  const K = kit();
  const c = { id: "c1", name: "江识" };
  const chats = { c1: [{ role: "user", content: "嗨", ts: D(2025, 1, 10) }, { role: "assistant", content: "下雪了", ts: D(2025, 12, 1) }] };
  const pins = { c1: [
    { id: "a", ts: D(2025, 6, 1), title: "一长段", lines: [{ role: "user", text: "1" }, { role: "char", text: "2" }, { role: "user", text: "3" }, { role: "char", text: "4" }], summary: "那天他们聊了很久。" },
    { id: "b", ts: D(2025, 3, 1), title: "我开的", manual: true, role: "manual", lines: [{ role: "manual", text: "自己写的" }] }
  ] };
  const calendar = { world: { "2025-12-1": [{ title: "初雪" }], "2025-11-11": [{ title: "没来往的那天" }] } };
  const ms = K.momentsFor(c, { now: D(2026, 1, 1), chats, lib: [], couples: {}, profile: {}, uName: "Lisa", pins, calendar });
  const by = t => ms.find(m => m.title.indexOf(t) >= 0);
  assert.equal(by("一长段").what.lines[0], "那天他们聊了很久。", "有总结先给总结");
  assert.equal(by("一长段").raw.length, 4, "原话得留着");
  assert.equal(by("我开的").kind, "manual");
  assert.match(by("我开的").what.lines[0], /^自己写的$/);
  assert.ok(by("初雪"), "那天有来往的世界事件没进来");
  assert.ok(!by("没来往的那天"), "没来往那天的世界事件不该进来");
  for (let i = 1; i < ms.length; i++) assert.ok(ms[i - 1].ts >= ms[i].ts, "没按日子排");
});

test("多选栏有「补中间」「收进时刻」，单聊群聊都接上", () => {
  const comp = P("js/components.js"), app = P("js/app.js");
  assert.equal((comp.match(/"补中间"/g) || []).length, 2);
  assert.equal((comp.match(/onPinShike\(selIds\)/g) || []).length, 2);
  assert.equal((app.match(/onPinShike: indices =>/g) || []).length, 2);
  assert.match(app, /saveJSON\("x_shikeGroupPins", all\.slice\(0, 500\)\)/, "群里收的一段要存成多人卡");
  assert.match(app, /onSummarizePin: async \(c, m\) =>/);
});

test("第一轮：发给 TA、TA 偶尔想起一张旧的、TA 自己存一刻", () => {
  const K = kit(), s = P("js/shike.js"), app = P("js/app.js");
  assert.match(s, /props\.onSendMoment \? \["发给 TA", \(\) => props\.onSendMoment\(cur, m\)\]/);
  assert.match(app, /onSendMoment: \(c, m\) => \{/);
  assert.match(app, /keepMoment:\{"title":"给这一刻起的名字","why":/);
  assert.match(app, /if \(parsed\.keepMoment && typeof parsed\.keepMoment === "object" && !sideRoom && !char\.npc/);
  // 想起旧的：五天里大约一天，同一天挑的是同一张
  const c = { id: "c1", name: "江识" };
  const chats = { c1: [{ role: "user", content: "嗨", ts: D(2025, 1, 10) }] };
  const pins = { c1: [{ id: "p", ts: D(2025, 5, 5), title: "他第一次吃醋", text: "你跟谁聊呢", role: "assistant" }] };
  let hits = 0, same = true;
  for (let i = 0; i < 20; i++) {
    const now = D(2026, 3, 1) + i * 86400000;
    const ctx = { now, chats, lib: [], couples: {}, profile: {}, uName: "Lisa", pins };
    const x = kitNote(K, c, ctx), y = kitNote(K, c, ctx);
    if (x) hits++; if (x !== y) same = false;
  }
  assert.ok(hits >= 2 && hits <= 6, "大约五天一次，实际 " + hits + " / 20");
  assert.ok(same, "同一天挑的得是同一张");
});
function kitNote(K, c, ctx) {
  const g = { React: { useState: () => [], useMemo: f => f() } };
  new Function("window", "globalThis", "React", "h", "Svg", P("js/shike.js"))(g, g, g.React, () => null, () => null);
  return g.ShikeKit.chatNote(c, ctx);
}

test("第二轮：时刻的日子走纪念日主动那条路；主屏「去年今天」", () => {
  const app = P("js/app.js"), K = kit();
  assert.match(app, /if \(!u \|\| u\.days !== 0 \|\| !\/\^\(认识\|在一起第\)\/\.test\(u\.title\)\) continue;/);
  assert.match(app, /aToday\.push\(\{ cid: c\.id, name: u\.title, yrs: 0 \}\);/);
  assert.match(app, /screen === "home" && shikeOTD && window\.ShikeOTD && h\(window\.ShikeOTD, \{/);
  assert.match(app, /saveJSON\("x_shikeOTD", schedDayKey\(new Date\(\)\)\)/);
  const c = { id: "c1", name: "江识" };
  const chats = { c1: [{ role: "user", content: "嗨", ts: D(2025, 1, 10) }] };
  const pins = { c1: [{ id: "p", ts: D(2025, 10, 3), title: "他第一次吃醋", text: "哼", role: "assistant" }] };
  const otd = K.onThisDay([c], { now: D(2026, 10, 3), chats, lib: [], couples: {}, profile: {}, uName: "Lisa", pins });
  assert.ok(otd, "去年今天那张没找到");
  assert.equal(otd.years, 1);
  assert.equal(otd.m.title, "他第一次吃醋");
  assert.equal(K.onThisDay([c], { now: D(2026, 10, 4), chats, lib: [], couples: {}, profile: {}, uName: "Lisa", pins }), null);
});

test("第三轮：按月的目录能跳；能存成一页长图，太长就截断并写明", () => {
  const s = P("js/shike.js");
  assert.match(s, /"data-wk": "shikemonths"/);
  assert.match(s, /onClick: \(\) => jump\(k\)/, "时间轴上的刻度点了不跳");
  assert.match(s, /const exportLong = async \(c, items\) =>/);
  assert.match(s, /saveImgOriginal\(cv\.toDataURL\("image\/jpeg", 0\.9\)/);
  assert.match(s, /MAXH = 15000/, "iOS canvas 一边不能太长，得有上限");
  assert.match(s, /只拼了最近的/);
});

test("第四轮：群里收的一段出现在在场每个人名下；群里一起过的节日", () => {
  const K = kit();
  const a = { id: "a", name: "江识" }, b = { id: "b", name: "陆衍" };
  const groupPins = [{ id: "g1", ts: D(2025, 6, 1), title: "群里吵架", cids: ["a", "b"], groupName: "家", lines: [{ role: "user", text: "别吵了" }, { role: "char", name: "江识", text: "他先的" }] }];
  const groups = [{ id: "G", name: "家", memberIds: ["a", "b"] }];
  const groupChats = { G: [
    { role: "user", content: "圣诞快乐呀", ts: D(2025, 12, 25, 10) },
    { role: "assistant", senderId: "a", senderName: "江识", content: "圣诞快乐", ts: D(2025, 12, 25, 11) },
    { role: "assistant", senderId: "b", senderName: "陆衍", content: "同乐", ts: D(2025, 12, 25, 12) }
  ] };
  const ctx = { now: D(2026, 1, 1), chats: {}, lib: [], couples: {}, profile: {}, uName: "Lisa", groupPins, groups, groupChats, allChars: [a, b] };
  [a, b].forEach(c => {
    const ms = K.momentsFor(c, ctx);
    const gp = ms.find(m => m.title === "群里吵架");
    assert.ok(gp, c.name + " 名下没有那张群里的卡");
    assert.equal(gp.with.length, 1, "「一起的还有」该是另一个人");
    assert.ok(ms.find(m => /和「家」一起过的圣诞节/.test(m.title)), c.name + " 名下没有群里过的圣诞");
  });
});

test("修：生图只回 blob 也能存；认识从在一起那天起算（更早的话）；发给 TA 是小卡", () => {
  const app = P("js/app.js"), eng = P("js/engine.js"), comp = P("js/components.js"), K = kit();
  assert.match(eng, /async function imgResultToVault\(r\)/);
  assert.match(eng, /if \(!d && r\.blob\) d = await new Promise/);
  assert.equal((app.match(/await imgResultToVault\(r\)/g) || []).length, 3, "头像、封面、配图三处都得走它");
  assert.ok(!/const dataUrl = r && \(r\.dataUrl \|\| r\.url\);/.test(app), "还有地方只认 dataUrl");
  const c = { id: "c1", name: "江识" };
  const ctx = { now: D(2026, 1, 1), chats: { c1: [{ role: "user", content: "嗨", ts: D(2025, 12, 1) }] }, lib: [], couples: { c1: { status: "together", since: D(2025, 9, 1) } }, profile: {}, uName: "Lisa" };
  const titles = K.momentsFor(c, ctx).map(m => m.title).join("|");
  assert.match(titles, /认识第 100 天/, "在一起比来到这里早，认识得从在一起那天算");
  assert.match(app, /kind: "shikeshare", content: body/);
  assert.match(comp, /m\.kind === "shikeshare" && window\.ShikeShareCard/);
});

test("点「认识 N 天」能改认识那天：定了就以它为准，清空回到自动算", () => {
  const s = P("js/shike.js");
  assert.match(s, /const MEET_KEY = "x_shikeMeet";/);
  assert.match(s, /const own = meetOverride\(c\.id\);\n\s*if \(own\) return own;/);
  assert.equal((s.match(/onClick: e => editMeet\(/g) || []).length, 2, "外层卡和里层顶上两处都能点");
  // 真跑：有覆盖就用覆盖
  const g = { React: { useState: () => [], useMemo: f => f() } };
  const store = { x_shikeMeet: { c1: D(2020, 5, 20) } };
  new Function("window", "globalThis", "React", "h", "Svg", "loadJSON", P("js/shike.js"))(g, g, g.React, () => null, () => null, (k, d) => store[k] || d);
  const ms = g.ShikeKit.momentsFor({ id: "c1", name: "江识" }, { now: D(2026, 1, 1), chats: { c1: [{ role: "user", content: "嗨", ts: D(2025, 12, 1) }] }, lib: [], couples: {}, profile: {}, uName: "Lisa" });
  assert.ok(ms.some(m => m.title === "认识 5 周年"), "定了 2020-05-20，就该有认识 5 周年");
});

test("里层：动作收进右上角「⋯」，卡底是一行小字，底框压矮，底下一条时间轴（不是药丸）", () => {
  const s = P("js/shike.js"), app = P("js/app.js");
  const inner = s.slice(s.indexOf("// ── 里层"), s.indexOf("// ── 外层"));
  assert.match(inner, /"data-wk": "shikemenu"/);
  assert.match(inner, /"data-wk": "shikeacts"/);
  assert.match(inner, /maxHeight: "20%"/, "底框没压矮");
  assert.match(inner, /actsOpen/, "卡底动作没收起来");
  assert.match(inner, /list.length - 1 - k/, "刻度不是旧的在左");
  assert.ok(!/borderRadius: 999, padding: "6px 1[12]px"/.test(inner), "顶上那排药丸还在");
  assert.match(app, /exactly two arms and two hands/, "画图没交代手脚");
});
