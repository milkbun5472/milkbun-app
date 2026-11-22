// 小窝「放哪儿」聊天窗那格也列出 NPC
const assert = require("assert"); const fs = require("fs");
const s = fs.readFileSync(__dirname + "/../js/nest.js", "utf8");
const i = s.indexOf("function Place(");
const seg = s.slice(i, i + 1500);
assert(/tab === "chat" \? all\.filter\(c => c\.npc\)/.test(seg), "聊天窗名单带上 NPC");
console.log("ok nest-place-npc-90");
