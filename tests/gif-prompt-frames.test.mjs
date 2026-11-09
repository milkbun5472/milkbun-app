import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const eng = readFileSync(new URL("../js/engine.js", import.meta.url), "utf8");
test("动图提示词：姿势照分镜、方画布也装下景别、说清几帧、手部两段缩成一句", () => {
  assert.match(eng, /姿势照分镜里 pose 那一条/);
  assert.match(eng, /不靠裁掉身体来填满画面/);
  assert.match(eng, /isCatsImageProvider\(a\.baseUrl\) \? 8 :/);
  assert.match(eng, /"【帧数】一共 " \+ gifN \+ " 帧/);
  assert.match(eng, /\(!\/gpt-image\|dall-\?e\/i\.test\(String\(a\.model \|\| ""\)\) \|\| \(opts && opts\.gif\)\)/);
});
