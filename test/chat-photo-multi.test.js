const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("聊天发真照片一次能挑好几张，单聊群聊共用一格、连发几条（群友 2026-10-26）", () => {
  assert.match(comp, /const CHAT_PHOTO_MAX = 6;/);
  assert.match(comp, /function ChatPhotoPick\(\{ imgs, setImgs, toast, t \}\)/);
  assert.match(comp, /type: "file", accept: "image\/\*", multiple: !one, style: \{ display: "none" \}, onChange: pick \}/);
  assert.equal((comp.match(/h\(ChatPhotoPick, \{/g) || []).length, 2);
  assert.match(comp, /const _all = specialImgs\.slice\(0, CHAT_PHOTO_MAX\);/);
  assert.match(comp, /const _gAll = groupPhotoImgs\.slice\(0, CHAT_PHOTO_MAX\);/);
  assert.match(fs.readFileSync(__dirname + "/../js/theme-studio.js", "utf8"), /"chatphotopick"/);
});

// 群友 2026-10-29：「弹了图片选了但是没有东西落下来」
test("选图器没交回图：这台手机改成一次一张；缩图卡住有超时、小图原样读", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js/components.js"), "utf8");
  require("assert").match(src, /multiple: !one/);
  require("assert").match(src, /localStorage\.setItem\(CHAT_PHOTO_ONE_KEY, "1"\)/);
  require("assert").match(src, /Promise\.race\(\[resizeImageFile\(f, 1600, 0\.86\), timeout\]\)/);
  require("assert").match(src, /return await readRawImage\(f\)/);
});
