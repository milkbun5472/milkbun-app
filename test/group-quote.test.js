const test = require("node:test");
const assert = require("node:assert/strict");
const GroupQuote = require("../js/group-quote.js");

test("group quote keeps the quoted author's identity", () => {
  const messages = [
    { mid: "a1", role: "assistant", senderId: "guchao", senderName: "顾朝", content: "宝宝聪明" },
    { mid: "a2", role: "assistant", senderId: "gumu", senderName: "顾暮", content: "宝宝笨蛋" }
  ];
  const catalog = GroupQuote.buildCatalog(messages, "Lisa", 50);
  assert.deepEqual(GroupQuote.resolve({ quoteId: "Q1" }, catalog), {
    replyTo: "宝宝聪明",
    replyToId: "a1",
    replyToSenderId: "guchao",
    replyToSenderName: "顾朝"
  });
  assert.equal(GroupQuote.resolve({ quoteId: "Q2" }, catalog).replyToSenderName, "顾暮");
});

test("group quote can target a message from many rounds ago", () => {
  const messages = Array.from({ length: 18 }, (_, i) => ({
    mid: "m" + i,
    role: i % 3 === 0 ? "user" : "assistant",
    senderId: i % 3 === 0 ? null : "c" + (i % 2),
    senderName: i % 3 === 0 ? null : (i % 2 ? "顾朝" : "顾暮"),
    content: "第" + i + "条"
  }));
  const catalog = GroupQuote.buildCatalog(messages, "Lisa", 50);
  const old = catalog.find(x => x.id === "m2");
  assert.ok(old);
  assert.equal(GroupQuote.resolve({ quoteId: old.alias }, catalog).replyTo, "第2条");
});

test("identical text is disambiguated by author and legacy messages get an id", () => {
  const messages = [
    { ts: 10, role: "assistant", senderId: "a", senderName: "顾朝", content: "知道了" },
    { ts: 11, role: "assistant", senderId: "b", senderName: "顾暮", content: "知道了" }
  ];
  const catalog = GroupQuote.buildCatalog(messages, "Lisa", 50);
  const resolved = GroupQuote.resolve({ quote: "知道了", quoteSenderName: "顾朝" }, catalog);
  assert.equal(resolved.replyToSenderName, "顾朝");
  assert.match(resolved.replyToId, /^legacy_10_/);
});

test("catalog keeps the latest fifty quotable messages", () => {
  const messages = Array.from({ length: 60 }, (_, i) => ({ mid: "m" + i, role: "assistant", senderName: "A", content: String(i) }));
  const catalog = GroupQuote.buildCatalog(messages, "Lisa", 50);
  assert.equal(catalog.length, 50);
  assert.equal(catalog[0].id, "m10");
  assert.equal(catalog[49].id, "m59");
});
