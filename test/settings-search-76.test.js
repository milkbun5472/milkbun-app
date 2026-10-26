// 她 2026-10-25：「这些设置页面能不能加搜索」——聊天设置搜页面上真写着的字；全局设置搜攻略里写设置的那几条
const assert = require("node:assert/strict"), fs = require("fs");
const cp = fs.readFileSync("js/components.js", "utf8"), ui = fs.readFileSync("js/screens-ui.js", "utf8");
assert.match(cp, /function settingsFlash\(root, q\)/);
assert.match(cp, /function SettingsSearchBox\(\{ value, onChange, placeholder \}\)/);
assert.match(cp, /const sec = key => \(\{ secKey: key, /);
assert.match(cp, /csSearching && !settingsTab\n    \? h\("div", \{ "data-cssearch": tab/);
assert.match(cp, /document\.querySelectorAll\("\[data-cssearch\]"\)/);
assert.match(ui, /e\.app === "config" && e\.doc/);
assert.match(ui, /h\(SettingsSearchBox, \{ value: cfQ/);
assert.match(ui, /settingsFlash\(scrollRef\.current, q\)/);
// 摘一截原文：找得到就前后各留一点
const a = cp.indexOf("const settingsNorm"), b = cp.indexOf("// 跳过去以后", a);
const snip = new Function(cp.slice(a, b) + ";return settingsSnippet;")();
assert.equal(snip("开了他会时不时自己发一条朋友圈，关了就不发", "朋友圈"), "开了他会时不时自己发一条朋友圈，关了就不发");
assert.equal(snip("没有这个词", "朋友圈"), "");
console.log("ok");
