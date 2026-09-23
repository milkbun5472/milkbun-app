// 中途退群变旁观／被拉回群（她 2026-09-23：「我退出群聊不要让他们知道我在看啊！
// 就是让他们以为我不在了来说话」）。
const assert = require("assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const bare = s => s.split("\n").map(l => l.replace(/^\s*\/\/.*$/, "")).join("\n");

const i = app.indexOf("const setGroupPresence = ");
assert(i > 0, "要有 setGroupPresence");
const fn = bare(app.slice(i, app.indexOf("\n  };", i)));
// 房间身份两头一起翻
assert(/updateGroup\(groupId, \{ roomKind: inGroup \? "group" : "spectate" \}\)/.test(fn));
assert(/saveGroupSettings\(groupId, \{ spectate: !inGroup \}\)/.test(fn));
// 退群只说退了，不许透露在看
const leave = fn.slice(fn.indexOf("} else {"));
assert(/退出了群聊/.test(leave));
assert(!/旁观|在看|看着/.test(leave.replace(/toast\([^)]*\)/g, "")), "群里那句不许说她还在看");
assert(/拉进了群聊/.test(fn));
// 接到设置页
assert(/onSetPresence: inGroup => setGroupPresence\(activeGroup\.id, inGroup\)/.test(app));
assert(/onSetPresence: onSetPresence/.test(comp));
const s0 = comp.indexOf("function GroupSettingsSheet(");
const sheet = comp.slice(s0, comp.indexOf("\nfunction ", s0 + 10));
assert(/onSetPresence\(spec\)/.test(sheet));
assert(/minHeight: 40/.test(sheet.slice(sheet.indexOf("onSetPresence &&"))), "按钮至少 40px");
console.log("group-presence-toggle-73-11 ok");
