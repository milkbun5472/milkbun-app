// 声音标签漏进文字气泡时屏幕上不露（她 2026-10-19 截图），她自己打的不动
const test = require("node:test"), assert = require("node:assert");
const comp = require("fs").readFileSync(require("path").join(__dirname, "../js/components.js"), "utf8");
test("TransText 画之前剥声音标签，只剥 TA 的", () => {
  const i = comp.indexOf("function TransText("), seg = comp.slice(i, i + 1500);
  assert.match(seg, /if \(!isU && typeof text === "string" && text\.indexOf\("\("\) >= 0 && typeof ttsHasSoundTag === "function" && ttsHasSoundTag\(text\)/);
});
