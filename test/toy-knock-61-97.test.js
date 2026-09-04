// 她 2026-09-04：「你看看现在 toy 取消隐藏的条件是啥，之前是把 header 的英文
// 点击七下，现在 header 没了。。。」
//
// 是真的没了：那个入口挂在设置首页顶栏那行英文（"Config"）上，
// 而 v61.40「标题不留英文」把 Head 改成【有中文标题时纯拉丁的 en 一律不发】，
// 于是那个 span 连渲染都不渲染——入口跟着一起消失，谁也没发现。
//
// 教训：一个【藏起来的入口】不能靠一个会被别的规矩顺手删掉的东西托着。
// 现在挂在标题本身上：这一页只要还有标题，入口就还在。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const HEAD = comp.slice(comp.indexOf("function Head({"), comp.indexOf("function AvatarPicker({"));

test("Head 收得下这个挂钩，而且挂在【标题】上", () => {
  assert.match(HEAD, /\n\s*, onTitleTap\n\}\) \{/, "Head 收不了 onTitleTap");
  // 必须落在渲染 zh 的那个 div 上——落在副标题那一行就等于没修（副标题正是会消失的那个）
  const titleDiv = HEAD.slice(HEAD.indexOf("onClick: onTitleTap"), HEAD.indexOf("}, zh)"));
  assert.ok(titleDiv.length > 0 && titleDiv.length < 500, "onTitleTap 没挂在标题那个 div 上");
  assert.match(HEAD, /onClick: onTitleTap \|\| undefined,[\s\S]{0,400}\}, zh\)/, "挂点和 zh 不在同一个 div");
});

test("不传就一点变化都没有（六十多页共用这一个顶栏）", () => {
  assert.match(HEAD, /onClick: onTitleTap \|\| undefined/, "没传的时候会挂上一个 undefined 以外的东西");
  // 长相不许因为这个挂钩变：标题那个 div 的样式一个字段都不许动
  const st = HEAD.slice(HEAD.indexOf("onClick: onTitleTap"), HEAD.indexOf("}, zh)"));
  for (const k of ["fontFamily: F_DISPLAY", "fontSize: 15.5", "color: INK", "textOverflow: \"ellipsis\""])
    assert.ok(st.includes(k), "标题样式被动过了：少了 " + k);
  assert.doesNotMatch(st, /padding|cursor|background/, "为了挂钩给标题加了长相上的东西");
});

test("设置首页把七下挂上去了，别的页不挂", () => {
  assert.match(scr, /h\(Head, \{ zh: m\[0\], en: m\[1\], onBack: back, onTitleTap: page === "home" \? toyKnock : undefined \}\)/);
  // 旧那条挂在英文上的路要删掉，不是留着（撤东西是删掉）
  assert.doesNotMatch(scr, /const eyebrow = page === "home"/, "挂在英文上那条老路还留着");
});

test("七下这件事本身没走样：要连着点、会 toggle、只存本机", () => {
  const i = scr.indexOf("const toyKnock = () => {");
  assert.ok(i > 0, "Config 里没有 toyKnock");
  const seg = scr.slice(i, i + 600);
  assert.match(seg, /k\.n = now - k\.ts < 1500 \? k\.n \+ 1 : 1;/, "不再要求「连着」点——隔多久都算的话太容易误触");
  assert.match(seg, /if \(k\.n < 7\) return;/, "不是七下");
  assert.match(seg, /const next = !toyUnlocked;/, "不能再点七下藏回去了");
  assert.match(seg, /localStorage\.setItem\("x_toyUnlocked"/, "存的键换了，她原来解锁过的会失效");
  // ⚠️这个键绝不能跟着云同步走：界面承诺「仅本机」
  assert.doesNotMatch(scr, /x_toyUnlocked[\s\S]{0,80}Cloud/, "这个开关被推上云了");
});

test("解锁之后那一格才出现", () => {
  assert.match(scr, /toyUnlocked && typeof ToyConfig === "function" \? h\(ConfigTile, \{ icon: "◇", title: "本地配件"/);
  assert.match(scr, /page === "toy" && toyUnlocked && typeof ToyConfig === "function"/, "没解锁却还能直接跳进那一页");
});
