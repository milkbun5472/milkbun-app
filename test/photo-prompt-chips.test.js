// 发照片的描述能存起来下次点一下就用（群友 2026-10-31）
require("node:test")("单聊群聊发照片都摆存过的描述；存在 x_photoPrompts，最多 40", () => {
  const assert = require("node:assert/strict");
  const c = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
  assert.match(c, /function PhotoPromptChips\(\{ value, onPick \}\)/);
  assert.match(c, /put\(\[cur\]\.concat\(list\)\.slice\(0, 40\)\)/);
  assert.match(c, /saveJSON\("x_photoPrompts", l\)/);
  assert.match(c, /photoSendMode !== "real" && h\(PhotoPromptChips, \{ value: specialText, onPick: setSpecialText \}\)/);
  assert.match(c, /groupPhotoMode !== "real" && h\(PhotoPromptChips, \{ value: photoText, onPick: setPhotoText \}\)/);
});
