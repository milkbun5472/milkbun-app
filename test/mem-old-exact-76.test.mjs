// 她 2026-11-15：八月记的「大房」，十一月说「我要找大房」召不回——近几天的几条凑两个单字加新近分，把字字对得上的老事挤出前几名
import { test } from "node:test"; import assert from "node:assert/strict"; import { readFileSync } from "node:fs"; import vm from "node:vm";
const src = readFileSync(new URL("../js/engine.js", import.meta.url), "utf8");
const ctx = { console, setTimeout, clearTimeout, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document: { addEventListener() {}, documentElement: { style: {} } }, navigator: {} }; ctx.window = ctx; ctx.addEventListener = () => {}; ctx.removeEventListener = () => {}; vm.createContext(ctx); vm.runInContext(src, ctx);
test("三个月前原话对得上的老事，排在近几天只对上单字的前面", () => {
  const now = Date.now(), q = ctx.memTokens("我要找大房");
  const old = ctx.explainMemEntry({ id: "o", text: "她管他叫大房，说他是正宫", a: 1, ts: now - 100 * 86400e3 }, q, now, null, "我要找大房");
  const news = ["她大学室友要来找她玩", "他要去房东那里交钥匙", "她说大后天要加班找资料"].map((t, i) => ctx.explainMemEntry({ id: "n" + i, text: t, a: 2, ts: now - (i + 1) * 86400e3 }, q, now, null, "我要找大房"));
  news.forEach(n => assert.ok(old.score > n.score, "老的 " + old.score.toFixed(2) + " 输给了近的 " + n.score.toFixed(2)));
});
test("最近 8 条里 TA 的长回复满是常用词，也不把她刚点名的那件老事冲掉", () => {
  const now = Date.now(), lib = [];
  for (let i = 0; i < 30; i++) lib.push({ id: "n" + i, text: "我们今天一起去吃饭，你说你想吃什么我们就去吃什么，晚上一起散步回家 第" + i + "次", charIds: [], a: 1, ts: now - i * 86400e3 / 3 });
  lib.push({ id: "old", text: "她管他叫大房", charIds: [], a: 1, ts: now - 100 * 86400e3 });
  const query = "我们今天一起去吃饭吧\n你想吃什么我们就去吃什么，晚上一起散步回家\n我要找大房";
  const rows = ctx.retrieveMemories(lib, "c1", query, { limit: 5, focusText: "我要找大房", touch: false, vec: false });
  assert.ok(rows.some(e => e.id === "old"), "大房那条没进前 5：" + rows.map(e => e.id).join(","));
});
test("库里只有一两条时照样召得回（分量偏低不挡门）", () => {
  const now = Date.now();
  const rows = ctx.retrieveMemories([{ id: "a", text: "她怕打雷", charIds: [], a: 1, ts: now - 60 * 86400e3 }], "c1", "今晚又打雷了", { limit: 5, focusText: "今晚又打雷了", touch: false, vec: false });
  assert.ok(rows.some(e => e.id === "a"));
});
