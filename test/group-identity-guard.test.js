const assert = require("assert");
const G = require("../js/group-identity-guard.js");
const members = [{ id: "a", name: "顾朝" }, { id: "b", name: "顾暮" }];

assert.deepEqual(G.aliases(members[0]), ["顾朝", "阿朝"]);
assert.equal(G.selfVocative("哎呀阿朝，你怎么又来了", members[0]), true);
assert.equal(G.selfVocative("阿暮，你看看这个", members[0]), false);

const out = G.sanitize([
  { name: "Lisa", text: "哎呀阿朝" },
  { name: "不存在的人", text: "我来说一句" },
  { name: "顾朝", text: "哎呀阿朝，你又这样" },
  { name: "顾朝", text: "阿暮，你看看", thought: "哎呀阿朝，真拿他没办法" },
  { name: "顾暮", text: "行，我看看" }
], members, "Lisa");

assert.deepEqual(out.items.map(x => x.name), ["顾朝", "顾暮"]);
assert.equal(out.items[0].thought, undefined, "仅 thought 串线时保留正常气泡、丢掉错心声");
assert.equal(out.dropped.length, 3, "用户、陌生名字、自称呼三种串线都不落盘");
assert.equal(out.thoughtsDropped.length, 1);

console.log("group identity guard tests passed");
