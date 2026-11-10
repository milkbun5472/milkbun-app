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
test("给自己画也能空着：照这张面具的人设挑（跟她那套九宫格同一份）", () => {
  assert.match(app, /isMe \? await pickMyEmoteNine\(who, whoId, api\) : await pickEmoteNine\(who\)/);
  assert.match(app, /const items = await pickMyEmoteNine\(me, key, api\);/);
  assert.doesNotMatch(app, /给自己画要写一句做什么动作/);
});
