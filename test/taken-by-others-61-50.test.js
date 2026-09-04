// 她 2026-09-03：「她和另一个角色是 cp 但是开了 dongnian 就还是会跑过来找我」。
//
// 病根不是模型不听话：关系网确实发下去了，但【没有任何一句话说这对「怎么跟用户说话」
// 意味着什么】。空白由训练先验补上——先验就是「主动跑来找你、还带着情绪＝对你有意思」。
// ⚠️她 2026-08-31 在查手机账本上报过同一个病，当时注释里就写着
//   「buildBundle 里只有是恋人/待定才会说一句，不是恋人时一个字都不说」，
//   可那次只修了查手机那一处（phoneBondBlock），buildBundle 本身没跟上。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const eng = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
// 跑真函数，不照着源码写断言
const takenByOthersLine = (() => {
  const i = eng.indexOf("const ROMANTIC_REL");
  const j = eng.indexOf("function directedRelationLines");
  assert.ok(i > 0 && j > i, "抠不出 takenByOthersLine");
  return new Function(eng.slice(i, j) + "\nreturn takenByOthersLine;")();
})();
const CH = [{ id: "scar", name: "Scar" }, { id: "prim", name: "Prim" }];
const line = (label, meLabel) => takenByOthersLine("scar",
  Object.assign({ "scar->prim": { label: label } }, meLabel ? { "scar->me": { label: meLabel } } : {}),
  CH, "Lisa");

test("和别的角色是恋人时才说这句话", () => {
  ["恋人", "情侣", "女朋友", "男朋友", "老婆", "老公", "未婚妻", "爱人", "伴侣", "CP"].forEach(l =>
    assert.ok(line(l), "「" + l + "」该判成在一起，现在漏了"));
  ["朋友", "挚友", "青梅竹马", "同事", "对手", "兄妹"].forEach(l =>
    assert.equal(line(l), "", "「" + l + "」不该判成在一起"));
});

test("⚠️前任和单向暗恋不算——那两个恰恰含着正词", () => {
  // 「前男友」里头就含「男友」，「单向暗恋」里含「恋」。
  // 这两个都是关系页的预设标签（REL_PRESETS），一定会被用到，光看正词必错。
  ["前男友", "前女友", "前任", "已分手", "离婚", "前妻", "单向暗恋", "暗恋", "单恋"].forEach(l =>
    assert.equal(line(l), "", "「" + l + "」被判成了现任"));
  assert.match(fs.readFileSync(path.join(root, "js/screens.js"), "utf8"), /"前任", "单向暗恋"/,
    "这两个不再是预设标签的话，上面那条推理要重写");
});

test("说的是事实和分寸，不是台词", () => {
  const s = line("恋人", "朋友");
  assert.match(s, /Prim（恋人）/, "没点名对象是谁");
  assert.match(s, /你和 Lisa 是：朋友/, "没说清跟用户到底是什么关系");
  // 不是「别理她」——主动可以，越界不行。分寸按真实关系走。
  assert.match(s, /主动找 Lisa[^。]*【都可以】/, "把主动本身给禁了，那等于换了个人");
  assert.match(s, /不许说成告白、暧昧或情话/);
  assert.match(s, /不是按「谁主动找谁谁就有意思」走/, "没点破那个先验，等于没治到病根");
  // 不给台词（.claude/rules/prompt-no-content-samples.md）
  assert.doesNotMatch(s, /比如|例如|你可以说|你应该说/, "塞了台词进去，模型会照着念");
});

test("跟用户没写关系时也得成立", () => {
  assert.match(line("恋人"), /还没长成什么特别的关系/, "跟用户那一栏空着就说不出话了");
});

test("挂在 buildBundle 里，所有走 bundle 的入口一起白得", () => {
  // ⚠️关键：单聊【不走】app.js 的 coupleLineFor（那个只管群聊两处），
  //   它走 ctxFor().coupleStatus → buildBundle。写在 app.js 里会修错地方。
  const i = eng.indexOf("if (!ctx.notRoleplay && ctx.coupleStatus)");
  const seg = eng.slice(i, i + 1400);
  assert.match(seg, /takenByOthersLine\(char && char\.id, rels, chars, uName\)/, "没接进 buildBundle");
  // 只在【不是用户的恋人】时才补这一句
  assert.match(seg, /!\(ctx\.coupleStatus && String\(ctx\.coupleStatus\)\.split\("\|"\)\[0\] === "together"\)/,
    "和用户是恋人时也发这句，那就自相矛盾了");
  // 言秋那种不被扮演的照旧不发扮演类的层
  assert.match(seg, /!ctx\.notRoleplay && !\(ctx\.coupleStatus/);
  // 群聊那两处调同一份，别各写一遍文案
  assert.match(app, /takenByOthersLine\(charId, rels, characters \|\| \[\], uName\)/, "群聊没调同一份");
  assert.doesNotMatch(app, /不许说成告白、暧昧或情话/, "app.js 里又抄了一份文案");
});
