// 她 2026-09-22：「群线下怎么点不开状态卡，你顺便看看单人线下行不行」。
//
// 查下来【谁点得开】这条判据原来写了两份：群线上写在组件里（按人判，对的），
// 群线下写在 app 里（按「这群里有没有配角」一刀切）。于是闭群里只要有一个配角，
// 线下【所有人】的头像都变成按钮，点普通成员却什么都不发生 —— 看着就是点不开。
// 单人线下没有这道闸，本来就点得开；这一份把它也钉住，别哪天被顺手加上闸。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const bare = s => s.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

test("判据只有一处，群线上群线下都问它", () => {
  assert.match(app, /const memberStatePeekable = \(gid, c\) => !!\(c && \(gsFor\(gid\)\.memoryInterop \|\| c\.npc\)\);/);
  assert.match(app, /canPeekMember: c => memberStatePeekable\(activeGroup\.id, c\)/, "群线上没接");
  assert.match(app, /canPeekMember: c => memberStatePeekable\(offlineGroup\.id, c\)/, "群线下没接");
  // 组件里不许再自己写一份（留着的那个只是没传时的兜底）
  assert.match(comp, /const canPeek = onOpenMemberState && \(canPeekMember \|\|/, "群线上还在自己判");
});

test("群线下：一律传回调，按人判谁点得开", () => {
  const seg = bare(app.slice(app.indexOf("onOpenMemberState: memberId => {\n      const c = characters.find"), app.indexOf("canPeekMember: c => memberStatePeekable(offlineGroup.id, c)")));
  assert.ok(seg.length > 40, "抠不出群线下那一处");
  assert.match(seg, /if \(!c \|\| !memberStatePeekable\(offlineGroup\.id, c\)\) return;/);
  // 旧的一刀切没了
  assert.doesNotMatch(bare(app), /groupMembers\(offlineGroup\)\.some\(c => c && c\.npc\)/, "还在按「群里有没有配角」一刀切");
});

test("头像该不该长成按钮，按这个人算", () => {
  assert.match(comp, /const offCanPeek = canPeekMember \|\| null;/);
  assert.equal((comp.match(/canOpenState: offCanPeek/g) || []).length, 2, "线下正文和回看两处都得传");
  assert.match(comp, /\(onOpenState && \(!canOpenState \|\| canOpenState\(spk\)\)\) \? h\("button"/,
    "点了没反应的头像还在装成按钮");
});

// ⚠️单人线下没有这道闸：那儿只有一个人，互通与否跟能不能看自己对象的心声无关
test("单人线下照旧点得开", () => {
  assert.match(app, /onOpenState: \(\) => \{ setStateCardRoomKey\(offlineIsRoom\(activeOfflineScopeKey\)/, "单人线下没传打开心声那一支");
  const i = comp.indexOf("      msgs.map((m, i) => h(OffCard, { key: m.id || i, m: m, msgIndex: i, t: t, char: char, meProfile: profile");
  assert.ok(i > 0, "抠不出单人线下那一处 OffCard");
  const line = comp.slice(i, comp.indexOf("\n", i));
  assert.match(line, /onOpenState: onOpenState/, "单人线下没把口子传给卡片");
  assert.doesNotMatch(line, /canOpenState/, "单人线下被顺手加上了闸");
});
