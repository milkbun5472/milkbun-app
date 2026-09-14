// 她 2026-09-14：「刚刚在旁观群聊过天，想我就清零了；而且旁观群那条进度也没了。
// 但其他有群的角色没事。」
//
// 两件事：
// ① 旁观群里她【不在场】——那是两个角色自己的事，她的字是旁白不是搭话。
//    拿它当「有人理了TA」语义正好是反的：她越在旁边看他俩演，TA越不想她。
// ② 那一条进度原来只读内存里那份（巡检跑过才有），没跑到就凭空消失，
//    可 x_jiwen 里的积累一直好好的。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../js/interaction-clock.js");
const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");

const T = (h) => Date.parse("2026-09-14T" + h + ":00:00Z");
const normal = { id: "g1", memberIds: ["c1"] };
const watch = { id: "g2", memberIds: ["c1"], roomKind: "spectate" };
// 另一种旁观群：群自己身上没记，记在 x_groupSettings 里（两头都要问）
const watch2 = { id: "g3", memberIds: ["c1"] };
const settings = { g3: { spectate: true } };

test("旁观群里她推的那两句剧情，不算她理过TA", () => {
  const ts = C.latestUserSharedTs("c1", {
    groups: [watch, watch2], groupSettings: settings,
    groupChats: { g2: [{ role: "narration", ts: T("20") }], g3: [{ role: "user", ts: T("21") }] }
  });
  assert.equal(ts, 0, "旁观群被当成了搭话——她越看他俩演，TA越不想她");
});

test("真的有她的那种群，照旧算数（别修出一个新毛病）", () => {
  const ts = C.latestUserSharedTs("c1", {
    groups: [normal, watch], groupSettings: settings,
    groupChats: { g1: [{ role: "user", ts: T("18") }], g2: [{ role: "narration", ts: T("22") }] }
  });
  assert.equal(ts, T("18"), "她真的在群里说过话，那一条必须算");
});

test("旁观群的线下场不算「她和TA在一起」", () => {
  const live = [{ startTs: T("19"), msgs: [{ role: "narration" }] }];
  assert.equal(C.isTogetherNow("c1", { groups: [watch], groupSettings: settings, groupOfflines: { g2: live } }, T("20")), false);
  assert.equal(C.isTogetherNow("c1", { groups: [watch2], groupSettings: settings, groupOfflines: { g3: live } }, T("20")), false);
  // 正常群照旧
  assert.equal(C.isTogetherNow("c1", { groups: [normal], groupSettings: settings, groupOfflines: { g1: live } }, T("20")), true);
});

test("判据两头都要问：群自己身上的 roomKind，和设置里的 spectate", () => {
  assert.equal(C.watchingOnly({ id: "x", roomKind: "spectate" }, {}), true);
  assert.equal(C.watchingOnly({ id: "g3" }, { groupSettings: settings }), true);
  assert.equal(C.watchingOnly({ id: "g1" }, { groupSettings: settings }), false);
  assert.equal(C.watchingOnly(null, {}), false);
  // 接线：app 那两处都得把设置递进去，不然这一层永远认不出旁观群
  assert.ok((app.match(/groups, groupSettings,/g) || []).length >= 2, "app 那两处没把设置递进去，这一层就永远认不出旁观群");
});

test("那一条进度以存档打底，不因为「这轮没跑到」凭空消失", () => {
  const seg = app.slice(app.indexOf("dongnianElsewhere: (() => {"), app.indexOf("activeRoomId: activeRoomId"));
  assert.match(seg, /saved = loadJSON\("x_jiwen", \{\}\) \|\| \{\}/);
  assert.match(seg, /const st = \(jw && jw\.state\) \|\| saved\[k\]/, "内存覆盖存档，不是只认内存");
  assert.ok(!/if \(typeof window === "undefined" \|\| !window\.__dongnian\) return \[\]/.test(seg), "老的那道早退还在，存档打底就白写了");
});

// 她 2026-09-14 第二张图：两个角色都有旁观群，只有一个显示得出「TA 想的不只是你」。
// 病根：群那一份动念只在【互通群】里跑，而旁观群默认不互通。可互通管的是
// 「回不回流主线」，不是「他俩算不算在彼此身上过日子」——手机那一处早就这么判了。
test("旁观群也该攒那一份想念：跟手机那一处同一条判据", () => {
  const seg = app.slice(app.indexOf("// 群里那几份：一人一群各一份"), app.indexOf("const kick = setTimeout(step, 8000)"));
  assert.match(seg, /const watching = !imInGroup\(group\);/);
  assert.match(seg, /if \(\(!gs\.memoryInterop && !watching\) \|\| gs\.autoChat === false\) continue;/);
  // 普通封闭群照旧不算（她另开的密封剧情线，不回流也不自发聊）
  assert.match(seg, /普通封闭群/);
  // 手机那一处的原话还在——两处判的是同一件事，别哪天又只改一处
  assert.match(app, /旁观局则是[\s\S]{0,80}即使不向主线回流，也应在他们手机里看见/);
});
