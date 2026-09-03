// v61.33 她 2026-09-03：「情侣空间抽屉这个还没拆不应该显示说的话的一部分，就是要拆开了
// 才看到。还有这里除了悄悄话还会放啥，然后这些框和背景还是很无聊」。
//
// 病在两处，两处都得堵（规则降概率，代码才保证）：
//  ① 界面：封着的那张把 x.title 印在封面上。
//  ② 数据：drawerWhisper 存的 title 就是正文头 16 个字 —— 于是封面上直接印着他要说的话。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");

const scr = fs.readFileSync("js/screens.js", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");
const drawer = (() => {
  const a = scr.indexOf("function CoupleDrawer({");
  return scr.slice(a, scr.indexOf("// ═══ 情侣空间·里程碑册", a));
})();
const sealed = (() => {
  const a = drawer.indexOf("if (sealed) {");
  return drawer.slice(a, drawer.indexOf("// 拆开的：摊平的那张纸", a));
})();

test("封着的时候，一个字的内容都不露", () => {
  assert.ok(sealed.indexOf("x.title") < 0, "封面上还印着 title");
  assert.ok(sealed.indexOf("x.text") < 0, "封面上还印着正文");
  // 也不许顺着 kind 泄露是哪一类 —— 那同样是「拆开才知道」的一部分
  assert.ok(sealed.indexOf("k.zh") < 0 && sealed.indexOf("k.ch") < 0, "封面上还写着是哪一类");
  // 露的只有这两样
  assert.match(sealed, /"还没拆"/);
  assert.match(sealed, /gachaWhen\(x\.ts\)/);
});

test("源头也断掉：悄悄话不再拿正文当标题", () => {
  const i = app.indexOf("const drawerWhisper =");
  const fn = app.slice(i, i + 900);
  assert.ok(fn.indexOf('title: t.replace(/\\s+/g, " ").slice(0, 16)') < 0, "还在切正文当标题");
  assert.match(fn, /kind: "whisper",[\s\S]{0,400}?title: "",/);
});

test("抽屉里会放哪几样，写在页面上，不用她来问", () => {
  ["他捡到的", "半句话", "他画的", "一句悄悄话"].forEach(zh =>
    assert.ok(drawer.indexOf(zh) >= 0 || scr.indexOf('zh: "' + zh + '"') >= 0, "少了「" + zh + "」"));
  assert.match(drawer, /Object\.keys\(DRAWER_KIND\)\.map/, "没把这几类摆出来");
});

test("类别图标是汉字，不是 emoji", () => {
  const i = scr.indexOf("const DRAWER_KIND = {");
  const kinds = scr.slice(i, scr.indexOf("};", i));
  assert.deepEqual(kinds.match(/[\u{1F000}-\u{1FAFF}☀-➿]/gu) || [], [], "还留着 emoji");
  ["拾", "半", "画", "悄"].forEach(ch => assert.ok(kinds.indexOf('ch: "' + ch + '"') >= 0, "少了 " + ch));
});

test("这一页是个抽屉：衬纸 + 四边内阴影，封着的是折起来封了蜡的纸条", () => {
  // 内阴影是「你在一个盒子里面」这句话的全部——没有它就只是一张米色底
  assert.match(drawer, /boxShadow: "inset 0 0 46px rgba\(96,72,40,\.26\)/);
  assert.match(sealed, /封蜡/);
  // 折痕要避开字：横穿一行字的时候那行字看着像被划掉
  assert.match(sealed, /\["17%", "85%"\]\.map/);
});
