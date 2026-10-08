// 英文思考链夹着中文名字/台词也要有译键（群里 2026-10-08）
const assert = require("assert");
const eng = require("fs").readFileSync(__dirname + "/../js/engine.js", "utf8");
const cut = (a, b) => { const i = eng.indexOf(a), j = eng.indexOf(b, i); return eng.slice(i, j); };
global.localStorage = { getItem: () => null };
const fns = new Function(cut("function _transStrip", "function translatableLang(") + cut("function translatableLang(", "// iOS 刘海") + "\nreturn { translatableLang, translatableLangLong };");
const F = fns();
const src = cut("function translatableLangLong", "// iOS 刘海");
assert.match(src, /latin >= 40 && latin > han \* 3 \? "英文" : ""/);
assert.match(require("fs").readFileSync(__dirname + "/../js/components.js", "utf8"), /const rLang = typeof translatableLangLong === "function" \? translatableLangLong\(m\.reasoning\)/);
{
  const cot = "The user just said she is tired. I should respond as 沈屿白 would — gently, without lecturing. Maybe say \"早点睡\" but in his own voice, short and warm.";
  assert.strictEqual(F.translatableLang(cot), "");          // 气泡那份：有汉字就不给
  assert.strictEqual(F.translatableLangLong(cot), "英文");   // 思考链这份：英文为主就给
  assert.strictEqual(F.translatableLangLong("他说今天很累，我应该温柔一点回应 OK"), "");
}
console.log("cot-translate-long ok");
