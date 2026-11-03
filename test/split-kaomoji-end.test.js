// 颜文字收尾也是一句的结尾（她 2026-11-04）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const i = src.indexOf("function splitLongBubble"); let d = 0, k = src.indexOf("{", i); for (; ; k++) { if (src[k] === "{") d++; if (src[k] === "}" && --d === 0) break; }
const f = new Function("htmlCardOf", "bubbleProtectQuote", "bubbleProtectNum", "bubbleGlueOrphans", "bubbleRestore", src.slice(i, k + 1) + "return splitLongBubble;")(() => null, x => x, x => x, x => x, x => x);
test("颜文字后面空一格接中文：在颜文字后面断；括号里有字的不算颜文字", () => {
  assert.deepEqual(f("下午队医给我按肩膀的时候还问我今天怎么这么兴奋呢 (〃^▽^〃) 大考官呢 今天工位上有没有碰到什么好玩的？", true),
    ["下午队医给我按肩膀的时候还问我今天怎么这么兴奋呢 (〃^▽^〃)", "大考官呢 今天工位上有没有碰到什么好玩的？"]);
  assert.equal(f("特意给我多舀了俩大牛肉丸 ٩(ˊᗜˋ*)و 还有上午测速转身蹬壁感觉比平时窜出去快了半个身位", true)[0], "特意给我多舀了俩大牛肉丸 ٩(ˊᗜˋ*)و");
  assert.deepEqual(f("我笑了（真的） 你别管", true), ["我笑了（真的） 你别管"]);
});
