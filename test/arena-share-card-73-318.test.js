// 擂台分享做成「聊天记录」卡：卡上露几行、点开看全部；content 仍是整场全文（她 2026-09-23）。
const assert = require("assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
assert(/kind: "chatforward", content: arenaShareText\(session\)/.test(app), "模型读得到整场全文");
assert(/title: "擂台 · " \+ session\.topic, label: "擂台记录"/.test(app));
assert(/pChat\(toChar\.id, p => \[\.\.\.p, arenaShareMsg\(session/.test(app) && /pGChat\(group\.id, p => \[\.\.\.p, arenaShareMsg\(session/.test(app), "单聊群聊都走卡");
assert(/if \(m && m\.forward && m\.forward\.title\) return m\.forward\.title;/.test(comp));
console.log("arena-share-card ok");
