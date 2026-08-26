const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const screens = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");

// 她 2026-08-26：「有时候他们会说等我 xxx 再找你，能不能设定让他们真的主动发，
// 不用等 jiwen 满。如果我那段时间没上 app 等下一次补上。」
test("协议里有约回字段，而且明说没说过就别填", () => {
  assert.match(app, /laterPromise:\{"minutes":数字,"about":"回来要说\/要做的事"\}/);
  assert.match(app, /只有你这一轮【真的说了】/);
  assert.match(app, /绝不许为了制造互动硬填/);
  assert.match(app, /"call", "laterPromise"\]/, "得挂进本轮开放能力，不然模型不知道能填");
});

test("落盘时校验时长，同一个人只留最新那一个", () => {
  const i = app.indexOf("const lp = parsed.laterPromise;");
  assert.ok(i > 0);
  const seg = app.slice(i, i + 900);
  assert.match(seg, /mins >= 5 && mins <= 60 \* 24/, "五分钟到一天，别让它约到下辈子");
  assert.match(seg, /p\.filter\(x => x && x\.charId !== charId\)/, "他又说一次就以最新的为准，别攒一堆");
  assert.match(seg, /saveJSON\("x_promises", n\)/);
});

// 关键：这条不该受积温门槛管——那是「攒够思念才开口」，这是他自己许的约
test("到点就发，不看积温、不看 45 分钟底线", () => {
  const pi = app.indexOf("// ── 约回（v56.49）");
  const ji = app.indexOf("const jw = (typeof window !== \"undefined\" && window.__jiwen");
  assert.ok(pi > 0 && ji > pi, "约回那段必须排在积温那段前面");
  const seg = app.slice(pi, app.indexOf("      try {\n        for (const c of characters) {", pi));
  assert.ok(!/__jiwen/.test(seg), "别去查积温状态");
  assert.ok(!/floorMin/.test(seg), "别套 45 分钟底线");
  assert.ok(!/hr < 8 \|\| hr > 23/.test(seg), "不看时段——app 不开就不会跑，能跑说明她醒着");
  assert.match(seg, /Date\.now\(\) >= x\.dueTs/);
  assert.match(seg, /jiwenFiredRef\.current\[pm\.charId\] = Date\.now\(\)/, "刚发过要压住积温，别紧跟着再来一条");
});

// 「那段时间没上 app 等下一次补上」——所以过期的不能丢，要一直欠着
test("过期的约不丢，下次开 app 补上", () => {
  const pi = app.indexOf("// ── 约回（v56.49）");
  const seg = app.slice(pi, pi + 1800);
  assert.ok(!/dueTs \+ [0-9]/.test(seg), "不许给过期时间设窗口，过了就作废");
  assert.match(seg, /const late = Math\.round\(\(Date\.now\(\) - pm\.dueTs\) \/ 60000\)/, "要算迟了多久，好让他自己提一句");
  assert.match(app, /比说好的晚了大约/);
});

test("几种不该发的情况各自处理：人没了就销约，正在忙就等下一轮", () => {
  const pi = app.indexOf("// ── 约回（v56.49）");
  const seg = app.slice(pi, pi + 1800);
  assert.match(seg, /if \(!c\) \{ drop\(\); continue; \}/, "角色删了，约也没了");
  assert.match(seg, /if \(!settingsFor\(pm\.charId\)\.proactive\) \{ drop\(\); continue; \}/, "她关了主动就不发");
  assert.match(seg, /if \(laneBusy\("c:" \+ pm\.charId\)\) continue;/, "正在生成→下一轮再说，别销约");
  assert.match(seg, /if \(currentlyTogetherWithChar\(pm\.charId\)\) continue;/, "人就在旁边不用发消息");
  assert.match(seg, /if \(viewRef\.current\.charId === pm\.charId\) continue;/);
});

test("约回不该被防连发闸拦掉", () => {
  assert.match(app, /if \(opts\.proactive && !opts\.tf && !opts\.promise && history\.length\)/);
});

test("开口方式和「忽然想你」不一样：兑现那句话，别重开话题", () => {
  const i = app.indexOf("const promiseHint = opts.promise");
  assert.ok(i > 0);
  const seg = app.slice(i, i + 900);
  assert.match(seg, /你说好了要回来找 Ta/);
  assert.match(seg, /别当没这回事重新起一个话题/);
  assert.match(app, /const proactiveHint = opts\.promise \? promiseHint :/, "要顶掉普通主动那套开场白");
});

test("角色删了要连约一起清，存储条目也要有名字", () => {
  assert.match(app, /setPromises\(p => \{ const n = p\.filter\(x => x && !doomed\.has\(x\.charId\)\)/);
  assert.match(screens, /\["x_promises", "角色说好要回来找你的约"\]/);
  assert.match(app, /setPromises\(loadJSON\("x_promises", \[\]\)\)/, "开机要读回来，不然重启就忘了");
});
