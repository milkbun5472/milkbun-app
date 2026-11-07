import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const eng = readFileSync(new URL("../js/engine.js", import.meta.url), "utf8");
test("单聊关系网：别人的名字后面带存好的性别", () => {
  assert.match(eng, /" 眼中的 " \+ o\.name \+ gN \+ "："/);
});
