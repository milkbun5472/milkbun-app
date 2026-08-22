const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const components = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const theater = fs.readFileSync(path.join(root, "js/theater.js"), "utf8");

test("参考照失败不会退回无参考生成陌生人", () => {
  const fn = engine.slice(engine.indexOf("async function generateSelfieImage"), engine.indexOf("// ============================================================\n// MiniMax"));
  assert.match(fn, /已停止而没有生成陌生人/);
  assert.ok(fn.indexOf("if (refBlobs.length) {") < fn.indexOf("if (refBlobs.length > 1) {"), "strict identity gate must run before the legacy compatibility ladder");
  assert.match(fn, /out\.referenceCount = refBlobs\.length/);
  assert.match(fn, /95000/);
  assert.match(fn, /fd\.append\("input_fidelity", "high"\)/);
  assert.match(fn, /identityVerification = "not-provided"/);
  assert.match(fn, /refFilename/);
});

test("设置页诚实区分参考请求成功与同脸验证", () => {
  assert.match(screens, /上传一张脸，测试高保真参考能力/);
  assert.match(screens, /测试高保真参考图/);
  assert.match(screens, /接口没有返回人脸相似度证明/);
  assert.doesNotMatch(screens, /参考照已通过 edits 发送/);
});

test("线上参考照使用短身份编辑提示，小剧场仍保留 IF 线重设计提示", () => {
  assert.match(engine, /function buildReferencePhotoPrompt/);
  assert.match(engine, /不是重新选角或重新设计人物/);
  assert.match(engine, /连续性图片中的脸混入、平均或替换/);
  assert.match(app, /refs\.length \? buildReferencePhotoPrompt/);
  assert.match(app, /refs\.length \? buildReferencePhotoPrompt\(spk/);
  assert.doesNotMatch(theater, /buildReferencePhotoPrompt/);
  assert.match(theater, /buildPhotoPrompt/);
  assert.match(theater, /const ifVisualPersona = \[l\.world \|\| l\.setting, l\.charRole\]/);
  assert.match(theater, /const ifVisualPersona = \[line\.world \|\| line\.setting, line\.charRole\]/);
  assert.doesNotMatch(theater, /persona: String\(char\.persona \|\| ""\)\.slice\(0, 400\)/);
  assert.match(theater, /只改变服装、道具、场景与气质,绝不改变这张脸/);
});

test("人物与用户合照参考图使用高分辨率保存", () => {
  assert.match(screens, /imageMaxDim: 1024, imageQuality: 0\.94/);
  assert.match(components, /imageMaxDim: 1024, imageQuality: 0\.94/);
});
