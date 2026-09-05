// 她 2026-09-05：「继续查手机内层和随身物吧宝宝」。
//
// 两件都查完了，结论都是「本来就是对的 / 早就做完了」，但理由值得钉住，
// 免得下一轮又有人把它当成漏掉的去铺纸。
//
// 查手机：二十个内层 app 在浏览器里逐个开过——
//   自己画皮的：购物 / 论坛 / 音乐 / 健康 / 外卖
//   落在那块底衬上的：微信 / 便签 / 相册 / 视频 / 日历
// 后面这五个的平色是【对的】：它们扮的就是真手机上的那些 app
// （微信灰地白格、日历白卡、便签白底上一张黄条、相册照片铺满）。
// ⚠️判据（tabs-not-plain-pills）在这一处是反过来的：这一页搬到别的 app 里
//   【不成立】才对——而它们模仿的正是别的 app，所以照着现实里那个东西来就是对的。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const phone = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");

test("查手机那块底衬起了名字，不再是一行看不出用意的裸平色", () => {
  assert.match(phone, /function phoneAppBg\(t\) \{ return \{ background: t\.bg \}; \}/);
  assert.match(phone, /className: "h-full flex flex-col relative",\s*style: phoneAppBg\(t\)/, "外框没用那一份");
  // 理由必须留在代码里：下一个人看见平色，第一反应会是「这儿漏装修了」
  const seg = phone.slice(phone.indexOf("// 内层 app 的底衬"), phone.indexOf("const FULL_BLEED_KEYS"));
  assert.match(seg, /平色是有意的/);
  assert.match(seg, /扮的是【真手机上的那些 app】|扮的就是真手机/);
  // 二十个内层全是 full-bleed（自己占满），所以这块底衬只在没画皮的那几个底下露出来
  const fb = phone.match(/const FULL_BLEED_KEYS = \[([^\]]*)\]/);
  assert.ok(fb, "full-bleed 名单没了");
  // ⚠️只在 PHONE_APPS 那个数组里数：整份文件里 `key: "..."` 有一百多处
  const arr = phone.slice(phone.indexOf("const PHONE_APPS = ["), phone.indexOf("\n];", phone.indexOf("const PHONE_APPS = [")));
  const keys = [...arr.matchAll(/key: "([a-z]+)"/g)].map(m => m[1]);
  assert.equal(keys.length, 20, "内层 app 数目变了，得重新逐个看一遍");
  const listed = fb[1].match(/"[a-z]+"/g).map(s => s.replace(/"/g, ""));
  assert.deepEqual(keys.filter(k => listed.indexOf(k) < 0), [], "有内层 app 不在 full-bleed 名单里，那块底衬会整片露出来");
});

test("随身物门后早就有底了——柜内那一层走的是布纹", () => {
  // 工单上那一行是过期的：门是做过的，门【后】那一层也是做过的
  const i0 = scr.indexOf("function Carry({ characters, carry,");
  assert.ok(i0 > 0, "找不到随身物");
  const seg = scr.slice(i0, scr.indexOf("\nfunction ", i0 + 10));
  const skins = seg.match(/pageSkin\("cloth", t, \{ tint: CARRY_TINT\.bag, corner: false \}\)/g) || [];
  assert.ok(skins.length >= 2, "柜门那一页和柜内那一层没都铺上，实际 " + skins.length + " 处");
  assert.match(scr, /if \(inBox\) return h\("div", \{ className: "h-full flex flex-col", style: pageSkin\("cloth", t/,
    "拉开柜门之后那一层没铺底");
});
