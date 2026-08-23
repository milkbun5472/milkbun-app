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
  assert.match(fn, /Math\.min\(Number\(msOverride \|\| 130000\), 300000\)/);
  assert.match(fn, /fd\.append\("input_fidelity", "high"\)/);
  assert.match(fn, /identityVerification = "not-provided"/);
  assert.match(fn, /refFilename/);
  assert.match(fn, /refMode === "first"/, "单图字段必须由 refMode 决定，不能被图片数量短路");
  assert.doesNotMatch(fn, /refBlobs\.length === 1 \|\| refMode === "first"/, "单图也必须能真正尝试 image[]");
  assert.match(fn, /alternateMode = preferredMode === "bracket" \? "first" : "bracket"/, "没收到图时要轮换 multipart 字段");
  assert.match(fn, /out\.referenceBytes = uploadedBytes/, "诊断要显示实际送出的参考图字节数");
});

test("设置页诚实区分参考请求成功与同脸验证", () => {
  assert.match(screens, /上传一张脸，测试高保真参考能力/);
  assert.match(screens, /测试高保真参考图/);
  assert.match(screens, /最终是不是同一个人仍要看测试图确认/);
  assert.doesNotMatch(screens, /参考照已通过 edits 发送/);
});

test("线上参考照使用短身份编辑提示，小剧场仍保留 IF 线重设计提示", () => {
  assert.match(engine, /function buildReferencePhotoPrompt/);
  assert.match(engine, /不是重新选角或重新设计人物/);
  assert.match(engine, /连续性图片中的脸混入、平均或替换/);
  assert.match(app, /generateSelfieImage\(prompt, refs\.length \? refs : null/);
  assert.match(app, /generateSelfieImage\(prompt, refs\.length \? refs : null, \{ minimalPrompt: gMinimal \}\)/);
  assert.doesNotMatch(theater, /buildReferencePhotoPrompt/);
  assert.match(theater, /buildPhotoPrompt/);
  assert.match(theater, /const ifVisualPersona = \[l\.world \|\| l\.setting, l\.charRole\]/);
  assert.match(theater, /const ifVisualPersona = \[line\.world \|\| line\.setting, line\.charRole\]/);
  assert.doesNotMatch(theater, /persona: String\(char\.persona \|\| ""\)\.slice\(0, 400\)/);
  assert.match(theater, /只改变服装、道具、场景与气质,绝不改变这张脸/);
});

test("照片类型在审核降级后仍保持：自拍是自拍，抓拍仍允许抓拍", () => {
  assert.match(engine, /【必须是本人自拍】本人手持手机、用前置摄像头在一臂距离内拍摄/);
  assert.match(engine, /一张由别人拍摄的自然生活照，不是自拍/);
  assert.match(engine, /【硬性构图·必须是本人自拍】本人手持手机、使用前置摄像头/);
  assert.match(engine, /构图为别人拍摄的自然生活照，不是自拍/);
});

test("人物与用户合照参考图使用高分辨率保存", () => {
  assert.match(screens, /imageMaxDim: 1024, imageQuality: 0\.94/);
  assert.match(components, /imageMaxDim: 1024, imageQuality: 0\.94/);
});
