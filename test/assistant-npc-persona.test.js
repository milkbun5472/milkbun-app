// 她 2026-11-02：「秋秋不能直接贴 npc 简介更新吗」——配角的简介就是 persona，改人设／外貌那两样连配角一起认
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "assistant.js"), "utf8");
assert.match(src, /zh: "角色人设",[\s\S]{0,200}read: ctx => \(ctx\.allChars \|\| ctx\.characters \|\| \[\]\)\.map\(c => \(\{ id: c\.id, name: c\.name, text: c\.persona \}\)\)/);
assert.match(src, /zh: "角色外貌",\n\s*read: ctx => \(ctx\.allChars \|\| ctx\.characters \|\| \[\]\)/);
assert.match(src, /简介: clip\(c\.persona, 600\)/);
assert.match(src, /配角也用这两样：配角的简介就是它的 persona，id 填快照「配角」那一栏的 id/);
console.log("ok");
