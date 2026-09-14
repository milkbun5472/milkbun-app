// 社区反馈（她 2026-09-14 转来）：「生成记忆的时候，似乎线下的内容是边聊会边生成一些，
// 然后结束了重新全部生成，我看是有一些些重复的～」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

test("滚动写的那几条带着场次号，结束那一趟按号收起来", () => {
  // 白名单式建对象：ofs 不写进 addMemEntry 就会被静默丢掉
  assert.match(app, /\.\.\.\(e\.ofs \? \{ ofs: String\(e\.ofs\) \} : \{\}\)/, "addMemEntry 没收下 ofs");
  assert.ok(app.indexOf("const supersedeOfflineRolling = ofsId =>") > 0, "没有收起旧条那一处");
  // 单人线下 + 群线下，滚动和结束四处都要带上场次号（3 条 × 2 处 × 2 端）
  assert.equal((app.match(/ofs: sess\.id/g) || []).length, 12, "有一处没带场次号，那一场就收不干净");
  // 两处结束都要先收再写
  assert.equal((app.match(/supersedeOfflineRolling\(sess\.id\)/g) || []).length, 2);
});

test("收起来不是删：行还在，只是不再冒头", () => {
  const fn = app.slice(app.indexOf("const supersedeOfflineRolling = ofsId =>"), app.indexOf("const isDupMem = "));
  assert.match(fn, /surfaceState: "superseded"/, "直接把行删了——全库别处都是标 superseded");
  assert.ok(fn.indexOf(".filter(") < 0, "用 filter 把行摘掉了");
  // 她自己动过的不碰
  assert.match(fn, /if \(e\.source === "manual" \|\| e\.pinned\) return e;/);
  assert.match(fn, /if \(\(e\.surfaceState \|\| "active"\) !== "active"\) return e;/);
});

test("总结真的出来了才收——不然这一场的记忆会全没", () => {
  // ⚠️顺序：summary 为空（那一枪失败）时，一条都不许收
  assert.match(app, /if \(!sideRoom && summary\) supersedeOfflineRolling\(sess\.id\);/);
  assert.match(app, /if \(summary && group && interopOn\) supersedeOfflineRolling\(sess\.id\);/);
});
