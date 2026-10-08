const fs = require("fs"), assert = require("assert");
const c = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
assert(c.includes('["narr", "旁白", "不是谁说的话'), "group mode picker offers 旁白");
assert(/chatMode === "narr"\) \{ onSendRich && onSendRich\(\{ role: "narration"/.test(c), "narr mode sends narration");
assert(c.includes('"旁白 · 轻触切回群聊"'));
const m = fs.readFileSync(__dirname + "/../js/assistant-manual.js", "utf8");
assert(m.includes("**旁白：** 写的不是谁说的话"));
console.log("group-narration ok");
