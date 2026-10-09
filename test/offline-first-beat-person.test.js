// 群友 2026-10-09：每次进线下的第一段都是第一人称，设置里明明是角色第三、用户第二
const assert = require("assert"), fs = require("fs");
const E = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
assert.match(E, /function narrPersonParts\(s\) \{/);
assert.match(E, /const parts = narrPersonParts\(s\);/, "叙事准则那份没走同一处");
assert.match(E, /const personTail = !isDigital && _personParts\.length && !\(session\.msgs \|\| \[\]\)\.some\(m => m && m\.role === "char"/);
const nudge = E.match(/const finalNudge = [^;]+;/)[0];
assert.match(nudge, /\+ personTail \+/, "第一拍的人称没挂进尾巴");
console.log("first beat person ok");
