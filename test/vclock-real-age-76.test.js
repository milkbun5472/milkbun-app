// 她 2026-10-30：「你再检查一遍虚拟时间那个有没有别的bug」。
// v76.988~992 把好几处「存下来的时刻」换成了 TA 那只虚拟钟上的时刻，可攒着的旧数据还是现实时间、
// 另一些地方还拿它跟 Date.now() 比——钟一拨远，两种时间混在一起排、一起砍，就出事。这里钉三处：
//   ① 查手机列表：新刷出来的行比旧行「早」几十年，一排序一截断，进门就被截掉；
//   ② 在一起的 since：全 app 都是 Date.now() - since 算第几天，存成虚拟时刻就是十万天或永远第 1 天；
//   ③ 直播：开始时间照了钟，结束时间还是现实的。
// （查手机归档那一处钉在 test/phone-timeline.test.js 末尾。）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = require("../js/phone.js");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");

test("钟往回拨三百年：新刷出来的那条不会一进门就被截掉", () => {
  const DAY = 86400000, real = Date.now(), shift = -300 * 365 * DAY, vnow = real + shift;
  const old = Array.from({ length: 5 }, (_, i) => ({ title: "旧" + i, _ts: real - (i + 1) * DAY }));   // v76.988 以前攒的：现实时间
  P.phoneClockShift(shift);
  let out;
  try { out = P.phoneGrowList([{ title: "新", _ts: vnow - 60000 }], old, 5, vnow); }
  finally { P.phoneClockShift(0); }
  assert.strictEqual(out.length, 5);
  assert.strictEqual(out[0].title, "新", "新刷出来的那条被当成最旧的截掉了");
  assert.ok(out[0]._ts === vnow - 60000, "_ts 还得是 TA 那只钟上的时刻，显示照它");
});

test("不拨钟（偏移 0）：一个字段都不多，排法跟原来一样", () => {
  const out = P.phoneGrowList([{ title: "b", _ts: 2000 }], [{ title: "a", _ts: 1000 }], 5, 3000);
  assert.deepStrictEqual(out.map(x => x.title), ["b", "a"]);
  assert.ok(out.every(x => !("_rt" in x)), "没拨钟也多写了 _rt");
});

test("app.js 合并查手机前设偏移、合并完一定归零", () => {
  const app = R("app.js");
  assert.match(app, /phoneClockShift\(_pNow - Date\.now\(\)\);[\s\S]{0,400}?\} finally \{ if \(typeof phoneClockShift === "function"\) phoneClockShift\(0\); \}/);
});

test("在一起的 since 存现实那一刻，不存虚拟钟上的", () => {
  const app = R("app.js");
  const i = app.indexOf("const beginCouple = (charId, relOverride) => {");
  assert.ok(i > 0, "beginCouple 没了");
  const body = app.slice(i, app.indexOf("\n  };", i));
  assert.match(body, /setCoupleFor\(charId, \{ status: "together", since: Date\.now\(\),/);
  assert.ok(!/since: now\.getTime\(\)/.test(body), "since 又存成了虚拟钟上的时刻");
});

test("直播：结束时间跟开始时间照同一只钟", () => {
  const live = R("live.js");
  assert.ok(!/hm\(x\.end\)/.test(live), "还有结束时间没照钟");
  assert.match(live, /hm\(vt\(x\.start, x\.charId\)\) \+ "–" \+ hm\(vt\(x\.end, x\.charId\)\)/);
});
