import { test } from "node:test"; import assert from "node:assert/strict"; import { readFileSync } from "node:fs";
const g = readFileSync(new URL("../js/gaze.js", import.meta.url), "utf8");
test("Ta 眼里：每轮更新、复看、建卡三枪都带同一句写法", () => {
  assert.match(g, /const VOICE = "【写法】/);
  assert.match(g, /不为填字段编事或随情绪翻转。"\n      \+ VOICE \+ NOT_PROFILE/);
  assert.match(g, /\+ "\\n" \+ VOICE \+ NOT_PROFILE/);
  assert.match(g, /私下写给自己的碎句。"\n      \+ VOICE \+ NOT_PROFILE/);
});
