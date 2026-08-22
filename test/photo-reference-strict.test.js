const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

test("参考照失败不会退回无参考生成陌生人", () => {
  const fn = engine.slice(engine.indexOf("async function generateSelfieImage"), engine.indexOf("// ============================================================\n// MiniMax"));
  assert.match(fn, /已停止而没有生成陌生人/);
  assert.ok(fn.indexOf("if (refBlobs.length) {") < fn.indexOf("if (refBlobs.length > 1) {"), "strict identity gate must run before the legacy compatibility ladder");
  assert.match(fn, /out\.referenceCount = refBlobs\.length/);
  assert.match(fn, /95000/);
});

test("设置页可以单独诊断参考照锁脸", () => {
  assert.match(screens, /上传一张脸，真正测试锁脸接口/);
  assert.match(screens, /测试参考照锁脸/);
  assert.match(screens, /这不代表锁脸可用/);
});
