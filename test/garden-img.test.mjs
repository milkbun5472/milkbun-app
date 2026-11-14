import { test } from "node:test"; import assert from "node:assert/strict"; import { readFileSync } from "node:fs";
const s = (readFileSync(new URL("../js/screens.js", import.meta.url), "utf8") + "\n" + readFileSync(new URL("../js/screens-ui.js", import.meta.url), "utf8"));
test("花房那张图从本机图库读出来显示，不拿键当地址", () => {
  assert.match(s, /function GardenImg\(\{ k, part, alt, style \}\)/);
  assert.match(s, /useIdbImgUrl\(isKey \? k : null\)/);
  assert.match(s, /g\.img \? h\(GardenImg, \{ k: g\.img/);
  assert.match(s, /k\.img \? h\(GardenImg, \{ k: k\.img/);
});
