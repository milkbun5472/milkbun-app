// 群友 2026-11-25：邮票卡面每次「没锁住脸」、等很久，聊天里拍照又快又能锁——卡面写死了大竖图尺寸
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("邮票卡面跟聊天拍照同一套参数，卡面仍是竖图", () => {
  const i = ap.indexOf("const stampDraw = async"), seg = ap.slice(i, ap.indexOf("\n  };", i));
  assert.match(seg, /size: "1024x1536"/);   // 卡面要竖图（她 2026-11-25）
  assert.match(seg, /minimalPrompt: typeof buildMinimalPhotoPrompt/);
});
