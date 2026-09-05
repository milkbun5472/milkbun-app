// v62.89 她 2026-09-05 早上 9:29：「名片为啥还是显示 63 天，昨天就是 63 天了」
// 病根：这个数原来是 floor((now - first) / 86400000) + 1 —— 数的是【过了几个 24 小时】。
// 她的起点在晚上，于是这个数在每天晚上那个时刻翻，白天一整天都停在昨天那个数上。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const core = fs.readFileSync(__dirname + "/../js/core.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const html = fs.readFileSync(__dirname + "/../index.html", "utf8");
const homeDayNo = eval("(" + core.match(/function homeDayNo\(firstTs, now\) \{[\s\S]*?\n\}/)[0].replace("function homeDayNo", "function") + ")");

test("翻页的时刻是午夜，不是她第一次用 App 的那个钟点", () => {
  const first = new Date(2026, 6, 5, 21, 0).getTime();   // 起点在晚上九点
  assert.equal(homeDayNo(first, new Date(2026, 6, 5, 21, 5)), 1);
  assert.equal(homeDayNo(first, new Date(2026, 6, 5, 23, 59)), 1);
  // 过了午夜就是第 2 天——不用等到第二天晚上九点
  assert.equal(homeDayNo(first, new Date(2026, 6, 6, 0, 1)), 2);
  assert.equal(homeDayNo(first, new Date(2026, 6, 6, 9, 29)), 2);
});

test("一整天里这个数不动", () => {
  const first = new Date(2026, 6, 5, 21, 0).getTime();
  const day = new Date(2026, 8, 5, 0, 30);
  const n = homeDayNo(first, day);
  for (const hh of [6, 9, 13, 18, 21, 23]) {
    assert.equal(homeDayNo(first, new Date(2026, 8, 5, hh, 45)), n, hh + " 点的时候数变了");
  }
  assert.equal(homeDayNo(first, new Date(2026, 8, 4, 23, 0)), n - 1, "前一天该少一天");
});

test("没有起点＝第 1 天；不许算出 0 或 NaN", () => {
  assert.equal(homeDayNo(0), 1);
  assert.equal(homeDayNo(null), 1);
  assert.equal(homeDayNo(undefined), 1);
  // 起点比现在还晚（换了时区、改过系统时间）也不许出负数
  assert.equal(homeDayNo(Date.now() + 86400000 * 3), 1);
});

test("算法只在一处；开屏那份抄的是同一套，两边钉在一起", () => {
  // 名片走 core.js 那个函数，不许自己再算一遍
  assert.match(comp, /const dayN = typeof homeDayNo === "function" \? homeDayNo\(first\) : 1;/);
  assert.doesNotMatch(comp, /Math\.floor\(\(Date\.now\(\) - first\) \/ 86400000\)/, "名片还在用旧的 24 小时算法");
  // 开屏跑在一切脚本之前，调不到 core.js，只能照抄——照抄的那份必须是同一套
  assert.match(html, /Math\.round\(\(fB - fA\) \/ 86400000\) \+ 1/);
  assert.doesNotMatch(html, /Math\.floor\(\(Date\.now\(\) - ft\) \/ 86400000\)/, "开屏还在用旧的 24 小时算法");
  assert.match(core, /Math\.round\(\(B - A\) \/ 86400000\) \+ 1/);
  // 用 round 不用 floor：夏令时那两天差 23 或 25 小时，floor 会少算一天
  assert.match(core, /用 round 不用 floor/);
});

test("App 开着过一夜，这个数也要跟着翻", () => {
  // 只挂 characters 的话，跨过午夜它不会重算——那是「翻页时刻不对」的另一半
  assert.match(comp, /\}, \[\(characters \|\| \[\]\)\.length, new Date\(\)\.toDateString\(\)\]\);/);
});
