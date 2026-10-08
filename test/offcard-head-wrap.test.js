// 线下卡片顶上那排（她 2026-10-08 截图：字号大一点，删除键冲出卡片）：排不下时按钮整组换到第二行
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");

test("线下卡片顶栏能换行，名字留底宽，按钮组靠右", () => {
  const card = comp.slice(comp.indexOf("function OffCard("), comp.indexOf("// ---- 群聊线下模式"));
  assert.match(card, /"data-wk": "offhead", className: "flex items-center flex-wrap mb-2\.5"/);
  assert.match(card, /"data-wk": "offname", style: \{ flex: "1 1 5em"/);
  assert.match(card, /const actions = editable && !editing && h\("div", \{ className: "flex items-center gap-3 shrink-0", style: \{ marginLeft: "auto" \} \}/);
});
