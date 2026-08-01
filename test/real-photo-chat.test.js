const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const components = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");

test("真照片只把 iv_ 引用写进聊天，像素住 IndexedDB", () => {
  assert.match(components, /resizeImageFile\(f, 1600, 0\.86\)/);
  assert.match(components, /imageRef = await imgToVault\(specialImg\)/);
  assert.match(components, /kind: "photo", imageRef/);
  assert.match(components, /src: resolveImg\(m\.imageRef\)/);
  assert.doesNotMatch(components, /saveJSON\([^\n]*specialImg/);
});

test("模型调用只临时展开最近两张真照片", () => {
  assert.match(app, /imageBudget\.length < 2/);
  assert.match(app, /await idbVaultGet\(ref\)/);
  assert.match(app, /await blobToDataUrl\(blob\)/);
  assert.match(app, /\{ imageDataUrls \}/);
  assert.match(app, /真实照片已作为视觉输入附在本条消息上/);
});

test("Anthropic、Gemini、OpenAI 三种视觉协议都有明确翻译", () => {
  assert.match(engine, /type: "image", source: \{ type: "base64", media_type:/);
  assert.match(engine, /inline_data: \{ mime_type:/);
  assert.match(engine, /type: "image_url", image_url:/);
  assert.match(engine, /const wireMessages = \(messages \|\| \[\]\)\.map/);
});

test("线上群聊也发送真图，并让本轮所有成员看到同一份视觉输入", () => {
  assert.match(components, /const \[groupPhotoImg, setGroupPhotoImg\]/);
  assert.match(components, /imageRef = await imgToVault\(groupPhotoImg\)/);
  assert.match(components, /src: resolveImg\(m\.imageRef\)/);
  assert.match(app, /const groupImageRefs = tail\.filter\(m => m\.kind === "photo" && m\.imageRef\)\.slice\(-2\)/);
  assert.match(app, /groupImageDataUrls\.length \? \{ imageDataUrls: groupImageDataUrls \}/);
  assert.match(app, /请所有在场成员直接看图后自然回应/);
});
