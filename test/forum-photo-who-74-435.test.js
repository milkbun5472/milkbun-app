// 贴吧配图不许再硬画人脸（她 2026-10-01 拿一张截图来问）
//
// 那张图的描述是「微信个人主页截图，头像是一只套着蓝色毛绒鲨鱼头套、露出黑亮眼睛和
// 湿漉漉鼻头的小黑狗」，画出来却是一张人脸。
//
// 病根：贴吧走的是【猜】那条路（noFaceKindFor 查词表）——
//   描述里没有「风景／无人」就不算空镜，没有「只拍手／背影」就不算局部，
//   剩下的一律兜底成【本人自拍、锁着脸画】。「微信个人主页截图」两头都不沾。
// ⚠️v74.426 给朋友圈治过同一个病（加 imageWho 让角色自己说），当时注释就写着
//   「发的人说了就照他说的；没说（旧数据、**贴吧**）才退回去猜」——贴吧是被明知留下的。
//   这一版照同一套给贴吧接上 photoWho，不另写一套判法（施工规则/one-public-mechanism）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");
const scr = fs.readFileSync("js/screens.js", "utf8");

const photoOf = (() => {
  const i = scr.indexOf("function forumPhotoOf("), j = scr.indexOf("function forumWithPhoto(");
  assert.ok(i > 0 && j > i, "抠不出 forumPhotoOf");
  return new Function(scr.slice(i, j) + "\nreturn forumPhotoOf;")();
})();

test("① 先复现那张图：光靠猜，这条描述会被当成自拍锁脸", () => {
  const eng = fs.readFileSync("js/engine.js", "utf8");
  const i = eng.indexOf("const SCENE_ONLY_WORDS"), j = eng.indexOf("// ---- 图上云");
  assert.ok(i > 0 && j > i, "抠不出 noFaceKindFor 那一段");
  const guess = new Function(eng.slice(i, j) + "\nreturn noFaceKindFor;")();
  const desc = "微信个人主页截图，头像是一只套着蓝色毛绒鲨鱼头套、露出黑亮眼睛和湿漉漉鼻头的小黑狗";
  assert.equal(guess(desc, "沈屿白"), "",
    "空字符串＝兜底当自拍锁脸。这就是她那张图的来历，所以不能靠猜");
});

test("② 提示词里要让发帖的人自己说 photoWho", () => {
  const line = app.match(/const FORUM_PHOTO_LINE = "[^"]*"/)[0];
  assert.match(line, /photoWho/, "提示词没要求填 photoWho");
  assert.match(line, /none/, "要说清 none 是什么");
  assert.ok(/东西|风景|截图|宠物/.test(line), "要举出「没有人」都包括哪些，不然它仍然只会想到风景");
  // ⚠️这个常量里全是转义引号，别拿 [^"]* 去框，取整行
  const field = app.split("\n").find(l => l.includes("const FORUM_PHOTO_FIELD ="));
  assert.ok(field, "抠不出 FORUM_PHOTO_FIELD");
  assert.match(field, /photoWho/, "schema 里没这一格，模型根本不会填");
});

test("③ 两种形状都要认得（模型刚吐的 / 已落盘的）", () => {
  // 模型吐出来时 photoWho 是【兄弟字段】，不在 photo 里面
  assert.equal(photoOf({ photo: "微信个人主页截图，头像是小黑狗", photoWho: "none" }).who, "none");
  // 落盘之后它住在 photo.who
  assert.equal(photoOf({ photo: { desc: "一张截图", who: "none" } }).who, "none");
});

test("④ 旧数据和乱填的，一律当没说（退回去猜，不许瞎认）", () => {
  assert.equal(photoOf({ photo: "老帖子的图" }).who, undefined);
  assert.equal(photoOf({ photo: "x", photoWho: "随便" }).who, undefined);
  assert.equal(photoOf({ photo: "x", photoWho: "NONE" }).who, "none", "大小写要认");
});

test("⑤ 整条链接上了：发帖带上 photoWho，生图时递给公共那一层", () => {
  assert.match(app, /photo: d\.photo, photoWho: d\.photoWho/,
    "角色发帖那一处把 photoWho 丢了，链在落盘前就断");
  assert.match(app, /drawFromDesc\(char \|\| null, ph\.desc, ph\.who\)/,
    "生图时没把 who 递下去，等于白存");
  // 不许在贴吧这儿另写一套判法——公共那一层已经认第三个参数
  const i = app.indexOf("const forumGenImage = async"), j = app.indexOf("window.forumGenImage");
  assert.ok(!/noFaceKindFor/.test(app.slice(i, j)), "贴吧不许自己再写一份判法");
});
