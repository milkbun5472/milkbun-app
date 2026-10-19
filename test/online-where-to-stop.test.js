// 她 2026-10-18：「是不是我们提示词让大家话说太满了」——线上补「说到哪儿停」，删两句往多里推的
const assert = require("node:assert/strict");
const eng = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "engine.js"), "utf8");
const rule = eng.slice(eng.indexOf("const ONLINE_CHAT_RULE_V2 = `"), eng.indexOf("标点按【手机打字】来"));
assert.match(rule, /【这一轮说到哪儿停】说到她能接、你也真想听她接的那一处就停/);
assert.match(rule, /就是把她那一份也说完了/);
assert.match(rule, /话多的人照样连着发/, "不限条数这半句丢了");
assert.doesNotMatch(rule, /连着发都是常态|尤其要拆/);
console.log("ok");
