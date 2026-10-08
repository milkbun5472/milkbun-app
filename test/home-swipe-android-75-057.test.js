// 安卓浏览器主屏换不了页（群里 2026-10-08）：方向在原生非被动监听里就判出来；每一页平时也写明 pan-y
const assert = require("assert");
const c = require("fs").readFileSync(__dirname + "/../js/components.js", "utf8");
const i = c.indexOf("var block = function (e) {"), seg = c.slice(i, i + 1600);
assert.match(seg, /if \(r && r\.dir == null && e\.touches && e\.touches\[0\]\) \{/);
assert.match(seg, /r\.dir = Math\.abs\(dx\) > Math\.abs\(dy\) \? "h" : "v";/);
assert.match(seg, /if \(r && r\.dir === "h"\) e\.preventDefault\(\);/);
assert.match(c, /el\.addEventListener\("touchmove", block, \{ passive: false \}\)/);
assert.match(c, /touchAction: dragKey \? "none" : "pan-y" \} \},/);
console.log("home-swipe-android ok");
