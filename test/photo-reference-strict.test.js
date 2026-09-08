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
  assert.match(screens, /单次测试参考图/);
  assert.match(screens, /singleShot: true/);
  assert.match(screens, /attemptMs: 180000, budgetMs: 190000/);
  assert.match(screens, /参考图上传字段（每个站单独保存）/);
  assert.match(screens, /value: "bracket".*image\[\]/s);
  assert.match(screens, /最终是不是同一个人仍要看测试图确认/);
  assert.doesNotMatch(screens, /参考照已通过 edits 发送/);
});

test("单次参考图诊断不会自动换字段或提示词连射", () => {
  assert.match(engine, /if \(opts && opts\.singleShot\)/);
  assert.match(engine, /单次参考图探针失败/);
  assert.match(engine, /a\.refFieldMode === "bracket" \? "bracket"/);
});

test("聊天与小剧场共用经典锁脸管线，IF 人设不借用主线职业", () => {
  // 5930f605 / d90ec13a 已将实测锁脸的经典管线转正；不再测试无人调用的旧提示词。
  assert.match(app, /const prompt = buildPhotoPrompt\(char, sceneForPhoto, st, photoOpts\)/);
  assert.match(app, /const prompt = buildPhotoPrompt\(spk, gPhotoScene, st, gPhotoOpts\)/);
  assert.match(app, /generateSelfieImage\(prompt, refs\.length \? refs : null/);
  assert.match(app, /generateSelfieImage\(prompt, refs\.length \? refs : null, \{ minimalPrompt: gMinimal \}\)/);
  assert.doesNotMatch(theater, /buildReferencePhotoPrompt/);
  assert.match(theater, /buildPhotoPrompt/);
  assert.match(theater, /const ifVisualPersona = \[l\.world \|\| l\.setting, l\.charRole\]/);
  assert.match(theater, /const ifVisualPersona = \[line\.world \|\| line\.setting, line\.charRole\]/);
  assert.doesNotMatch(theater, /persona: String\(char\.persona \|\| ""\)\.slice\(0, 400\)/);
  assert.match(engine, /可改变姿势、表情、服装与背景，但不得重画、混合、平均化或替换任何参考人物的脸/);
  assert.match(engine, /若它与前面的人物参考图冲突,一律以人物参考图为准/);
});

test("照片类型在审核降级后仍保持：自拍是自拍，抓拍仍允许抓拍", () => {
  assert.match(engine, /【必须是本人自拍】本人手持手机、用前置摄像头在一臂距离内拍摄/);
  assert.match(engine, /一张由别人拍摄的自然生活照，不是自拍/);
  const start = engine.indexOf("function buildPhotoPrompt(");
  const end = engine.indexOf("\nfunction ", start + 1);
  assert.ok(start >= 0 && end > start);
  const prompt = engine.slice(start, end);
  assert.match(prompt, /【第一人称自拍】手臂伸出去、前置摄像头拍的自拍构图/);
  assert.match(prompt, /【这是别人帮 TA 拍的照片，不是自拍】第三人称旁观视角/);
});

test("人物与用户合照参考图使用高分辨率保存", () => {
  assert.match(screens, /imageMaxDim: 1024, imageQuality: 0\.94/);
  assert.match(components, /imageMaxDim: 1024, imageQuality: 0\.94/);
});
