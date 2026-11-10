import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const GQ = require("../js/group-quote.js");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const chat = [{ role: "user", content: "不准拆" }, { role: "user", content: "长句子" }, { role: "user", content: "算犯规" }, { role: "assistant", content: "不拆了" }];
test("单聊引用对不上就不挂", () => {
  assert.equal(GQ.resolve({ quote: "只是抱" }, GQ.buildCatalog(chat, "我", 60)).replyTo, null);
  assert.equal(GQ.resolve({ quote: "算犯规" }, GQ.buildCatalog(chat, "我", 60)).replyTo, "算犯规");
});
test("单聊接上了群聊那一个 resolve", () => {
  assert.match(app, /window\.GroupQuote\.resolve\(\{ quote: _quoteRaw \}, window\.GroupQuote\.buildCatalog\(chatsRef\.current\[chatKey\]/);
});
