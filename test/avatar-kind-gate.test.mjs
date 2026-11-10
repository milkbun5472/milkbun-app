import { test } from "node:test"; import assert from "node:assert/strict"; import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
test("换头像先报这张是什么：只有人像、合照、宠物、画能换；她明说要换的不拦", () => {
  assert.match(app, /const AVATAR_KINDS = \["人像", "合照", "宠物", "画"\];/);
  assert.match(app, /if \(!asked && AVATAR_KINDS\.indexOf\(String\(seen\.kind \|\| ""\)\.trim\(\)\) < 0\) return;/);
  assert.match(app, /const applyPhotoSeen = \(charId, msg, seen, canAvatar, patchNote, asked\) =>/);
  assert.match(app, /seenNote: note \} : m\)\), _askAvatar\);/);
  assert.match(app, /\\"kind\\":\\"\\",\\"avatar\\":false/);
});
