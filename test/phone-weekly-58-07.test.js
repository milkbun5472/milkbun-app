const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const phone = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
// phoneWeekKey 真跑
const weekKey = new Function(phone.slice(phone.indexOf("function phoneWeekKey(d)"),
  phone.indexOf("// 周刊式刷新时告诉模型取材的时间窗")) + "\nreturn phoneWeekKey;")();

// 她 2026-08-30：「开了每周刷新为啥我打开今天也会有更新」
test("周次游标：一周之内不变，跨周才变，四年里不撞车", () => {
  const mon = new Date(2026, 7, 24, 0, 0, 0);   // 某个周一
  const keys = new Set();
  for (let i = 0; i < 7; i++) keys.add(weekKey(new Date(2026, 7, 24 + i, 13).getTime()));
  assert.equal(keys.size, 1, "同一周里 key 变了：" + [...keys].join("/"));
  assert.notEqual(weekKey(mon.getTime()), weekKey(mon.getTime() + 7 * 86400000), "跨周了 key 却没变");
  // 两个不同的周绝不能算出同一个 key，否则那一周整周不刷
  const seen = {};
  for (let y = 2024; y <= 2028; y++) for (let i = 0; i < 53; i++) {
    const d = new Date(y, 0, 1 + i * 7, 12);
    const m = new Date(d); m.setHours(0, 0, 0, 0); m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
    const k = weekKey(d.getTime()), id = m.toDateString();
    assert.ok(!seen[k] || seen[k] === id, "两个周撞了同一个 key：" + k);
    seen[k] = id;
  }
});

test("连着刷完这一周欠的，每个人都是成没成都先记账", () => {
  const i = app.indexOf("  const phoneWeeklySweep = async () => {");
  const seg = app.slice(i, app.indexOf("  const phoneAutoToggle = charId =>"));
  assert.match(seg, /for \(const due of pending\) \{/, "还是只补一个");
  assert.match(seg, /\(box\.done \|\| \{\}\)\[c\.id\] !== wk/, "游标比对没了就会每次唤起都刷");
  // 记账必须在循环【里面】、每个人各记各的：整轮跑完才一起记的话，
  // 中途关掉 app 就等于这一周谁都没记上，下次唤起从头再刷一整轮
  const loop = seg.slice(seg.indexOf("for (const due of pending)"));
  assert.ok(loop.indexOf("saveJSON(\"x_phoneAuto\", n)") >= 0, "记账掉到循环外面了,中途退出就整轮重刷");
  // 先记游标再刷：中途失败也不该下次唤起又整份重刷
  assert.ok(loop.indexOf("saveJSON(\"x_phoneAuto\", n)") < loop.indexOf("await genPhoneAll(due, true)"),
    "先刷后记账的话，失败一次就会每次唤起重来");
});

test("每一步各自兜底——原来一条 .then 链，中间抛了后面全静默跳过", () => {
  assert.match(app, /const wakeSweeps = async \(\) => \{/);
  const i = app.indexOf("  const wakeSweeps = async () => {");
  const seg = app.slice(i, i + 900);
  assert.match(seg, /for \(const step of steps\) \{ try \{ await step\(\); \} catch \(e\) \{/, "还是一步失手拖垮后面几步");
  ["schedGenAllToday", "schedMaybeSelfRevise", "walletCatchAllToday",
   "desireMuseAllToday", "desireTendAllToday", "phoneWeeklySweep"].forEach(f =>
    assert.ok(seg.indexOf(f) > 0, "这一步掉了：" + f));
  // 旧的链式写法一处都不许留
  assert.doesNotMatch(app, /schedGenAllToday\(\)\.then\(/, "还有地方挂着旧的 .then 链");
  // ⚠️只写一处：抄三遍的话，加一步就得记得改三处
  assert.equal((app.match(/wakeSweeps\(\)/g) || []).length, 3, "开 app / 切回前台 / 跨天，三处都要走同一支");
  assert.equal((app.match(/const wakeSweeps/g) || []).length, 1);
});

test("例行刷新不许改她正在看的是谁，而且刷完得说一声", () => {
  // 后台刷的时候顺手 setSelPhone，等她进查手机选中的就变成了被补刷的那个
  assert.match(app, /if \(!weekly\) setSelPhone\(char\.id\);/);
  // 完全无声的话，「我今天打开怎么又更新了」根本没法自己看出来
  // ⚠️别把整句话冻死。v58.89 起是连着刷完这一周欠的所有人，报的是这一轮刷了几个
  assert.match(app, /toast\(\(done === pending\.length/);
  const i = app.indexOf("await genPhoneAll(due, true)");
  assert.ok(app.indexOf("toast((done === pending.length", i) > i, "提示要在整轮刷完之后才发");
  // 每个人刷完各弹一次会把这句冲掉,所以例行刷新时下面那层不许自己报
  assert.match(app, /if \(!weekly\) toast\(ok === keys\.length/, "例行刷新时每个角色还各弹一次");
});

test("主 app 的朋友圈走的是聊天轮数，跟查手机的每周刷新是两回事", () => {
  // 她把两件事看成一件了：朋友圈/悄悄话/论坛是 tickAmbient 按轮数触发的
  const i = app.indexOf("  const tickAmbient = (charId, posted) => {");
  const seg = app.slice(i, i + 1500);
  // ⚠️只钉【按什么触发】，别把整行冻死：前面还挂着 autoRefreshOn 那道开关，
  // 以后再多一道条件也照样该过——这条测的是「按轮数」，不是这一行长什么样
  assert.match(seg, /n\.moment >= 30\) due\.push\("moment"\)/, "朋友圈按轮数");
  assert.match(seg, /isCouple && n\.whisper >= 15/, "悄悄话按轮数");
  assert.match(seg, /n\.forum >= 50 \|\| Date\.now\(\) - \(n\.lastForumTs \|\| Date\.now\(\)\) >= 3 \* 86400000/, "论坛按轮数或满三天");
  // 这一支跟 phoneAuto 没有任何关系
  assert.equal(seg.indexOf("phoneAuto"), -1, "两个系统串味了");
  assert.equal(app.slice(app.indexOf("  const phoneWeeklySweep"), app.indexOf("  const phoneAutoToggle")).indexOf("tickAmbient"), -1);
});
