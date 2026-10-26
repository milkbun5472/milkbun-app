const fs = require("fs"), assert = require("assert");
const s = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const i = s.indexOf("function ChatLorePicker"), body = s.slice(i, s.indexOf("function ChatSettings", i));
assert.ok(/shutList = \(entries \|\| \[\]\)\.filter\(e => e && e\.enabled === false/.test(body), "collects switched-off entries");
assert.ok(body.includes('"data-wk": "chatloreshut"'), "switched-off group shown under 只看没用的");
assert.ok(/enabled: true, charIds: \[id\]/.test(body), "tap opens it for this char only");
assert.ok(body.includes('offOnly && !shown.length ? null : h("div"'), "no contradictory hint when empty");
console.log("chat-lore-offonly-empty ok");
