// 线上导演便签（她 2026-10-10）：跟旁白放一起；新建/扣轮/提示语走线下那几支，不另写一份。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const R = f => fs.readFileSync(__dirname + "/../js/" + f, "utf8");
const app = R("app.js"), comp = R("components.js");

test("app：存成 x_chatDirNotes，按 chatKey 分；新建和扣轮用线下那一支", () => {
  assert.match(app, /saveJSON\("x_chatDirNotes", n\)/);
  assert.match(app, /const chatDirNoteAdd = \(chatKey, text, long\) => \{\n\s*const item = directorNoteNew\(text, long\);/);
  assert.match(app, /const _dn = directorNotesConsume\(\(chatDirNotesRef\.current \|\| \{\}\)\[chatKey\], 0\);/, "成功回了才扣");
  assert.match(app, /const _taskFull = \(_body \? _digitalTaskFull : _normalTaskV2\) \+ _roomHint \+ _dirHint;/, "放在本轮任务末尾");
});

test("界面：旁白模式里两档，选「往后的方向」发出去是便签不是旁白卡", () => {
  assert.match(comp, /const dirMode = chatMode === "narr" && narrKind === "dir" && !!onAddDirNote;/);
  assert.match(comp, /if \(dirMode\) \{ onAddDirNote\(v, dirLong\); return; \}/);
  assert.match(comp, /\[\["event", "此刻发生了什么"\], \["dir", "往后的方向"\]\]/);
  assert.match(comp, /"data-wk": "dirnote"/);
});
