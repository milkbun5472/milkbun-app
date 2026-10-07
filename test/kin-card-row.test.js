// 她 2026-10-07：「他刷我亲属卡没带头像！又没跟上公共形状！而且也不能长按出菜单」
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");

test("聊天里的卡走一个公共外壳：长按、多选、两边头像", () => {
  const a = src.indexOf("const cardRow = (i, m, card) =>"), b = src.indexOf("};", a);
  assert.ok(a > 0);
  const row = src.slice(a, b);
  assert.match(row, /onTouchStart: selMode \? undefined : \(\) => startPress\(i\)/);
  assert.match(row, /onClick: selMode \? \(\) => toggleSel\(i\)/);
  assert.match(row, /!isU && h\(Avatar, \{ character: character/);
  assert.match(row, /isU && dsp\.myAvatar && h\(Avatar, \{ character: meAv/);
});

test("亲属卡两个方向八张都交给 cardRow，不再各摆各的", () => {
  for (const k of ["kinship", "kinbill", "kinraise", "kinunbind", "mykin", "mykinbill", "mykindaily", "mykinedit"]) assert.match(src, new RegExp(k + ": \\w+Card"));
  assert.match(src, /if \(KIN_CARDS\[m\.kind\]\) return cardRow\(i, m, h\(KIN_CARDS\[m\.kind\], \{ m: m, character: character, inRow: true \}\)\);/);
  assert.doesNotMatch(src, /m\.kind === "mykinbill"\) return h\(MyKinSpendCard/);
});
