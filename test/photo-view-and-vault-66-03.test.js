// 她 2026-09-09：「你再看看现在已有的生图渠道生完图之后有没有上 vps，上次数据丢失
// 我图库的图全没了嘤。然后再放开聊天生图必须要人脸吧，就是有脸正常锁脸都是不一定
// 每张图都要脸有时候他们也可以发点别的图」
//
// 查生图那条链查出来的：写那一侧【每一处都进了上传队列】，没有漏的；
// 但说好的三层（本机 → 原生壳 → VPS）里，**原生壳那一层只有 selfies 有**，
// vault 一头两样都没有——而 vault 才是大头（头像/参考照/壁纸/聊天图/朋友圈图/
// 小剧场/跑团/同人封面）。典型的「一层写在两处，第二处没跟上」。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js"), eng = R("js/engine.js"), comp = R("js/components.js");

test("两个图仓的三层要一样厚：本机 → 原生壳 → VPS", () => {
  // 写：两边都要落原生壳 + 进上传队列
  assert.match(eng, /async function idbImgPut\(k, blob\) \{ await idbImgPutOnly\(k, blob\); await nativeMediaPut\("selfies", k, blob\); mediaQueueAdd\("selfies", k\);/);
  assert.match(eng, /async function idbVaultPut\(k, blob\) \{ await idbVaultPutOnly\(k, blob\); await nativeMediaPut\("vault", k, blob\); mediaQueueAdd\("vault", k\);/,
    "vault 写完没落原生壳——说好的三层它只有两层");
  // 读：本机没有时，两边都要先问原生壳、再问 VPS
  assert.match(eng, /async function idbVaultGet\(k\)[\s\S]{0,400}?nativeMediaGet\("vault", k\)[\s\S]{0,200}?remoteMediaGet\("vault", k\)/,
    "vault 读不到时没回原生壳要");
  // 删：三层都要删掉，不然下次读又从云里把它拉回来
  assert.match(eng, /async function idbVaultDel\(k\)[\s\S]{0,400}?nativeMediaDel\("vault", k\); await remoteMediaDel\("vault", k\);/);
});

test("生图那条链每一处存图都走了会上云的那两扇门", () => {
  // 全库存图只有这两扇门会进上传队列；谁绕过它们直接 PutOnly，那张图就永远上不了云。
  const only = [...eng.matchAll(/idb(Img|Vault)PutOnly\(/g)].length;
  // 定义各 1 处 + idbImgPut/idbVaultPut 各调 1 次 + 回源回填 4 处（Img 读 2、Vault 读 2）+ 原生壳补齐 1 处
  assert.ok(only >= 6, "PutOnly 调用点数变了，重新数一遍谁绕过了上云那扇门：" + only);
  // 出图之后落库的那几处，一处都不许直接 PutOnly
  for (const f of ["js/app.js", "js/theater.js", "js/trpg.js", "js/dwell.js", "js/impression.js", "js/phone.js"]) {
    assert.ok(!/idb(Img|Vault)PutOnly\(/.test(R(f)), f + " 里有地方绕过上云那扇门直接写本机");
  }
  // 出图之后确实落到了那两扇门上
  assert.match(app, /await idbImgPut\(key, out\.blob\);/);
  assert.match(R("js/theater.js"), /imgToVault\(durl\)/);
  assert.match(R("js/trpg.js"), /imgToVault\(durl\)/);
});

test("聊天发图不再必须有脸：多一种【画面里没有人】的", () => {
  // 门槛拆成两条：拍人要有脸可锁，拍照不用
  assert.match(app, /const canFace = \(char\.appearance \|\| char\.refPhoto\);/);
  assert.match(app, /const canSelfieBase = \(typeof imgApiReady === "function"\) && imgApiReady\(\);/,
    "拍东西还卡在「必须有脸」上");
  // 提示词里那几种 kind 按【有没有脸可锁】给，view 永远在
  assert.match(app, /const _kinds = \(canFace \? \["self", "other"\] : \[\]\)\.concat\(canDuo \? \["duo"\] : \[\]\)\.concat\(\["view", "part"\]\);/);
  assert.match(app, /\*\*view\*\*=【画面里没有人】的那种照片/);
  // ⚠️光在末尾多列一种是不够的（她 2026-09-09 截图：整段描述里根本没有人，
  //   kind 还是填了 self，脸被硬画进那张酸辣粉里）。得把【判据】说死：
  //   kind 只回答「这张图里有没有你」，不是「你想发什么」。
  assert.match(app, /kind 只回答一个问题：这张图里【有没有你】/);
  assert.match(app, /一律填 view，绝不许填 self/);
  assert.match(app, /填错了会硬把你的脸画进一张本来没有人的图里/);
  // 群聊那一头也要有同一条判据
  assert.match(app, /kind 只回答一个问题：这张图里【有没有那个成员本人】/);
  assert.match(app, /填错了会硬把 TA 的脸画进一张本来没有人的图里/);
  assert.match(app, /\["self", "other", "duo", "view", "part"\]\.includes/);
  // 执行时 view 绕开「有脸」那道闸，人像那几种照旧要
  assert.match(app, /&& \(photoKind === "view" \|\| photoKind === "part" \|\| char\.appearance \|\| char\.refPhoto\)\) \{/);
});

// 提示词那条路她试了两版都没治住：他在气泡里自己说「刚出炉的纯风景」，
// kind 照旧填 self，脸被硬画进去。所以这一道闸落在代码里。
test("说了是风景又没提到人，就按没有人的拍，不听它填的 kind", () => {
  const src = eng.slice(eng.indexOf("const PHOTO_PART_ZH"), eng.indexOf("\n// ---- 图上云"));
  assert.ok(src.length > 300, "那道闸没了");
  const nf = new Function(src + "\nreturn noFaceKindFor;")();
  const looksLikeNoOneScene = (sc, nm) => nf(sc, nm) === "view";

  // 她那两张截图里的原文，一张都不许再画出脸
  assert.equal(looksLikeNoOneScene("一张温暖色调的吉卜力风格插画：傍晚下着小雨的温尼伯街景，温馨的公寓客厅里，暖黄色台灯亮着，柔软的布艺沙发旁摆着一小盆开得正好的太阳花，茶几上放着两碗冒着热气的酸辣粉，整间屋子透着安静又柔软的暖意", "沈屿白"), true);
  assert.equal(looksLikeNoOneScene("吉卜力动画风格的雨天窗边风景，窗外是雾气蒙蒙的街道和细雨，窗台上放着一盆盛开的明亮太阳花，木质桌面上放着两杯冒着热气的咖啡，室内光线温暖柔和", "沈屿白"), true);

  // ⚠️另一头更要紧：真自拍绝不许被降成空景（脸没了她还得重拍，比现在这个 bug 更难受）
  assert.equal(looksLikeNoOneScene("我在咖啡店靠窗坐着，手里端着咖啡", "沈屿白"), false);
  assert.equal(looksLikeNoOneScene("窗边的风景很好，我坐在这儿发呆", "沈屿白"), false, "提了人就不算");
  assert.equal(looksLikeNoOneScene("沈屿白站在雨里的街景", "沈屿白"), false, "名字出现了就不算");
  assert.equal(looksLikeNoOneScene("刚拍的，笑得有点傻", "沈屿白"), false);
  assert.equal(looksLikeNoOneScene("楼下便利店，刚买完关东煮", "沈屿白"), false, "没正面说是景就不许动");
  assert.equal(looksLikeNoOneScene("", "沈屿白"), false);
  // 「其他」里那个他不是人
  assert.equal(looksLikeNoOneScene("窗外的街景，其他什么都没有", "沈屿白"), true);

  // 只往一个方向纠，而且单聊群聊共用同一处判据
  assert.match(app, /if \(photoKind !== "view" && photoKind !== "part" && typeof noFaceKindFor === "function"\)/);
  assert.match(app, /if \(gPhotoKind !== "view" && gPhotoKind !== "part" && typeof noFaceKindFor === "function"\)/);
  assert.equal((eng.match(/function noFaceKindFor/g) || []).length, 1);
});

test("拍手/背影：有身体没有脸，走它自己那条路", () => {
  // 她 2026-09-09 第三张截图：「实验室桌面上，放在机械键盘旁边的一只年轻男生的手，
  // 手指干净清瘦，指节清晰」——kind 又填了 self，脸又被画进去。
  // ⚠️这一类【现成两条路都不对】：buildPhotoPrompt 必给脸；
  //   buildScenePrompt 的无人铁律里明写 no hands, no body parts，会拒绝画那只手。
  const src = eng.slice(eng.indexOf("const PHOTO_PART_ZH"), eng.indexOf("\n// ---- 图上云"));
  const nf = new Function(src + "\nreturn noFaceKindFor;")();
  assert.equal(nf("实验室有些凌乱的桌面上，放在机械键盘旁边的一只年轻男生的手，手指干净清瘦，指节清晰，背景里还有跑着代码的电脑屏幕一角", "沈屿白"), "part");
  assert.equal(nf("他的背影，站在雨里", "沈屿白"), "part");
  assert.equal(nf("一只手搭在窗台上，指节清晰", "沈屿白"), "part");
  // ⚠️「手里端着」「手机」不算把局部当主体——那是自拍里顺带提到的
  assert.equal(nf("我在咖啡店靠窗坐着，手里端着咖啡", "沈屿白"), "");
  assert.equal(nf("靠在沙发上，手机举高一点拍的", "沈屿白"), "");
  // 提了脸/笑就不是局部照
  assert.equal(nf("手指绕着杯子，笑得有点傻", "沈屿白"), "");

  // 第三条路真的存在，而且【不出现脸】是它的题目、不是尾巴上一句补充
  const bp = eng.slice(eng.indexOf("function buildPartPrompt("), eng.indexOf("// ==== 自动头像"));
  assert.match(bp, /生成一张【不露脸的局部照片】：画面里【不出现任何人的脸和头】。/);
  assert.ok(bp.indexOf("生成一张【不露脸的局部照片】") < bp.indexOf("画风是"), "题目要排在最前面");
  assert.match(bp, /no face, no head, no facial features/, "中英双写钉一次，图像模型认英文否定词");
  assert.match(bp, /\*\*允许而且应该出现身体的那一小部分\*\*/, "不写这句它会连手一起拒绝画");
  // 走 buildScenePrompt 是错的：那份禁的正是手和身体
  assert.match(eng, /no people, no person, no human, no figure, no silhouette, no crowd, no hands, no body parts/);
  assert.match(app, /isPart \? buildPartPrompt\(char, photoScene\) :/);
  assert.match(app, /gIsPart \? buildPartPrompt\(spk, gPhotoScene\) :/);
});

test("view 走空景那条路，一张参考照都不喂", () => {
  assert.match(app, /const isView = photoKind === "view", isPart = photoKind === "part";/);
  assert.match(app, /const refs = noFace \? \[\] :/, "不露脸那两种还在喂参考照，它会想办法把脸画进去");
  assert.match(app, /const prompt = isView \? buildScenePrompt\(char, photoScene, \{ forText: false \}\)/);
  // ⚠️forText 必须显式关掉：空景那份默认是【要压字的背景板】（中下留空），
  //   聊天里发的图不是背景板
  assert.match(eng, /if \(opts\.forText !== false\) parts\.push\("【这是一张要压字的背景板】/);
  // 备用稿是「把这个人画对」的稿子，view 拿它重试等于把人画回来
  assert.match(app, /const minimalPrompt = noFace \? null :/);
  assert.match(app, /const contBlobKey = !noFace && refs\.length === 0 && prevShot/,
    "view 还会把上一张自拍当连贯参考塞进去");
});

test("群聊同一套，不许只做单聊那一半", () => {
  assert.match(app, /const gSelfieMembers = gPhotoOn \? members\.filter\(c => !photoCooldownState\(gchat, c\.id\)\.cooling\) : \[\];/);
  assert.match(app, /const gFaceMembers = gSelfieMembers\.filter\(c => c\.appearance \|\| c\.refPhoto\);/);
  assert.match(app, /const gDuoMembers = \(profile && profile\.refPhoto\) \? gFaceMembers\.filter/,
    "合照名单要从【有脸的】里挑，不是从全员里挑");
  assert.match(app, /\["self", "other", "duo", "group", "view", "part"\]\.includes/);
  assert.match(app, /&& \(gPhotoKind === "view" \|\| gPhotoKind === "part" \|\| spk\.appearance \|\| spk\.refPhoto\)\) \{/);
  assert.match(app, /const gIsView = gPhotoKind === "view", gIsPart = gPhotoKind === "part";/);
  assert.match(app, /const prompt = gIsView \? buildScenePrompt\(spk, gPhotoScene, \{ forText: false \}\)/);
});

test("「没有人的那种照片」叫什么只写在一处", () => {
  // 那条 duo→合照／other→别人拍的／else→自拍 的链子全库好几处，
  // else 分支会把 view 叫成「自拍」——每一处都得认得它，而那个词只许有一份
  assert.match(eng, /const PHOTO_VIEW_ZH = "随手拍";/);
  assert.equal((eng.match(/PHOTO_VIEW_ZH = /g) || []).length, 1);
  assert.match(eng, /const PHOTO_PART_ZH = "局部";/);
  assert.match(app, /m\.photoKind === "view" \? PHOTO_VIEW_ZH \+ "（画面里没有人，拍的是东西\/地方）"/, "单聊历史里它还叫自拍");
  assert.match(app, /m\.photoKind === "view" \? PHOTO_VIEW_ZH \+ "（画面里没有人）"/, "群聊历史里它还叫自拍");
  assert.match(app, /m\.photoKind === "part" \? PHOTO_PART_ZH \+ "（只拍了手\/背影这类局部，没露脸）"/);
  assert.match(comp, /m\.photoKind === "part" \? PHOTO_PART_ZH : m\.photoKind === "view" \? PHOTO_VIEW_ZH/, "拍失败时它还叫自拍");
  assert.match(comp, /m\.photoKind === "part" \? " · " \+ PHOTO_PART_ZH : m\.photoKind === "view" \? " · " \+ PHOTO_VIEW_ZH/, "群图注脚里它还叫自拍");
});
