import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const ui = readFileSync(new URL("../js/screens-ui.js", import.meta.url), "utf8");
test("开吧能勾世界书，存 lore；编辑时带回来", () => {
  assert.match(ui, /"data-wk": "foboardlore"/);
  assert.match(ui, /owner: owner, lore: lore, createdAt/);
  assert.match(ui, /owner: owner, lore: lore \}, skin/);
  assert.match(ui, /lore: Array\.isArray\(b\.lore\) \? b\.lore : \[\], editOf: tab/);
});
test("这个吧的设定（发帖、回帖都走 forumBoardVoice）带上挂的世界书", () => {
  assert.match(app, /\+ forumOwnerLine\(b\) \+ forumBoardLore\(b\);/);
  assert.match(app, /ids\.includes\(e\.id\)/);
});
