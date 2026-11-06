import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../js/components.js", import.meta.url), "utf8");
const m = src.match(/const pureParenAct = m => ([^\n]+);/);
const pureParenAct = eval("(m => " + m[1] + ")");
test("整条括号动作才走灰字", () => {
  assert.equal(pureParenAct({ role: "user", parenAct: true, content: "（把脸埋进枕头里）" }), true);
  assert.equal(pureParenAct({ role: "user", parenAct: true, content: "好啊（笑）" }), false);
  assert.equal(pureParenAct({ role: "user", content: "（笑）" }), false);
  assert.equal(pureParenAct({ role: "user", parenAct: true, content: "（a）（b）" }), false);
});
test("单聊、群聊两处都接上", () => {
  assert.equal(src.split("if (pureParenAct(m)) return h(NarrLine").length - 1, 2);
});
test("跟 TA 的动描同一个样子：居中（who 不是 me）、没有叉、去掉外面那对括号", () => {
  assert.equal(src.split('m: { ...m, who: "mine" }').length - 1, 2);
  assert.equal(src.split('onDelete: null, text: String(m.content || "").trim().replace(').length - 1, 2);
});
