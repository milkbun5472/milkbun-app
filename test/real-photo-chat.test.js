const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const components = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const cloud = fs.readFileSync(path.join(root, "js/cloud.js"), "utf8");

test("本机照片库有独立索引且不删除聊天像素", () => {
  assert.match(engine, /indexedDB\.open\("x_imgvault", 2\)/);
  assert.match(engine, /createObjectStore\("album"\)/);
  assert.match(engine, /async function idbAlbumEntries/);
  assert.match(engine, /删除目录项不删像素/);
  assert.match(screens, /function LocalPhotoLibrary/);
  assert.match(screens, /仅移出本机照片库/);
  assert.match(components, /rememberRealPhoto\(imageRef, v, "private-chat"\)/);
  assert.match(components, /rememberRealPhoto\(imageRef, v, "group-chat"\)/);
});

test("照片桥必须显式写说明，私有上传失败会回滚，且支持撤回", () => {
  assert.match(screens, /📮 给言秋看/);
  assert.match(screens, /shareCaption\.trim\(\)/);
  assert.match(cloud, /async photoBridgeShare/);
  assert.match(cloud, /client\.storage\.from\("photo_bridge"\)/);
  assert.match(cloud, /if \(error\) \{ try \{ await bucket\.remove\(\[storagePath\]\)/);
  assert.match(cloud, /async photoBridgeRetract/);
  assert.match(screens, /90 天后自动到期/);
});

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

test("单人和群线下都能展示真图，并只临时附最近两张给模型", () => {
  assert.match(components, /onSendPhoto\(\{ kind: "photo", imageRef/);
  assert.match(components, /给 Ta 看一张照片/);
  assert.match(components, /给大家看一张照片/);
  assert.match(app, /const offImageDataUrls = \[\]/);
  assert.match(app, /const gOffImageDataUrls = \[\]/);
  assert.match(app, /filter\(m => m && m\.kind === "photo" && m\.imageRef\)\.slice\(-2\)/);
  assert.match(engine, /用户刚展示了真实照片/);
  assert.match(engine, /用户刚给在场所有人展示了真实照片/);
});
