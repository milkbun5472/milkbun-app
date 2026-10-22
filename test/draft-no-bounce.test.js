const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const body = src.slice(src.indexOf("function DraftInput("), src.indexOf("function ReplyKey("));

test("输入框长高不碰真框：不许先缩成 auto 再量（iOS 会跟着把整页推上推下）", () => {
  assert.ok(!/style\.height = "auto"/.test(body), "真框又被设成 auto 了");
  // 2026-10-22 抽成公共的 fitTextarea（施工规则/typing-hot-path.md）：替身框里量、没变就不写，规矩搬进那一份
  const fit = src.slice(src.indexOf("function fitTextarea("), src.indexOf("function fitTextarea(") + 400);
  assert.match(body, /fitTextarea\(ref\.current, DRAFT_MAX_H\)/, "要走公共那一份");
  assert.match(fit, /draftMeasure\(el\)/, "要在替身框里量");
  assert.match(fit, /if \(el\.style\.height !== want\) el\.style\.height = want;/, "高度没变就别写");
});
