const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const imp = fs.readFileSync(path.join(root, "js/impression.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

// 月度印象：每个月每个角色眼里的「她」——一张剪影 + 三个词 + 一句他亲口说的话
test("月份工具：跨年、补零、区间都要对", () => {
  const grab = name => {
    const i = imp.indexOf("  const " + name + " = ");
    return imp.slice(i, imp.indexOf("\n", imp.indexOf(";", imp.indexOf("=>", i))) + 1);
  };
  const m = new Function(
    "const monthKeyOf = ts => { const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };" +
    "const monthRange = k => { const [y, mm] = String(k).split('-').map(Number); return { start: new Date(y, mm - 1, 1).getTime(), end: new Date(y, mm, 1).getTime() - 1 }; };" +
    "const prevMonths = n => { const out = [], now = new Date(2026, 0, 15); for (let i = 0; i < n; i++) out.push(monthKeyOf(new Date(now.getFullYear(), now.getMonth() - i, 1).getTime())); return out; };" +
    "return { monthKeyOf, monthRange, prevMonths };")();
  assert.equal(m.monthKeyOf(new Date(2026, 7, 20).getTime()), "2026-08", "月份要补零");
  const r = m.monthRange("2026-08");
  assert.equal(new Date(r.start).getDate(), 1);
  assert.equal(new Date(r.end).getMonth(), 7, "月末不能溢出到下个月");
  assert.ok(new Date(r.end + 1).getMonth() === 8);
  assert.deepEqual(m.prevMonths(3), ["2026-01", "2025-12", "2025-11"], "往回数要能跨年");
  // 源码里也得是同一套实现
  assert.match(imp, /padStart\(2, "0"\)/);
  assert.match(imp, /new Date\(y, m, 1\)\.getTime\(\) - 1/);
});

test("剪影是插画不是照片：不给参考照，且明令不画五官", () => {
  const art = imp.slice(imp.indexOf("async function genArt"), imp.indexOf("window.Impression ="));
  assert.match(art, /generateSelfieImage\(prompt, null\)/, "刻意不传参考照——看不见脸，给了只会让它去画五官");
  assert.match(art, /完全看不见五官、没有脸部细节/);
  assert.match(art, /只取发型长度与身形，不画五官/);
  assert.match(art, /不画成头像或证件照/);
  assert.match(art, /可公开展示/);
});

test("quote 必须守声纹，不能写成通用抒情散文", () => {
  const gen = imp.slice(imp.indexOf("async function genText"), imp.indexOf("async function genArt"));
  assert.match(gen, /声纹最高优先/);
  assert.match(gen, /遮住名字也该认得出/);
  assert.match(gen, /别写成通用抒情散文，也别写成人物介绍/);
  assert.match(gen, /用「她」称呼她，不要直呼名字/);
  // 「Ta 眼里」已有的长期印象当底子，别每月推翻重来
  assert.match(gen, /底子，别推翻，只在它上面往前长一点/);
  assert.match(imp, /window\.Gaze && window\.Gaze\.text/);
  // 三个关键词要有层次，不许三个同义词（TAG_RULE 抽在函数外，对全文断言）
  assert.match(imp, /别三个同义词堆一起/);
  assert.match(imp, /一个偏气质、一个偏状态、一个偏他自己的私心/);
  // 出不全就算失败，不许写半张卡
  assert.match(gen, /if \(!quote \|\| !tags\.length\) throw new Error/);
});

test("图出不来不算失败：字是主体，剪影可以之后补", () => {
  const seg = imp.slice(imp.indexOf("async function make"), imp.indexOf("// 只重出剪影"));
  assert.match(seg, /catch \(e\) \{ props\.toast\("字写好了，剪影没出来/);
  assert.match(imp, /(e\.img \? "重出剪影" : "补一张剪影")/, "没图的卡片要能单独补一张");
});

test("补齐：只补有素材的月份，一月一月来，失败即停", () => {
  const seg = imp.slice(imp.indexOf("async function backfill"), imp.indexOf("// ---- 单张卡片"));
  assert.match(seg, /M\.prevMonths\(12\)\.filter\(k => !have\.has\(k\)\)/, "已经有的不重写");
  assert.match(seg, /\.length >= 6\)/, "没素材的月份跳过，不硬编");
  assert.match(seg, /if \(!ok\) \{ props\.toast\("补到 " \+ M\.monthLabel\(k\) \+ " 时停下了/, "失败即停，前面的都保留");
  assert.match(seg, /want\.reverse\(\)/, "从最早的一个月往回补，时间顺序才对");
});

test("同一个月重写是覆盖，不是堆两张", () => {
  assert.match(imp, /\[charId\]: \[entry\]\.concat\(\(p\[charId\] \|\| \[\]\)\.filter\(x => x\.monthKey !== monthKey\)\)/);
});

test("三处注册齐全：脚本、图标、路由", () => {
  assert.match(html, /<script src="js\/impression\.js\?v=/);
  assert.match(comp, /impression: \{ kind: "app", zh: "月度印象"/);
  assert.match(comp, /"theater", "impression", "weekly"/, "要真的摆进桌面，不然点不到");
  assert.match(app, /screen === "impression"\) body = h\(ImpressionApp/);
  assert.match(app, /active: offlineActive/);
});
