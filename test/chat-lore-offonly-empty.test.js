const fs = require("fs"), assert = require("assert");
const s = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const i = s.indexOf("function ChatLorePicker"), body = s.slice(i, i + 6000);
assert.ok(/shutN = \(entries \|\| \[\]\)\.filter\(e => e && e\.enabled === false/.test(body), "counts switched-off entries");
assert.ok(body.includes("条是关着的，谁都不用"), "empty view explains switched-off entries");
assert.ok(body.includes('offOnly && !shown.length ? null : h("div"'), "no contradictory second hint when empty");
console.log("chat-lore-offonly-empty ok");
