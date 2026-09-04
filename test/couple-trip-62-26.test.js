// 旅行（v62.26，她 2026-09-04 拍板）：不开新门——入口全在愿望板「一起去」上。
// 它不是新模块，是把旧件接成一条线：愿望 → 他排攻略（全程唯一花调用的一步）→
// 带着行程走一场线下 → 收行李零调用归档（时间轴/愿望翻实现/凝记忆/第一次们自己看得见）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const eng = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const firsts = require("../js/couple-firsts.js");
const cut = (s, a, b) => { const i = s.indexOf(a); return s.slice(i, s.indexOf(b, i + a.length)); };

test("存档形状钉在写入方上（stub-from-the-writer），且登记了 durable", () => {
  assert.match(app, /\{ id: "tp_" \+ Date\.now\(\), charId: charId, wishId: \(wish && wish\.id\) \|\| "",/, "写入方形状变了");
  assert.match(app, /status: "planning", doneTs: 0 \}/, "初始状态不对");
  assert.match(eng, /"x_coupleTrips"/, "没登记 durable，攒多了会把 localStorage 写满");
});

test("一次只走一趟；攻略是全程唯一花调用的一步，prompt 只给判据不给内容示范", () => {
  assert.match(app, /if \(cur\) \{ toast\("上一趟还没收行李"\); return; \}/, "能同时开两趟，归档会互相踩");
  const plan = cut(app, "const tripPlanGen = async char => {", "\n  const tripDepart");
  assert.match(plan, /换一对情侣照样成立的那一句，就是排坏了/, "note 没给判据");
  assert.match(plan, /你们是去相处的，不是去打卡的/, "行程会被排成攻略网站那种");
  assert.ok(!/如「|例如|比如「/.test(plan), "提示词里塞了内容示范（prompt-no-content-samples）");
  assert.match(plan, /maxTokens: 12000/, "一份行程是「一段正文」那档");
  // 出发照抽卡兑线下那条先例：startOffline + setOfflineChar，绝不 openOffline（会盖掉刚开的场）
  const dep = cut(app, "const tripDepart = async char => {", "\n  const tripDone");
  assert.match(dep, /await startOffline\(char\.id, \{ opening: opening \}\);/, "行程没带进线下");
  assert.match(dep, /setOfflineChar\(char\);/, "线下那层没掀起来");
  assert.ok(dep.indexOf("openOffline") < 0, "用了 openOffline——它会重读存储把刚开的场盖掉");
});

test("收行李零调用归档四件：trips 标 done、时间轴、愿望翻实现、凝记忆", () => {
  const done = cut(app, "const tripDone = char => {", "\n  const coupleFirstsFor");
  assert.ok(done.indexOf("runProbe") < 0 && done.indexOf("callAI") < 0, "归档不许花调用");
  assert.match(done, /status: "done", doneTs: Date\.now\(\)/, "trips 没标 done");
  assert.match(done, /addTimelineEvent\(char, ymd\(new Date\(\)\), \("去了" \+ trip\.dest\)/, "时间轴没落");
  assert.match(done, /w\.id === trip\.wishId \? \{ \...w, status: "done"/, "愿望没自己翻成实现");
  assert.match(done, /coupleKeep\(char\.id, /, "没凝记忆");
});

test("第一次们认得「第一次一起旅行」，而且只认收了行李的", () => {
  const now = Date.now();
  const out = firsts.coupleFirsts({ since: now - 90 * 86400000, trips: [
    { dest: "还在走的", status: "planning", doneTs: 0, ts: now - 86400000 },
    { dest: "海边", status: "done", doneTs: now - 10 * 86400000, ts: now - 12 * 86400000 },
    { dest: "更晚的一趟", status: "done", doneTs: now - 2 * 86400000, ts: now - 3 * 86400000 }
  ] }, now);
  const trip = out.find(x => x.key === "trip");
  assert.ok(trip, "旅行不在第一次们里");
  assert.match(trip.note, /海边/, "认的不是最早那趟收了行李的");
  // 调用方真把 trips 递进去了（读的按 charId 筛）
  assert.match(app, /trips: \(coupleTripsRef\.current \|\| \[\]\)\.filter\(x => x && x\.charId === cid\)/, "coupleFirstsFor 没递 trips");
});

test("不开新门：入口在愿望板上，旅行页整页、层级一层层退", () => {
  assert.match(scr, /出发 · 把它变成一趟真的旅行/, "「一起去」的愿望上没有出发口");
  assert.match(scr, /w\.type !== "一起去" \|\| w\.status === "done"/, "别的类型的愿望也能出发");
  const trip = cut(scr, "function CoupleTrip({", "\nfunction ");
  assert.match(trip, /className: "h-full flex flex-col"/, "旅行页不是整页");
  assert.ok(trip.indexOf("h(Sheet") < 0, "旅行页用了半窗（no-half-sheet）");
  assert.match(trip, /className: "flex-1 min-h-0 overflow-y-auto/, "正文不是主滚动容器");
  // 从愿望板进、返回也回愿望板（一层层退），而且都走 openSub 那一个出口
  assert.match(scr, /onBack: \(\) => openSub\("wishes"\) \}\);/, "旅行页返回没回愿望板");
  // 墙上/书脊没有为旅行开新格（她自己立的「别再叠罗汉」）
  const collage = cut(scr, "const wall = (k, o) =>", "只属于你俩的私密层");
  assert.ok(!/wall\("trip"|spine\("trip"/.test(collage), "又开了一扇新门");
});
