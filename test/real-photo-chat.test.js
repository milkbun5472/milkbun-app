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
  // v53.46 起降级按【参考图集合】分级：先丢连贯图，再丢用户的脸，最后才无参考照；
  // 每一级内部再试 image[] / 重复 image 两种字段名。
  assert.match(eng, /sets\.push\(\{ n: 1, how: "duo-single-ref" \}\)/, "要保留只锁一张脸这一级");
  assert.match(eng, /how: opts && opts\.contRef \? "no-continuity" : null/, "连贯图必须最先被丢");
  assert.match(eng, /use\.length > 1 \? \["bracket", "repeat"\] : \["first"\]/, "多图仍要试两种字段名");
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

// 上游审核(2026-08-18 第二例):报错明说 prompt 太长或措辞敏感。
// 主线人设 2400 字对 if 线既冗余又污染(整条线就是在替换他的身份)，
// 且过滤只挡情色不挡刀/血,场景一带凶器就整单被拒。
test("剧照 prompt 要控长、滤敏感，并有审核被拒后的简版兜底", () => {
  const th = fs.readFileSync(path.join(root, "js/theater.js"), "utf8");
  assert.match(th, /persona: String\(char\.persona \|\| ""\)\.slice\(0, 400\)/, "主线人设必须截短");
  assert.match(th, /const VIOLENT_RE = /, "过滤要覆盖暴力血腥，不只情色");
  assert.match(th, /slice\(-240\)/, "剧情摘要要控在短量级");
  assert.match(th, /generateSelfieImage\(minimalPrompt, refList\.slice\(0, duo \? 2 : 1\)\)/, "简版重试要连连贯图一起去掉");
  assert.match(th, /safety\|policy\|内容政策\|too long\|sensitive\|reject/, "只对审核类错误重试，别把真故障也重试一遍");
  assert.doesNotMatch(th, /minimalPrompt = [\s\S]{0,400}recent/, "简版 prompt 不许再带剧情文本");
});

// 视觉连贯层(2026-08-18，采纳 GPT 架构建议里真正缺的两条):
// ① 上一张生成图作为额外参考，治「十分钟前灰卫衣、现在黑衬衫」;
// ② 随身不摘的配饰单列一条，与换不换衣服无关；地点进实时状态并带时效。
test("连贯参考图与配饰锁", () => {
  const eng = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
  const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
  const th = fs.readFileSync(path.join(root, "js/theater.js"), "utf8");
  assert.match(eng, /【随身不摘的东西·每张都要有】/, "配饰要独立于服装锁");
  assert.match(eng, /opts\.contRefIndex/, "要告诉模型第几张是连贯参考图");
  assert.match(eng, /构图、姿势、机位、表情必须换新的/, "连贯图不能被复制成同一张");
  assert.match(eng, /以人物参考图为准/, "连贯图与身份冲突时身份优先");
  assert.match(eng, /rp\.indexOf\("img_"\) === 0/, "聊天自拍库的键也要能当参考图");
  assert.match(app, /kind === "selfie" && m\.imgKey && \(Date\.now\(\)/, "只取近期的自拍当锚");
  assert.match(app, /place: 3 \* 3600000/, "地点要有自己的时效");
  assert.match(th, /refList\.push\(prevPhoto\.img\)/, "小剧场也用上一张剧照做连贯");
});

// 提示不许乱扣帽子(2026-08-18 Lisa:「这都能算亲密戏吗」)——
// 过滤器抓到的是刻刀和喘息，属于暴力惊悚，却被一律说成「本拍是亲密戏」。
test("审核提示要分清情色与暴力，别乱扣帽子", () => {
  const th = fs.readFileSync(path.join(root, "js/theater.js"), "utf8");
  assert.match(th, /const isSex = /, "情色判定要独立");
  assert.match(th, /const isViolent = /, "暴力判定要独立");
  assert.match(th, /本拍有刀具或惊悚描写/, "命中暴力时要如实描述");
  assert.doesNotMatch(th, /spicy \? "\(本拍是亲密戏/, "旧的一律扣亲密戏必须已移除");
});
