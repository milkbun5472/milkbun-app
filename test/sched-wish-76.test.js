// 群友 2026-10-25：「许愿一个可以给 AI 排日程提供方向，就像重 Roll 方向一样」
const assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync("js/app.js", "utf8"), cp = fs.readFileSync("js/components.js", "utf8");
assert.match(cp, /requestAppPrompt\("AI 排剩下这几天", /);
assert.match(cp, /v => onGenWeek\(curChar, String\(v \|\| ""\)\.trim\(\)\)/);
assert.match(cp, /if \(!asked\) onGenWeek\(curChar\);/, "输入层没起来就照旧直接排");
assert.match(app, /onGenWeek: async \(c, wish\) => \{/);
assert.match(app, /count: 7 - dowMon, wish: wish \|\| "" \}\)/);
assert.match(app, /opts && opts\.wish \? "\\n【她希望这几天的方向】"/);
console.log("ok");
