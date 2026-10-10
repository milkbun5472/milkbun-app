const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const engine = fs.readFileSync(require.resolve("../js/engine.js"), "utf8");
const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");
const components = fs.readFileSync(require.resolve("../js/components.js"), "utf8");

// v72.37：这一整层（新建 / 消耗 / 尾部重申 / 那块清单）改成【单人线下和群线下共用一份】。
// 起因是她 2026-09-21 转来的反馈：「导演模式我每次发完他好像不会立刻听我的话，
// 要过两轮才听」——病根是单人线下落单了：存的是裸字符串、永不过期、尾部也没重申。
test("群线下短期导演提示在提示尾部再次钉住", () => {
  assert.match(engine, /本轮短期导演提示必须实际落实/);
  assert.match(engine, /n && \(n\.long \|\| Number\(n\.remaining\) > 0\) \? n\.text/);
  // 尾部那一句只许有一份实现，两处线下都问它要
  assert.equal((engine.match(/function directorNoteTail\(/g) || []).length, 1);
  assert.equal((engine.match(/directorNoteTail\(notes\)/g) || []).length, 3, "定义 1 处 + 单人线下 1 处 + 群线下 1 处");
});

test("单人线下也在尾部重申，不再只写在 system 中段", () => {
  assert.match(engine, /const directorLine = directorNoteTail\(notes\);/);
  const nudge = engine.match(/const finalNudge = [^;]+;/)[0];
  assert.match(nudge, /directorTail/, "导演便签没挂进最终尾注");
  // ⚠️文风仍排在最末（v55.41 那条没被挤走）
  assert.match(nudge, /directorTail \+ styleTail;/);
});

test("新便签默认两轮，只有成功生成后才扣轮次", () => {
  // ⚠️轮数钉在【常量】上，别再 grep "remaining: 2"：那个字面量已经收进公共那一份了
  assert.match(app, /const DIRECTOR_NOTE_TURNS = 2;/);
  assert.equal((app.match(/const directorNoteNew = /g) || []).length, 1, "新建只许有一份");
  assert.equal((app.match(/directorNoteNew\(note, long\)/g) || []).length, 2, "单人线下 + 群线下都走它");
  assert.equal((app.match(/const directorNotesConsume = /g) || []).length, 1, "消耗只许有一份");
  assert.equal((app.match(/directorNotesConsume\(/g) || []).length, 3, "单人线下 + 群线下 + 线上（v75.24x 搬过去的）各消耗一次");
  const consumeAt = app.indexOf("短期导演便签只在成功生成后消耗");
  const beatsAt = app.indexOf("for (let i = 0; i < beats.length; i++)", app.indexOf("const genGroupOfflineFrom"));
  assert.ok(consumeAt > beatsAt);
  assert.match(app, /remaining: Math\.max\(0, Number\(n\.remaining \|\| 0\) - 1\)/);
});

test("界面固定显示剩余轮数、结束状态并支持删除", () => {
  // v72.37：那块清单也收成公共的一份，单人线下和群线下各挂一次
  assert.equal((components.match(/function DirectorNotesPanel\(/g) || []).length, 1);
  assert.equal((components.match(/h\(DirectorNotesPanel, \{/g) || []).length, 2, "少了一处线下没挂这块清单");
  assert.match(components, /导演便签 · 固定显示/);
  assert.match(components, /还会影响接下来/);
  assert.match(components, /已结束 · 改一下就会重新生效/, "结束了的便签要说清：改一句就能再生效");
  assert.match(components, /onDeleteNote/);
});

// 她 2026-10-03：「线下导演便签能不能搞成可编辑」——单人线下 / 群线下同一块、同一支
test("导演便签能就地改：改了短期的重新算满轮，清空＝删掉；两处线下都接上", () => {
  const fs2 = require("fs"), path2 = require("path");
  const A2 = fs2.readFileSync(path2.join(__dirname, "..", "js", "app.js"), "utf8");
  const C2 = fs2.readFileSync(path2.join(__dirname, "..", "js", "components.js"), "utf8");
  const src = A2.slice(A2.indexOf("const directorNoteEdit = "), A2.indexOf("const offlineEditNote"));
  const DIRECTOR_NOTE_TURNS = 2, memVecHash = s => "h" + s.length;
  const edit = new Function("DIRECTOR_NOTE_TURNS", "memVecHash", src + "\nreturn directorNoteEdit;")(DIRECTOR_NOTE_TURNS, memVecHash);
  const list = [{ id: "a", text: "软一点", remaining: 0 }, { id: "b", text: "整场都别凶", remaining: 2, long: true }, "旧的裸字符串"];
  const r = edit(list, "a", "再软一点");
  if (r[0].text !== "再软一点" || r[0].remaining !== 2) throw new Error("改过的短期便签要重新算满两轮");
  const r2 = edit(list, "b", "整场都温柔");
  if (r2[1].remaining !== 2 || !r2[1].long) throw new Error("长期便签照旧是长期的");
  if (edit(list, "a", "  ").length !== 2) throw new Error("清空再存＝删掉");
  const r3 = edit(list, 2, "旧的改一下");
  if (typeof r3[2] !== "object" || r3[2].text !== "旧的改一下") throw new Error("旧版裸字符串也改得了，改完转成对象");
  if (!/onEditNote: \(id, text\) => offlineEditNote\(activeOfflineScopeKey, id, text\)/.test(A2)) throw new Error("单人线下没接上");
  if (!/onEditNote: \(id, text\) => groupOfflineEditNote\(offlineGroup\.id, id, text\)/.test(A2)) throw new Error("群线下没接上");
  if ((C2.match(/h\(DirectorNotesPanel, \{[^}]*onEditNote: onEditNote \}\)/g) || []).length !== 2) throw new Error("两处面板都要把 onEditNote 传进去");
});
