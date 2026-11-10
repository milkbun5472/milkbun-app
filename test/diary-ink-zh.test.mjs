import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const ui = readFileSync(new URL("../js/screens-ui.js", import.meta.url), "utf8");
test("日记划掉的、涂黑的段落也带中文：有 zh 摆出来，没有就挂「译」", () => {
  assert.match(ui, /h\(InkStruck, \{ text: p\.zh \? p\.text : STX\(p\.text\)/);
  assert.match(ui, /h\(InkSecret, \{ text: p\.zh \? p\.text : STX\(p\.text\), zh: p\.zh/);
  assert.match(ui, /open && zh \? h\("span", \{ "data-wk": "diaryzh"/);
});
