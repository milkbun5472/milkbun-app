const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const ph = fs.readFileSync(path.join(root, "js", "phone.js"), "utf8");
const ap = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const view = ph.slice(ph.indexOf("function AlbumView("), ph.indexOf("function ReadingView("));
const { phonePhotoSig } = require(path.join(root, "js", "phone.js"));

// 她 2026-09-01：「查手机相册放进我的收藏后可以给他一个按钮生成真图吧宝宝，
// 就按图上的 prompt 生成」。
test("画图按钮只长在【我收着的】那几张上", () => {
  const i = view.indexOf("onDrawPhoto ? h(\"button\"");
  assert.ok(i > 0, "详情页没有画图按钮");
  // 前面必须先问一句「这张收着了吗」
  assert.match(view.slice(Math.max(0, i - 60), i), /isSaved\(photo\) &&/,
    "没收着的照片也给了按钮——二十五张各画一次等于劝人烧额度");
});

test("按钮说清楚这一下要花一次画图", () => {
  assert.match(view, /正在画…（这一步会调一次画图）/, "转圈时没说这一步在调模型");
  assert.match(view, /"把这张画出来"/, "没有第一次画的说法");
  assert.match(view, /"再画一张"/, "画过之后按钮没换说法");
});

// 详情页和缩略图翻的都是本轮 items（每次刷新整份重生成），画好的图挂在
// x_phoneKeep 那条记录上——两边都得看一眼，否则画完当场还是程序化缩略图。
test("真图两处都认：本轮这一张身上没有，就去收藏那条记录上找", () => {
  assert.match(view, /const keptOf = p => saved\.find\(s => sig\(s\) === sig\(p\)\) \|\| null;/,
    "没有按指纹找收藏里那条记录的路");
  assert.match(view, /const drawnRef = p => \{ const k = keptOf\(p\); return p\.imageRef \|\| \(k && k\.imageRef\) \|\| ""; \};/,
    "imageRef 只看了本轮这一张");
  assert.match(view, /const drawnUrl = p => \{ const k = keptOf\(p\); return p\.imageUrl \|\| p\.imgUrl \|\| \(k && k\.imageUrl\) \|\| ""; \};/,
    "imageUrl 只看了本轮这一张");
  const art = view.slice(view.indexOf("const art = (it, radius, bare)"), view.indexOf("const tile = "));
  assert.match(art, /drawnUrl\(it\)/, "缩略图不认收藏里那张真图");
  assert.match(art, /drawnRef\(it\)/, "缩略图不认收藏里那个 imageRef");
});

test("画完当场就能看见：keep 是自己的 state，写完得再读一遍", () => {
  assert.match(view, /Promise\.resolve\(onDrawPhoto\(p, sig\(p\)\)\)\.then\(\(\) => setKeep\(loadJSON\("x_phoneKeep", \{\}\)\)\)/,
    "画完没有重读 x_phoneKeep，按钮和图都不会变");
});

// 指纹必须是模块级的一份：App 那边要按同一个指纹把图挂回那条记录上。
test("照片指纹一处算，两处用", () => {
  assert.ok(ph.indexOf("function phonePhotoSig(") > 0, "指纹没有提成模块级函数");
  assert.match(view, /const sig = phonePhotoSig;/, "AlbumView 又自己写了一份指纹");
  assert.match(ph, /photoSig: phonePhotoSig/, "PhoneKit 没把指纹发出去，App 那边只能再抄一份");
  assert.equal(phonePhotoSig({ id: "p1", caption: "雨" }), "p1", "有 id 时不该看内容");
  assert.equal(phonePhotoSig({ caption: "窗外那场雨", date: "2026-08-30", desc: "没关的窗" }),
    "窗外那场雨|2026-08-30|没关的窗");
  // 排序变了不该被当成另一张
  assert.equal(phonePhotoSig({ caption: "a", date: "d", desc: "x" }), phonePhotoSig({ caption: "a", time: "d", desc: "x" }));
});

const draw = ap.slice(ap.indexOf("const drawKeptPhoto = async"), ap.indexOf("const askCharAboutItem ="));
test("走空景那条路，不走【画一个人】那份说明书", () => {
  assert.ok(draw.length > 200, "app.js 里没有 drawKeptPhoto");
  assert.match(draw, /buildScenePrompt\(char, scene, \{ forText: false \}\)/,
    "没走 buildScenePrompt——buildPhotoPrompt 是画人的说明书，外挂一句「不要有人」压不住它");
  assert.ok(draw.indexOf("buildPhotoPrompt") < 0, "又拿画人那份说明书去画景了");
  assert.match(draw, /\[photo\.caption, photo\.desc\]/, "没按这张照片自己写的东西画");
  assert.ok(draw.indexOf("photo.thought") < 0, "把他对这张照片的想法也塞进画图指令了");
});

test("画好的图挂回收藏，不写进 phones", () => {
  assert.ok(draw.indexOf("savePhoneApp") < 0 && draw.indexOf("setPhones") < 0,
    "写进了 phones——查手机每次刷新整份重生成，下一次刷新连图带记录一起没了");
  assert.match(draw, /saveJSON\("x_phoneKeep"/, "没写回 x_phoneKeep");
  assert.match(draw, /window\.PhoneKit && window\.PhoneKit\.photoSig/, "app 这边又自己算了一套指纹");
  // 找不到那条记录时要补进去，否则图存了却没人指向它
  assert.match(draw, /prev\s*\?[\s\S]*?:\s*\[\{ \.\.\.photo, imageRef: ref, imageUrl: url, _at: Date\.now\(\) \}, \.\.\.list\]/,
    "收藏里找不到这张时没有兜底，图会白画一次");
});

test("重画沿用同一个键，不在保险箱里攒垃圾", () => {
  assert.match(draw, /String\(prev\.imageRef \|\| ""\)\.indexOf\("img_pk_"\) === 0/,
    "重画时没沿用旧键，旧那张 blob 谁也删不掉");
  assert.match(draw, /await idbImgPut\(ref, out\.blob\)/, "没把图存进保险箱");
});

test("正画着的那一张才转圈，同屏别的按钮不跟着转", () => {
  assert.match(ph, /drawing === sig\(photo\)/, "drawing 被当成 true\/false 用了");
  assert.match(ph, /onDrawPhoto: \(photo, key\) => onDrawPhoto && onDrawPhoto\(char, photo, key\)/,
    "liveCtx 没把 onDrawPhoto 接下去");
  assert.match(ph, /drawing: drawingPhoto \|\| ""/, "liveCtx 没把正在画的那张接下去");
  assert.match(ph, /onDrawPhoto: ctx\.onDrawPhoto, drawing: ctx\.drawing/, "album 那一行没往下发");
  assert.match(ap, /onDrawPhoto: drawKeptPhoto,\n\s*drawingPhoto: gen\.phoneShot \|\| "",/,
    "PhoneCarry 没拿到这两个 prop");
});

test("没配图像 API 时先说一声，不白转一圈", () => {
  assert.match(draw, /imgApiReady\(\)\)\) \{ toast\("先去 设置·图像API 配一下"\); return false; \}/,
    "没配图像 API 就直接去调了");
  assert.match(draw, /if \(gen\.phoneShot\) return false;/, "同时能点起两张，第二张会把第一张的 busy 覆盖掉");
});
