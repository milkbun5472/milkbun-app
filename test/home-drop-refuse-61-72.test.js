// v61.72 拒收规矩：压到两个以上=拒收明说；整页装不下=拒收明说；绝不挤人去别页
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
test("先验地在 setLayout 外面做，拒收带人话提示", () => {
  const seg = src.slice(src.indexOf("function placeDrop(fromKey, toKey)"), src.indexOf("function makeFolder"));
  assert.match(seg, /先腾出 " \+ w2 \+ "×" \+ h2 \+ " 的空位再放/);
  assert.match(seg, /这一页满了，装不下它/);
  assert.match(seg, /placeDrop\.__refused/);
  assert.doesNotMatch(seg, /throw \{ __homeDropRefused/);
  // 先验地必须在 setLayout 之前
  assert.ok(seg.indexOf("会压到") < seg.indexOf("setLayout(function (prev)"));
});
