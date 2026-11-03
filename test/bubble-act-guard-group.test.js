// 她 2026-11-03 截图：群里萧成烨两句台词（谈论别人）被认成动作行。群里不按「他/她」猜，只认挂了牌子、自己名字括起来的。
const assert = require("node:assert/strict"), fs = require("fs");
const G = require("../js/bubble-act-guard.js");
const words = ["他那匹青骢马要是敢上街", "程策当场就能给他扣进西营马厩"];
assert.deepEqual(G.split(words, { group: true, selfNames: ["萧成烨"] }).acts, [], "群里谈论别人的台词不挪");
assert.ok(G.split(["【线下场景】：我推开门", "一手按着袖口"], { group: true }).acts.length > 0, "挂了牌子的群里照样认");
assert.ok(G.split(["【萧成烨 把刀收回鞘里", "转身出去】"], { group: true, selfNames: ["萧成烨"] }).acts.length > 0, "自己名字括起来的照样认");
assert.ok(G.split(["我把脸颊在她怀里贴紧了蹭两下", "环在她后腰的手微微收紧"], {}).acts.length > 0, "单聊那种照旧挪");
assert.match(fs.readFileSync("js/app.js", "utf8"), /BubbleActGuard\.split\(gBubbles, \{ selfNames: \[spk && spk\.name, spk && spk\.remark\], group: true \}\)/);
