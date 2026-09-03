// 她 2026-09-03：「你又忘了把头上那一大块游戏去掉，你怎么老是忘」
//
// 病根不是记性：.claude/rules/mobile-ui-layout.md §1 早就写着「普通子页面用紧凑标题栏，
// 禁止 30–40px 大标题」，可我一直在【一页一页地】改它——穿书那次单独写了一条紧凑栏，
// 小游戏那次又想着「Head 是公共的，别动」。于是每来一页就得重新想起来一次。
// Head 自己就是那个违规的东西，六十多处都在用它：改它一处，六十多页一起合规。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const rule = fs.readFileSync(path.join(root, ".claude/rules/mobile-ui-layout.md"), "utf8");
const HEAD = comp.slice(comp.indexOf("function Head({"), comp.indexOf("function AvatarPicker({"));

test("Head 就是那条紧凑标题栏，不再是 30px 大标题", () => {
  assert.ok(HEAD.length > 300, "抠不出 Head");
  // 规矩原文：禁止 30–40px 大标题
  const sizes = [...HEAD.matchAll(/fontSize: ([\d.]+)/g)].map(m => Number(m[1]));
  assert.ok(sizes.length, "Head 里一个字号都没有？");
  assert.ok(Math.max.apply(null, sizes) <= 18,
    "Head 里还有 " + Math.max.apply(null, sizes) + "px 的字——规矩说禁止 30–40px 大标题");
  assert.doesNotMatch(HEAD, /React\.createElement\("h1"/, "还在用 h1 摆大标题");
  // 三段式：返回键 / 居中小标题 / 右侧等宽操作位
  assert.match(HEAD, /const SIDE = 46;/);
  // 左右两个格子都按 SIDE 走（别去数出现几次——返回键自己也用了 SIDE，数出来是 3）
  assert.match(HEAD, /className: "shrink-0 flex items-center",\n\s*style: \{ width: SIDE \}/, "左边那格没按 SIDE");
  // 右边用 minWidth：没东西时和左边等宽（标题正居中），放了两个按钮就撑开、不压到标题
  assert.match(HEAD, /style: \{ minWidth: SIDE, paddingRight: 8 \}/, "右边那格没按 SIDE，标题就没真的居中");
  assert.doesNotMatch(HEAD, /style: \{ width: SIDE, paddingRight/, "右边写死了宽度，两个按钮会溢出来压到标题上");
  assert.match(HEAD, /textAlign: "center"/);
  assert.match(HEAD, /right \|\| null/, "右侧操作位没接上");
  // 顶栏自己吃刘海（规矩 §1），别在外面另垫一条
  assert.match(HEAD, /paddingTop: safeTop\(8\)/);
});

test("副标题两种都收得下：英文小字和中文一行", () => {
  // 六十多处调用里 en 传的多半是英文，穿书那处传的是中文副标题。
  // 中文不该被拉字距和大写——那是给英文 eyebrow 用的。
  assert.match(HEAD, /const line = sub \|\| en \|\| "";/);
  assert.match(HEAD, /const cjk = \/\[一-鿿\]\/\.test\(String\(line\)\);/);
  assert.match(HEAD, /letterSpacing: cjk \? 0 : "0\.14em"/);
  assert.match(HEAD, /textTransform: cjk \? "none" : "uppercase"/);
  // 没有副标题就不占那一行
  assert.match(HEAD, /line \? \/\*#__PURE__\*\/React\.createElement\("div"/);
});

test("这条规矩指名了落点，下一个人不用再想一遍", () => {
  // ⚠️规矩原来只说「用紧凑标题栏」，没说【哪个组件是它】——
  //   于是每个人都得自己判断手上这一页算不算「普通子页面」，然后自己再写一条。
  assert.match(rule, /components\.js` 的 `Head`/, "规矩里没写清哪个组件就是那条紧凑栏");
  assert.match(rule, /别再自己写一条/);
});

test("公共的那条改好了，就不许再各自另写一条", () => {
  // 穿书那处原来自己写了一份（当时 Head 还是大标题），现在撤了。
  const fic = fs.readFileSync(path.join(root, "js/fanfic.js"), "utf8");
  const th = fic.slice(fic.indexOf("  // 穿书会话（互动叙事）"), fic.indexOf("  // ---------- 底 nav ----------"));
  assert.match(th, /h\(Head, \{/, "穿书那一页没用公共的 Head");
  assert.doesNotMatch(th, /paddingTop: safeTop\(8\)/, "自己那份紧凑栏还留着，成了第二个实现");
});
