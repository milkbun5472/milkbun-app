// 模型写成字面「\n」时也按行拆泡（群友 2026-11-04）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("单聊 splitCardsAndLines、群聊拆行都先把字面 \\n 换成真换行", () => {
  const i = eng.indexOf("function splitCardsAndLines"); let d = 0, k = eng.indexOf("{", i); for (; ; k++) { if (eng[k] === "{") d++; if (eng[k] === "}" && --d === 0) break; }
  const f = new Function("htmlCardOf", "HTML_CARD_HEAD", eng.slice(i, k + 1) + "return splitCardsAndLines;")(() => null, "div");
  assert.deepEqual(f("【要抱抱】\\n【要亲亲】\\n밥은 여기 놓는다|饭放这儿了"), ["【要抱抱】", "【要亲亲】", "밥은 여기 놓는다|饭放这儿了"]);
  assert.deepEqual(f("a\nb"), ["a", "b"]);
  assert.match(app, /String\(item\.text \|\| ""\)\.replace\(\/\\\\r\\\\n\|\\\\n\/g, "\\n"\)\.split\(\/\\n\+\/\)/);
});
