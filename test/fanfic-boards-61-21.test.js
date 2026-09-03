// 版块表重排（她 2026-09-03：「我的顺序是参考了别人的，我们考虑一下删掉部分再加点新的，
// 然后顺序也打乱一点吧」）。她选的：删【都市】【无限流】，加【民国】【志怪】【西幻】，
// 顺序按「你俩的温度」排，不再照热门榜。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "fanfic.js"), "utf8");

const names = (block) => (block.match(/name: "([^"]+)"/g) || []).map(x => x.slice(7, -1));
const seedBlock = src.slice(src.indexOf("  const SEED_TABS = ["), src.indexOf("  const RETIRED_TABS = ["));
const retiredBlock = src.slice(src.indexOf("  const RETIRED_TABS = ["), src.indexOf("  const K_TABS"));

test("撤掉的两版不在版块表里，新加的三版在", () => {
  const n = names(seedBlock);
  assert.ok(!n.includes("都市") && !n.includes("无限流"), "撤掉的还挂在版块栏上：" + n.join("/"));
  ["民国", "志怪", "西幻"].forEach(x => assert.ok(n.includes(x), "少了新版：" + x));
});

test("顺序不是热门榜那一套：推荐打头，古风 ABO 顶到前面", () => {
  const n = names(seedBlock);
  assert.equal(n[0], "推荐");
  assert.ok(n.indexOf("古风") <= 2 && n.indexOf("ABO") <= 3, "温度高的那两版没排到前面：" + n.join("/"));
  assert.ok(n.indexOf("港片") === n.length - 1, "冷门那版没靠后");
});

test("撤版块不等于删她的文：底下还有文章的那一版照旧露出来", () => {
  assert.deepEqual(names(retiredBlock), ["都市", "无限流"]);
  assert.match(src, /function livingRetired\(\) \{/);
  assert.match(src, /fics\.some\(function \(f\) \{ return f && f\.tabId === tb\.id; \}\)/, "露不露面不是看它底下还有没有文章");
  assert.match(src, /return SEED_TABS\.concat\(livingRetired\(\)\);/, "空档那一路没接上");
  assert.match(src, /\.concat\(custom\)\.concat\(livingRetired\(\)\)/, "老档那一路没接上");
});

test("新版的世界观说明给的是判据和维度，不是可以照抄的例句（prompt-no-content-samples）", () => {
  const seg = seedBlock.split("tab_minguo")[1].split("tab_campus")[0]
    + seedBlock.split("tab_yao")[1].split("tab_apoc")[0]
    + seedBlock.split("tab_xihuan")[1].split("tab_hk")[0];
  assert.ok(!/如「|比如「|例如「|像这样：/.test(seg), "写了可以被逐字照抄的内容示范");
  ["【文风】", "忌"].forEach(k => assert.ok(seg.includes(k), "新版说明缺了：" + k));
});
