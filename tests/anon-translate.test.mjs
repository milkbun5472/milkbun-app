import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../js/components.js", import.meta.url), "utf8");
test("匿名箱的回答走 TransText，外语也有译文", () => {
  assert.match(src, /h\(TransText, \{ text: r\.a, zhReady: r\.zh, ink: A\.sub \}\)/);
});
test("没答时留的那句反应也带译文", () => {
  assert.match(src, /transShow\("（" \+ r\.note \+ "）", r\.noteZh\)/);
});
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
test("开着双语的角色：匿名箱同一轮写中译，存进 zh / noteZh", () => {
  assert.match(app, /anonBans\(\) \+ \(anonBiOn\(char\) \? anonBiSpec : ""\)/);
  assert.match(app, /\.\.\.\(_z \? \{ zh: _z \} : \{\}\), \.\.\.\(_nz \? \{ noteZh: _nz \} : \{\}\)/);
  assert.match(app, /const anonBiOn = char => ProbeZh\.on\(/);
});
test("中译的说法、字段、收法只有 ProbeZh 一份：朋友圈和匿名箱都走它", () => {
  const eng = readFileSync(new URL("../js/engine.js", import.meta.url), "utf8");
  assert.match(eng, /const ProbeZh = \{/);
  assert.equal((app.match(/中译或null/g) || []).length, 0, "还有地方自己拼中译字段");
  assert.match(app, /const _momBi = ProbeZh\.on\(/);
});
