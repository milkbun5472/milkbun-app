// 名片的出厂预设（她 2026-09-06：「名片预设改一下就用我那张名片的签名和 tag，
// 名字从 lisa 改成秋秋，默认图像塞秋秋那张胖鸟 png」）。
//
// 原来是三个空值，新装的人第一眼看到的是「点此设置昵称／点铅笔写一句签名」——
// 那不是一张名片，是三个待办。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const PRESET = new Function(comp.slice(comp.indexOf("const QIU_AVATAR = "), comp.indexOf("\n}", comp.indexOf("function HOME_CARD_PRESET()")) + 2) + "\nreturn HOME_CARD_PRESET;")();

test("四样都填好了，而且名字是秋秋不是 lisa", () => {
  const c = PRESET();
  assert.equal(c.name, "秋秋");
  assert.ok(c.sign && c.sign.length > 10, "签名是空的");
  assert.deepEqual(c.tags, ["Autumn", "Quill", "Daydream"]);
  assert.equal(c.avatar, "img/qiu-avatar.png");
  assert.equal(comp.indexOf('name: "Lisa"'), -1, "还留着 Lisa");
});

test("那张胖鸟图真的在仓库里", () => {
  const p = path.join(__dirname, "..", "img", "qiu-avatar.png");
  assert.ok(fs.existsSync(p), "img/qiu-avatar.png 不在仓库里，头像会是一个碎图标");
  assert.ok(fs.statSync(p).size > 1000, "那张图是空的");
});

test("每次拿到的是新的一份，改了不许污染出厂快照", () => {
  // 直接导出一个常量对象的话，App 里一改就把这份「出厂快照」也改了
  const a = PRESET(); a.name = "改过了"; a.tags.push("脏");
  const b = PRESET();
  assert.equal(b.name, "秋秋");
  assert.deepEqual(b.tags, ["Autumn", "Quill", "Daydream"]);
});

test("App 那边真的在用它（不是定义了没人引用）", () => {
  assert.match(app, /setHomeCard\(loadJSON\("x_homeCard", HOME_CARD_PRESET\(\)\)\)/, "还在用那三个空值");
  assert.equal(app.indexOf('loadJSON("x_homeCard", { name: "", sign: "", tags: [] })'), -1, "旧的那份没删干净");
});

test("头像走名片自己那一栏，不许连聊天头像一起改", () => {
  // 名片头像和聊天头像早就分开了（她 2026-09-04 要的）：塞进 profile.avatarImage
  // 等于把她的聊天头像也换成一只鸟
  assert.match(comp, /avatarImage: c\.avatar \|\| profile\.avatarImage/, "名片头像那条线断了");
  assert.equal(app.indexOf('avatarImage: "img/qiu-avatar.png"'), -1, "把默认头像塞进 profile 了");
});
