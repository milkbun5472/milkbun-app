// 同处一室＝当面说话，不是打字（她 2026-09-23：「共处一室有时候还是觉得我和他在手机聊天」）。
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const i = eng.indexOf("const FACING_BAN");
const j = eng.indexOf("\n}\n", eng.indexOf("function samePlacePresence(", i)) + 3;
const box = {}; vm.createContext(box); vm.runInContext(eng.slice(i, j), box);
for (const g of [false, true]) {
  const t = box.samePlacePresence("小满", g);
  assert(/【话是当面说出口的，不是打字发过去的】/.test(t));
  assert(/张嘴说出来的话/.test(t) && /是【听见】的/.test(t));
  assert(/不说「发消息」「回你消息」/.test(t));
}
// 收尾那句离生成最近：同处一室时不许再说「像发微信一样」
const c = app.indexOf("const _turnClosing");
const close = app.slice(c, app.indexOf(";\n", c));
assert(/sameRoomFor\(charId\) && !offlineTogetherNow\(charId\) \? "当面说出口，【一句一个气泡】" : "像发微信一样/.test(close));
console.log("same-room-spoken-73-16 ok");
