const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("聊天发真照片一次能挑好几张，单聊群聊共用一格、连发几条（群友 2026-10-26）", () => {
  assert.match(comp, /const CHAT_PHOTO_MAX = 6;/);
  assert.match(comp, /function ChatPhotoPick\(\{ imgs, setImgs, toast, t \}\)/);
  assert.match(comp, /type: "file", accept: "image\/\*", multiple: true, style: \{ display: "none" \}, onChange: pick \}/);
  assert.equal((comp.match(/h\(ChatPhotoPick, \{/g) || []).length, 2);
  assert.match(comp, /const _all = specialImgs\.slice\(0, CHAT_PHOTO_MAX\);/);
  assert.match(comp, /const _gAll = groupPhotoImgs\.slice\(0, CHAT_PHOTO_MAX\);/);
  assert.match(fs.readFileSync(__dirname + "/../js/theme-studio.js", "utf8"), /"chatphotopick"/);
});
