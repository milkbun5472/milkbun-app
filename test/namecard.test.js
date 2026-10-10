// 群里 2026-10-10 许愿：转发名片
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const c = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
test("加号面板有名片，发出去的是一张卡、正文里写着推荐了谁（TA 读得到）", () => {
  assert.match(c, /\["namecard", "名片", "contact"\]/);
  assert.match(c, /kind: "namecard", cardId: c\.id/);
  assert.match(c, /content: "〔推荐名片〕我把「" \+ nm \+ "」的名片推给了你"/);
  assert.match(c, /if \(m\.kind === "namecard"\) return cardRow\(i, m, h\(NameCardMsg/);
});

test("TA 读到的是「她推荐了谁」，不是一句话", () => {
  const a = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(a, /m\.kind === "namecard" \? "【" \+ uName \+ "把「"/);
});
