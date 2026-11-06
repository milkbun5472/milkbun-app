import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
test("一张动图空着不写：用他挑的，一次九个存着接着用", () => {
  const i = app.indexOf("const makeEmoteGif = "), b = app.slice(i, i + 4000);
  assert.match(b, /if \(!t\) \{\s*const bank = loadJSON\("x_emoteGifIdeas"/);
  assert.match(b, /await pickEmoteNine\(who\)/);
  assert.match(b, /left\.slice\(1\)/);
});
