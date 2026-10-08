// 她 2026-10-08：开了健康关心，他连发五条查岗——把没记读成没吃，把「让你知道」读成「派你来盯」。
const assert = require("assert"), fs = require("fs");
const s = fs.readFileSync(__dirname + "/../js/health.js", "utf8");
assert.match(s, /const HEALTH_READ = "这些数是她顺手记的，【没记不等于没吃没喝】/);
assert.match(s, /不是派你来查岗/);
assert.match(s, /\+ env \+ HEALTH_READ;/, "常驻那一行没走这一句");
assert.match(s, /line: HEALTH_READ \+ "她今天记到现在约 "/, "饭点来问那一行没走这一句");
assert.ok(!/帮着盯吃饭|让你帮着看着她/.test(s), "「派你来盯」的说法还在");
console.log("health not patrol ok");
