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

// ⚠️她 2026-09-09 连着四张截图，前三版全没生效。查到最后不是判据的问题：
//    v66.03~66.10 我把 view/part/none/face 全写进了 photoHint，
//    而 photoHint 只出现在 _normalTaskFull 里——旁边就写着「暂留作 A/B 回滚基线，
//    但不再发送给普通角色」。三版提示词一个字都没发出去。
//    跟 v58.98 photoSeen 栽的是同一个坑，那条测试就叫
//    「挂在真正在跑的那条协议上，不是那条死路」。这一条替发照片也钉一次。
test("发照片那一格挂在真正在跑的那条协议上，不是那条死路", () => {
  // 真正在跑的是 Protocol v2：openCaps + capState
  assert.match(app, /openCaps\.push\("photo"\);/);
  assert.match(app, /photoCapLine\(uName, \{ face: canFace, duo: canDuo \}\) \+ "\\n" \+ PHOTO_NO_EXCUSE\.trim\(\)/,
    "字段说明没进 capState——那模型手上永远只有 self/other/duo");
  // ⚠️那条死路 v66.12 已经整个删掉了（她：「每次都这样耽误事」），不许再长回来
  assert.ok(!/const _normalTaskFull = /.test(app), "那条不再发送的 A/B 基线又回来了");
  assert.ok(!/const photoHint = /.test(app), "photoHint 又回来了——它当初就只喂那条死路");
  assert.equal((app.match(/photoCapLine\(/g) || []).length, 2,
    "字段说明该只有一份：photoCapLine 定义在 engine，单聊 capState 和群 hint 各引一次");
  assert.ok(!/kind＝画面里是谁/.test(app), "app.js 里又手抄了一份字段说明");
  assert.match(eng, /function photoCapLine\(uName, o\)/);
  assert.match(eng, /face＝这张图里看不看得见你的脸/);
  assert.match(eng, /别拿 kind 回答脸的事/);
  // 群那一头也是同一份（只换人称）
  assert.match(app, /photoCapLine\(gUName, \{ face: !!gFaceMembers\.length, duo: !!gDuoMembers\.length, group: gGroupShotOk \}\)/);
});

test("聊天发图不再必须有脸：多一种【画面里没有人】的", () => {
  // 门槛拆成两条：拍人要有脸可锁，拍照不用
  assert.match(app, /const canFace = \(char\.appearance \|\| char\.refPhoto\);/);
  assert.match(app, /const canSelfieBase = \(typeof imgApiReady === "function"\) && imgApiReady\(\);/,
    "拍东西还卡在「必须有脸」上");
  // 提示词里那几种 kind 按【有没有脸可锁】给，view 永远在
  assert.match(eng, /none（画面里一个人都没有：窗外、桌上的东西、刚做好的菜）/);
  // ⚠️她 2026-09-09 连着三张截图都是同一个错，最后她问对了：
  //   「不能把原来的 prompt 改成除非明确说了是有人的才用 self 吗」——
  //   kind 问的是【我在发什么】（一只手的照片说成 self 从他的角度不算错），
  //   拍板的那一格得换成一个关于【画面】的是非题。
  assert.match(eng, /kind 填 none 时一律 false/);
  assert.match(app, /\["self", "other", "duo", "view", "part", "none"\]\.includes/);
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
  // 文字那道闸【降级成安全网】：只有他没答 face 时才用
  assert.match(app, /else if \(_faceSaid === undefined \|\| _faceSaid === null \|\| _faceSaid === ""\) \{/);
  assert.match(app, /else if \(_gFaceSaid === undefined \|\| _gFaceSaid === null \|\| _gFaceSaid === ""\) \{/);
  assert.equal((eng.match(/function noFaceKindFor/g) || []).length, 1);
  // face:false 直接拍板，不再看文字
  assert.match(app, /if \(_faceSaid === false \|\| String\(_faceSaid\)\.toLowerCase\(\) === "false"\) photoKind = "part";/);
  assert.match(app, /if \(_gFaceSaid === false \|\| String\(_gFaceSaid\)\.toLowerCase\(\) === "false"\) gPhotoKind = "part";/);
  // kind:none 就是「一个人都没有」
  assert.match(app, /if \(photoKind === "none"\) photoKind = "view";/);
  assert.match(app, /if \(gPhotoKind === "none"\) gPhotoKind = "view";/);
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
  // ⚠️第四张截图漏在这儿：上一版只有 手指/指节，「右手」不在名单里
  assert.equal(nf("实验室桌面上，一只修长干净的男生右手随意搭在黑色机械键盘上，旁边散落着实验用的数据线和门禁卡，背景是亮着代码的电脑屏幕", "沈屿白"), "part");
  assert.equal(nf("胳膊搭在栏杆上", "沈屿白"), "part");
  // 裸的「手」不许收：手机/手里/手边/随手全会中招
  assert.equal(nf("随手拍的，笑得有点傻", "沈屿白"), "");
  assert.ok(!/\|手\||\/手\|/.test(eng.match(/const PART_WORDS = [^;]+;/)[0]), "PART_WORDS 里混进了裸的「手」");
  // ⚠️「手里端着」「手机」不算把局部当主体——那是自拍里顺带提到的
  assert.equal(nf("我在咖啡店靠窗坐着，手里端着咖啡", "沈屿白"), "");
  assert.equal(nf("靠在沙发上，手机举高一点拍的", "沈屿白"), "");
  // 提了脸/笑就不是局部照
  assert.equal(nf("手指绕着杯子，笑得有点傻", "沈屿白"), "");

  // 第三条路真的存在，而且【不出现脸】是它的题目、不是尾巴上一句补充
  const bp = eng.slice(eng.indexOf("function buildScenePrompt("), eng.indexOf("// ==== 自动头像"));
  assert.match(bp, /生成一张【不露脸的局部照片】：画面里【不出现任何人的脸和头】。/);
  assert.ok(bp.indexOf("生成一张【不露脸的局部照片】") < bp.indexOf("画风是"), "题目要排在最前面");
  assert.match(bp, /no face, no head, no facial features/, "中英双写钉一次，图像模型认英文否定词");
  assert.match(bp, /\*\*允许而且应该出现身体的那一小部分\*\*/, "不写这句它会连手一起拒绝画");
  // 走 buildScenePrompt 是错的：那份禁的正是手和身体
  assert.match(eng, /no people, no person, no human, no figure, no silhouette, no crowd, no hands, no body parts/);
  assert.match(app, /isPart \? buildScenePrompt\(char, photoScene, \{ body: true \}\) :/);
  assert.match(app, /gIsPart \? buildScenePrompt\(spk, gPhotoScene, \{ body: true \}\) :/);
  // ⚠️她 2026-09-09：「一定要新出一个搞一个新 prompt 吗」——不该。两档合成一份，
  //   画风和世界观只留一处（原来它俩各抄了一遍）。
  assert.ok(!/buildPartPrompt/.test(eng + app), "那第二份 builder 还在");
  assert.equal((eng.match(/画风是【二次元动画/g) || []).length, 1, "画风那段又被抄成两份了");
  assert.equal((eng.match(/这个世界长什么样·必须对上/g) || []).length, 1, "世界观那段又被抄成两份了");
});

test("view 走空景那条路，一张参考照都不喂", () => {
  assert.match(app, /const isView = photoKind === "view", isPart = photoKind === "part";/);
  assert.match(app, /const refs = noFace \? \[\] :/, "不露脸那两种还在喂参考照，它会想办法把脸画进去");
  assert.match(app, /const prompt = isView \? buildScenePrompt\(char, photoScene, \{ forText: false \}\)/);
  // ⚠️forText 必须显式关掉：空景那份默认是【要压字的背景板】（中下留空），
  //   聊天里发的图不是背景板
  assert.match(eng, /if \(!body && opts\.forText !== false\) parts\.push\("【这是一张要压字的背景板】/,
    "局部照被当成要压字的背景板了：那是空景那一档才有的事");
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
  assert.match(app, /\["self", "other", "duo", "group", "view", "part", "none"\]\.includes/);
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

// 她 2026-09-09：「Listen hint Invite hint 是啥都是一起听的吗？那加回来吧」——是，
// 一件事的两半。它俩跟着那条不再发送的 A/B 基线一起假活着，v66.13 接回真正在跑的
// capState。⚠️邀请那半边尤其要命：原来 openCaps 里只有一个名字 listenInvite，
// 连 {song, say} 长什么样都没发过——他得猜这个对象的形状。
test("一起听那两半都接回真正在跑的那条协议", () => {
  const i = app.indexOf("      if (isListenPartner) {");
  assert.ok(i > 0, "找不到一起听那道岔口");
  const seg = app.slice(i, i + 700);
  assert.match(seg, /openCaps\.push\("songSwitch"\);\s*\n\s*capState\.push\(listenHint\.trim\(\)\);/, "正在一起听那半边没接");
  assert.match(seg, /openCaps\.push\("listenInvite"\);\s*\n\s*capState\.push\(inviteHint\.trim\(\)\);/, "邀请那半边没接");
  // 字段形状真的在里头（这正是原来漏掉的东西）
  assert.match(app, /listenInvite 填 \{\\"song\\":/, "邀请那一格的字段形状还是没发出去");
  assert.match(app, /把 songSwitch 填成要放的那首歌名/, "切歌怎么用还是没说");
  // 歌单别推两份：listenHint 自己带着
  assert.ok(!/capState\.push\("songSwitch 可选歌曲/.test(app), "歌单又被单独推了一份");
});
