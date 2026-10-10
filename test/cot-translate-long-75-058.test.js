// 英文思考链夹着中文名字/台词也要有译键（群里 2026-10-08）
const assert = require("assert");
const eng = require("fs").readFileSync(__dirname + "/../js/engine.js", "utf8");
const cut = (a, b) => { const i = eng.indexOf(a), j = eng.indexOf(b, i); assert.ok(i >= 0 && j > i); return eng.slice(i, j); };
const fns = new Function("localStorage", cut("function _transStrip", "function safeTop(") + "\nreturn { translatableLang, translatableLangLong };");
const F = fns({ getItem: () => null });
const src = cut("function translatableLangLong", "function safeTop(");
assert.match(src, /latin >= 40 && latin > han \* 3 \? "英文" : ""/);
// 思考链现在经公共 TransText 渲染；它的 long 参数与译键连接由 reasoning-chain.test.js 验证。
{
  const cot = "The user just said she is tired. I should respond as 沈屿白 would — gently, without lecturing. Maybe say \"早点睡\" but in his own voice, short and warm.";
  assert.strictEqual(F.translatableLang(cot), "");          // 气泡那份：有汉字就不给
  assert.strictEqual(F.translatableLangLong(cot), "英文");   // 思考链这份：英文为主就给
  assert.strictEqual(F.translatableLangLong("他说今天很累，我应该温柔一点回应 OK"), "");
}
console.log("cot-translate-long ok");
