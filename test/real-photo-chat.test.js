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
  assert.match(app, /await imgVaultFetchBlob\(ref\)/);
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

// 小剧场出图必须走 buildPhotoPrompt，否则角色的 photoStyle（写实/二次元/跟随参考图）
// 与身份锁、解剖锁全部丢失（Lisa 2026-08-18：银龙设了写实却一直出二次元厚涂）
test("小剧场剧照复用角色画风与身份锁", () => {
  const theater = fs.readFileSync(path.join(__dirname, "..", "js", "theater.js"), "utf8");
  assert.match(theater, /buildPhotoPrompt\(styledChar, sceneDesc, null, \{ kind: duo \? "duo" : "other"/);
  assert.match(theater, /photoOutfit: ""/, "if 线服装不能被角色的固定服装锁顶掉");
  assert.doesNotMatch(theater, /第三人称旁观视角的电影感画面\(绝不是自拍/, "旧的自拼 prompt 必须已经移除");
});

// 合照锁脸(2026-08-18):多图 edits 失败时曾直接退回无参考照的 generations，
// 于是合照必出两个陌生人，而且外面看起来像成功出图。降级必须逐级、且可见。
test("多图参考失败要逐级降级并标记，不许无声丢脸", () => {
  const eng = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
  assert.match(eng, /refMode === "first"/, "要有只锁一张脸的中间级");
  assert.match(eng, /refMode === "repeat"/, "要试重复 image 字段名");
  assert.match(eng, /attempt\(true, false, "bracket"\)[\s\S]{0,200}attempt\(true, false, "repeat"\)[\s\S]{0,200}attempt\(true, false, "first"\)/,
    "降级顺序必须是 image[] → 重复 image → 单张");
  assert.match(eng, /mark\(await attempt\(false\), "no-ref"\)/, "彻底无参考照要打标记");
  const th = fs.readFileSync(path.join(root, "js/theater.js"), "utf8");
  const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
  assert.match(th, /degraded === "duo-single-ref"/, "小剧场要把降级说出来");
  assert.match(app, /degraded === "duo-single-ref"/, "主聊天也要把降级说出来");
});
