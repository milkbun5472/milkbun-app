// 长期导演便签（她 2026-09-23 转读者：「导演卡过了两轮之后就立刻失效了……软萌了两轮，失效那一刻就变得很霸总」）。
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const cut = (src, name, end) => { const i = src.indexOf(name); assert(i > 0, name); return src.slice(i, src.indexOf(end, i) + end.length); };
const box = { DIRECTOR_NOTE_TURNS: 2 };
vm.createContext(box);
vm.runInContext("var directorNoteNew = " + cut(app, "const directorNoteNew = ", "\n  };").replace("const directorNoteNew = ", "") + "\nvar directorNotesConsume = " + cut(app, "const directorNotesConsume = ", "\n  };").replace("const directorNotesConsume = ", ""), box);
const long = box.directorNoteNew("语气软萌一些", true), short = box.directorNoteNew("先别提那件事");
assert.strictEqual(long.long, true);
let notes = [long, short];
for (let k = 0; k < 5; k++) { const r = box.directorNotesConsume(notes, 0); if (r) notes = r.next; }
assert.strictEqual(notes.find(n => n.long).remaining, 2, "长期的不扣轮");
assert.strictEqual(notes.find(n => !n.long).remaining, 0, "两轮的照旧扣完");
// 两处引擎都认 long
assert.strictEqual((eng.match(/n && \(n\.long \|\| Number\(n\.remaining\) > 0\) \? n\.text/g) || []).length, 2, "单人和群线下都要注入长期便签");
// 两个便签面板都有「整场都算」
assert.strictEqual((comp.match(/onClick: \(\) => saveNote\(true\)/g) || []).length, 2);
assert(/onAddNote: \(n, long\) => offlineAddNote\(activeOfflineScopeKey, n, long\)/.test(app));
assert(/onAddNote: \(n, long\) => groupOfflineAddNote\(offlineGroup\.id, n, long\)/.test(app));
assert(/长期 · 整场有效，删掉才停/.test(comp));
console.log("director-note-long-73-22 ok");
