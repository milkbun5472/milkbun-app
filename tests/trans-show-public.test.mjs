import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
const dir = new URL("../js/", import.meta.url);
const read = f => readFileSync(new URL(f, dir), "utf8");
test("公共翻译出口只有 transShow 一处，PTX/STX 只转调它", () => {
  const comp = read("components.js");
  assert.equal(comp.split("function transShow(v, zh) {").length - 1, 1);
  assert.match(read("phone-ui.js"), /transShow\(v\)/);
  assert.match(read("screens.js"), /transShow\(v\)/);
});
test("角色写的字那几十处都接上了", () => {
  const n = readdirSync(dir).filter(f => f.endsWith(".js")).reduce((s, f) => s + (read(f).match(/transShow\(/g) || []).length, 0);
  assert.ok(n >= 80, "只接了 " + n + " 处");
  assert.match(read("components.js"), /transShow\(m\.note\)/);
  assert.match(read("capsule.js"), /transShow\(cap\.reply\)/);
  assert.match(read("fanfic.js"), /transShow\(r\.content\)/);
});
