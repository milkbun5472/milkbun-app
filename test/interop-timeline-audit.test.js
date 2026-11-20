// 审计 2026-11-20（她：「你看看记忆互通和上下文拼进来的时间线有没有bug」）修掉的几处
const test = require("node:test"), assert = require("node:assert/strict");
const ap = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
const body = (start, end) => { const i = ap.indexOf(start); return ap.slice(i, ap.indexOf(end, i + start.length)); };
test("群线下的线上前情不再用不存在的 char，时间用群自己那只钟", () => {
  const b = body("const groupOnlinePrelude = ", "const crossRecentFor = ");
  assert.doesNotMatch(b, /char\.id/);
  assert.match(b, /fmtStampAI\(x\.startTs \|\| x\.endTs, "g:" \+ groupId\)/);
});
test("一个判断管群能不能流到某人那儿：互通、不互通频道、平行房间、面具、见面群", () => {
  const b = body("const groupFlowsTo = ", "const herNameIn = ");
  assert.match(b, /memoryInterop/); assert.match(b, /chSolo/); assert.match(b, /parallel/); assert.match(b, /groupMaskKey/); assert.match(b, /chHidden/);
  for (const k of ["groupOfflineEcho: (() =>", "const _myGroups = ", "const dateAlbumFor = ", "const crossRecentFor = "]) assert.ok(ap.slice(ap.indexOf(k), ap.indexOf(k) + 4000).includes("groupFlowsTo("), k);
});
test("群里她的名字照这个群戴的面具；照片空字也算一句；小频卡片不算谁说的", () => {
  const b = body("const crossRecentFor = ", "const groupNamedByNote = ");
  assert.match(b, /const uNameG = herNameIn\(g\.id\)/);
  assert.match(b, /m\.kind === "photo" \? "\[照片"/);
  assert.match(b, /m\.kind === "spacebot"/);
});
test("群线下近况跟线上同一条规矩：封闭群只带入群前私聊", () => {
  assert.match(ap, /const lines = \[ownMem, _open \? crossRecentFor\(id\) : _pre\]/);
});
test("频道里私密段不再重复带同空间别的频道", () => {
  assert.match(ap, /excludeGroups: \(\(\) => \{ if \(typeof groupsRef === "undefined"\) return null;/);
});
