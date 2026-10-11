// 本体模式开了「每轮都留心情、心声和好感」，第一轮有、之后就没了（她 2026-10-11 转群友）：
// 历史里TA以前的回复只剩说出口的话，看起来像「从来不交那三格」，于是照着历史省掉。
// 总纲（system 里那句）要跟着开关说清：每轮都交，历史里看不到不等于没写。
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("node:fs").readFileSync(require.resolve("../js/app.js"), "utf8");

test("每轮都留开着时，本体模式的总纲也要求每轮交三格，并说明历史里看不到", () => {
  const i = app.indexOf("const _primer = _body"), seg = app.slice(i, app.indexOf("\n      const", i + 30));
  assert.match(seg, /_bodyFill \? "这里开着「每轮都留心情、心声和好感」：每一轮都照本轮末尾那份 JSON 交/);
  assert.match(seg, /别照着历史省掉/);
  assert.ok(app.indexOf("const _bodyFill =") < i);
});
