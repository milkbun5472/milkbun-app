// 卡片那一族也能长按（她 2026-10-05：「小卡类的东西都没有长按菜单……html 删都删不了，其他卡片也是」）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");
test("单聊、群聊每一行都过同一个 cardPressRow；卡片长按弹同一份菜单、多选点一下就选中", () => {
  assert.match(comp, /\.map\(_row => cardPressRow\(\(\(\{ m, i, part, last \}\) => \{/);
  assert.match(comp, /row = cardPressRow\(row, _m, i, \{ selMode, startPress, endPress, toggleSel \}\);/);
  const fn = comp.slice(comp.indexOf("function cardPressRow("), comp.indexOf("function useCardPressMenu("));
  assert.match(fn, /onClickCapture: o\.selMode \?/);
  assert.match(fn, /style: \{ display: "contents" \}/, "包的那层不许改排版");
  ["gift", "takeout", "loveletter", "chatforward", "couple_invite"].forEach(k => assert.ok(comp.includes('"' + k + '"'), k));
});
test("HTML 卡片：iframe 里认长按，喊外面一声；单聊群聊都接", () => {
  assert.match(comp, /press:1\},"\*"\)/);
  assert.match(comp, /if \(d\.press\) \{ if \(frame\.current\) frame\.current\.dispatchEvent\(new CustomEvent\("qq-card-press"/);
  assert.equal((comp.match(/useCardPressMenu\(setMenu, selMode\);/g) || []).length, 2);
  assert.match(comp, /\.qq-cardsel \[data-wk=htmlcard\]\{pointer-events:none\}/, "多选时 HTML 卡片点不中");
});
