// 文字气泡点读不念译文（群友 2026-10-31）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const eng = fs.readFileSync(require.resolve("../js/engine.js"), "utf8");
const cmp = fs.readFileSync(require.resolve("../js/components.js"), "utf8");
const ctx = { console, window: { addEventListener() {} }, navigator: { userAgent: "" } };
vm.createContext(ctx);
try { vm.runInContext(eng, ctx); } catch (e) {}
const say = vm.runInContext("sayTextOf", ctx);
test("几种带译文的写法都只念原文，纯中文不动", () => {
  assert.equal(say({ content: "Good morning.（早上好。）" }), "Good morning.");
  assert.equal(say({ content: "I miss you | 我想你" }), "I miss you");
  assert.equal(say({ content: "Hello\n你好" }), "Hello");
  assert.equal(say({ content: "今天好累（叹气）" }), "今天好累（叹气）");
  assert.equal(say({ content: "Hi（笑）", zh: "嗨" }), "Hi（笑）");
});
test("单聊、群聊点读都走 sayTextOf", () => {
  assert.equal((cmp.match(/tp\.toggle\("say" \+ i, sayTextOf\(m\)/g) || []).length, 3);
});
test("念出声的字都过 ttsMarkForSynth：语音便签、通话这些也不念译文，纯中文原样", () => {
  const syn = vm.runInContext("ttsMarkForSynth", ctx);
  assert.equal(syn("I'm still awake. | 我还没睡。"), "I'm still awake.");
  assert.equal(syn("Good night.（晚安。）"), "Good night.");
  assert.equal(syn("今天好累（叹气）"), "今天好累（叹气）");
});
