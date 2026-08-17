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
  // v53.42 起改为「这条线自己的一套行头并锁死」：清空会让服装每张随机（袍子变女仆装），
  // 照抄主线又会让角色穿着现代便装进 if 线。
  assert.match(theater, /photoOutfit: String\(line\.charOutfit \|\| ""\)\.trim\(\)/, "if 线用自己的行头锁");
  assert.match(theater, /outfit: String\(line\.userOutfit \|\| ""\)\.trim\(\)/, "用户侧行头同样要锁");
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

// 合照锁脸的位置很关键(2026-08-18):sceneDesc 会被塞到 prompt 末尾并冠以「场景/正在做什么」，
// 身份指令挂在那里压不住前面一大段设定，必须前置；engine 侧另有参考图对应关系兜底。
test("合照必须说明哪张参考图是谁，且锁脸前置", () => {
  const eng = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
  assert.match(eng, /第一张参考图是「" \+ cName \+ "」本人，第二张参考图是「" \+ uName \+ "」本人/);
  assert.match(eng, /两张脸绝不许互换、混合或平均化/);
  const th = fs.readFileSync(path.join(root, "js/theater.js"), "utf8");
  assert.match(th, /faceLock \+ buildPhotoPrompt/, "小剧场的锁脸必须在整段 prompt 最前面");
  assert.doesNotMatch(th, /sceneDesc = faceLock/, "锁脸不能再埋回 sceneDesc 里");
});

// 图像接口的内容审核(2026-08-18):把当轮正文原样喂给出图接口，亲密戏会被判违规，
// 且两张真人参考照 + 亲密文本审得更严 —— 单张能过、合照过不了就是这么来的。
test("剧照 prompt 要过滤明确内容并声明画面尺度", () => {
  const th = fs.readFileSync(path.join(root, "js/theater.js"), "utf8");
  assert.match(th, /rows\.filter\(m => !explicit\(m\.content\)\)/, "明确内容不能进图像 prompt");
  assert.match(th, /offlineRegisterExplicitText/, "复用线下那套明确内容判定，别另造一套");
  assert.match(th, /【画面尺度】/, "要显式声明画面必须可公开展示");
  assert.match(th, /两人此刻正对着彼此/, "全被过滤掉时要有兜底描述，不能给空场景");
  assert.match(th, /内容政策\|content policy/, "审核类失败要能被识别并给出可操作提示");
});

// 同一场戏里衣服不许变（2026-08-18 Lisa：袍子突然变女仆装）。
// 合照分支原本明写「每张可以不一样」，那是为日常自拍写的，一场戏里是灾难。
test("给了行头就锁死，没给才每张随机", () => {
  const eng = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
  assert.match(eng, /me && String\(me\.outfit \|\| ""\)\.trim\(\)/, "用户侧要支持固定服装锁");
  assert.match(eng, /同一场戏里这身衣服始终不变/);
  assert.match(eng, /每张可以不一样/, "没给行头时仍保留日常合照的随机搭配");
});
