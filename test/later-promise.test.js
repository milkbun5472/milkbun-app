const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const screens = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");

// 她 2026-08-26：「有时候他们会说等我 xxx 再找你，能不能设定让他们真的主动发，
// 不用等 dongnian 满。如果我那段时间没上 app 等下一次补上。」
test("协议里有约回字段，而且明说没说过就别填", () => {
  assert.match(app, /laterPromise:\{"minutes":数字,"about":"回来要说\/要做的事","how":"chat\|voice\|video"\}/);
  assert.match(app, /只有你这一轮【真的说了】/);
  assert.match(app, /绝不许为了制造互动硬填/);
  assert.match(app, /"call", "laterPromise"\]/, "得挂进本轮开放能力，不然模型不知道能填");
});

test("落盘时校验时长，同一个人只留最新那一个", () => {
  const i = app.indexOf("const lp = parsed.laterPromise;");
  assert.ok(i > 0);
  const seg = app.slice(i, i + 1800);
  // ⚠️下限原来写死 5 分钟。她 2026-09-12 试的正是【两分钟】，于是这条约压根没被记下来，
  //   后面整条链一个字都没跑到。tick 是 45 秒一轮，1 分钟完全送得到。
  assert.match(seg, /mins >= PROMISE_MIN_MINUTES && mins <= PROMISE_MAX_MINUTES/, "别让它约到下辈子，但也别把短的整条扔掉");
  const lim = app.match(/const PROMISE_MIN_MINUTES = (\d+), PROMISE_MAX_MINUTES = ([^;]+);/);
  assert.ok(lim, "那两个数没了");
  assert.equal(Number(lim[1]), 1, "下限不是 1 分钟：「等我两分钟」这种约又会被整条扔掉");
  assert.equal(new Function("return " + lim[2])(), 60 * 24);
  assert.match(seg, /p\.filter\(x => x && x\.charId !== charId\)/, "他又说一次就以最新的为准，别攒一堆");
  assert.match(seg, /saveJSON\("x_promises", n\)/);
});

// 关键：这条不该受动念门槛管——那是「攒够思念才开口」，这是他自己许的约
test("到点就发，不看动念、不看 45 分钟底线", () => {
  const pi = app.indexOf("// ── 约回（v56.49）");
  const ji = app.indexOf("const jw = (typeof window !== \"undefined\" && window.__dongnian");
  assert.ok(pi > 0 && ji > pi, "约回那段必须排在动念那段前面");
  const seg = app.slice(pi, app.indexOf("      try {\n        for (const c of characters) {", pi));
  assert.ok(!/__dongnian/.test(seg), "别去查动念状态");
  assert.ok(!/floorMin/.test(seg), "别套 45 分钟底线");
  assert.ok(!/hr < 8 \|\| hr > 23/.test(seg), "不看时段——app 不开就不会跑，能跑说明她醒着");
  assert.match(seg, /Date\.now\(\) >= x\.dueTs/);
  assert.match(seg, /dongnianFiredRef\.current\[pm\.charId\] = Date\.now\(\)/, "刚发过要压住动念，别紧跟着再来一条");
});

// 「那段时间没上 app 等下一次补上」——所以过期的不能丢，要一直欠着
test("过期的约不丢，下次开 app 补上", () => {
  const pi = app.indexOf("// ── 约回（v56.49）");
  const seg = app.slice(pi, app.indexOf("      try {\n        for (const c of characters) {", pi));
  assert.ok(!/dueTs \+ [0-9]/.test(seg), "不许给过期时间设窗口，过了就作废");
  assert.match(seg, /const late = Math\.round\(\(Date\.now\(\) - pm\.dueTs\) \/ 60000\)/, "要算迟了多久，好让他自己提一句");
  assert.match(app, /比说好的晚了大约/);
});

test("几种不该发的情况各自处理：人没了就销约，正在忙就等下一轮", () => {
  const pi = app.indexOf("// ── 约回（v56.49）");
  const seg = app.slice(pi, app.indexOf("      try {\n        for (const c of characters) {", pi));
  assert.match(seg, /if \(!c\) \{ drop\(\); continue; \}/, "角色删了，约也没了");
  // ⚠️v67.39 拆掉了这一条：那个开关管的是动念那条链（攒够思念才开口），
  //   而这一条是他当着她的面答应下来的事，多半还是她自己要的。压回同一个开关上、
  //   而且是 drop，等于约定连同日历上那一格一起悄悄没了。
  assert.ok(seg.indexOf("if (!settingsFor(pm.charId).proactive) { drop(); continue; }") < 0,
    "约回又被压回「允许主动发消息」那个开关上了");
  assert.match(seg, /不看「允许 TA 主动发消息」那个开关/, "理由要留在代码里");
  assert.match(seg, /if \(laneBusy\("c:" \+ pm\.charId\)\) continue;/, "正在生成→下一轮再说，别销约");
  assert.match(seg, /if \(currentlyTogetherWithChar\(pm\.charId\)\) continue;/, "人就在旁边不用发消息");
  assert.match(seg, /if \(viewRef\.current\.charId === pm\.charId\) continue;/);
});

test("约回不该被防连发闸拦掉", () => {
  assert.match(app, /if \(opts\.proactive && !opts\.promise && history\.length\)/);
});

test("开口方式和「忽然想你」不一样：兑现那句话，别重开话题", () => {
  const i = app.indexOf("const promiseHint = opts.promise");
  assert.ok(i > 0);
  const seg = app.slice(i, i + 1800);
  assert.match(seg, /你说好了要回来找 Ta/);
  assert.match(seg, /别当没这回事重新起一个话题/);
  assert.match(app, /const proactiveHint = opts\.promise \? promiseHint :/, "要顶掉普通主动那套开场白");
});

test("角色删了要连约一起清，存储条目也要有名字", () => {
  assert.match(app, /setPromises\(p => \{ const n = p\.filter\(x => x && !doomed\.has\(x\.charId\)\)/);
  assert.match(screens, /\["x_promises", "角色说好要回来找你的约"\]/);
  assert.match(app, /setPromises\(loadJSON\("x_promises", \[\]\)\)/, "开机要读回来，不然重启就忘了");
});
