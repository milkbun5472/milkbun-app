// 她 2026-11-02：「为啥看到群多少，看不到私聊历史带了多少」——聊天记录是一条条单独发的，真发出去那一刻记收据
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const i = app.indexOf("const aiMessages = await expandMessageImages(g.map(");
const seg = app.slice(i, i + 900);
assert.match(seg, /window\.__histReceipt = Object\.assign\(\{\}, window\.__histReceipt \|\| \{\}, \{ \[charId\]: \{ ts: Date\.now\(\), n: g\.length, chars:/);
assert.ok(app.indexOf('raw = await callAI(_route, system + mcpToolHint(_mcpT), aiMessages, { use: "chat"') > i, "收据记在真正发出去之前那一刻，跟发出去的是同一份 g");
assert.match(scr, /"data-wk": "histreceipt"/);
assert.match(scr, /r\.n \+ " 条 · " \+ r\.chars \+ " 字"/);
console.log("ok");
