// 她 2026-10-09：「刚刚才修过这个等下别xxx怎么又有」——群里成员之间也在说「等下……别找我拉你」
const assert = require("assert"), fs = require("fs");
const E = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const i = E.indexOf("const STOCK_REPLY_BAN = `"), j = E.indexOf("`;", i);
assert.ok(i > 0 && j > i, "抠不出 STOCK_REPLY_BAN");
const b = E.slice(i, j);
assert.match(b, /\*\*对谁说都算\*\*：对她、对在场别的人、群里两个人互相说/);
assert.match(b, /往后那句要么是以后还得你来收拾，要么是以后出了事别来找你/);   // v75.315 不再引原句（被全员照抄成「到时候……」）
assert.match(E, /P\.push\(STOCK_REPLY_BAN\);/, "群里那几处没发到");
console.log("later threat ok");
