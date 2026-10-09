const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const body = src.slice(src.indexOf("function DraftInput("), src.indexOf("function ReplyKey("));

test("输入框长高不碰真框：不许先缩成 auto 再量（iOS 会跟着把整页推上推下）", () => {
  assert.ok(!/style\.height = "auto"/.test(body), "真框又被设成 auto 了");
  assert.match(body, /draftMeasure\(el\)/, "要在替身框里量");
  assert.match(body, /if \(el\.style\.height !== want\) el\.style\.height = want;/, "高度没变就别写");
});
