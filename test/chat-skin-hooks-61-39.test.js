// 她 2026-09-03：「另一个窗口搞了一套仿聊天软件的内置但是我觉得还是不太像…
// 而且如果设置了圆头像只有角色是圆的，而且他们发的卡啊照片啊头像还是方的」
//
// 两个病，一个形状：**皮肤是照着挂点画的，挂点没铺到的地方一律不生效。**
//   ① 全 app 只有一处写了 data-wk="avatar"——单聊里对方那一颗。她自己那颗、
//      群聊里每个人的、卡片上的，一个都没挂，所以圆头像只圆了一颗。
//   ② 群聊（gthread）在 CSS_BUILTINS 里也有整整五套皮肤，可 GroupThread 里
//      一个挂点都没有——那五套在群里是死的，点下去什么都不会变。
// 所以这一条不去数「写了几个挂点」，而是【从生成的 CSS 里把选择器抠出来】，
// 逐个去两页里找。以后谁往皮肤里加一条新选择器，这条会立刻指出哪一页没跟上。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const tsSrc = fs.readFileSync(path.join(root, "js/theme-studio.js"), "utf8");

// 跑真的 theme-studio 拿真的 CSS，别照着源码里的字符串写断言
const TS = (() => {
  const g = { addEventListener() {}, dispatchEvent() {} };
  const sandbox = {
    window: g,
    document: { getElementById: () => null, createElement: () => ({}), head: { appendChild() {} }, readyState: "complete", addEventListener() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    location: { search: "" }
  };
  new Function("window", "document", "localStorage", "location", tsSrc)(
    sandbox.window, sandbox.document, sandbox.localStorage, sandbox.location);
  return g.ThemeStudio;
})();

const slice = (from, to, what) => {
  const i = comp.indexOf(from); assert.ok(i > 0, "抠不出" + what);
  const j = comp.indexOf(to, i); assert.ok(j > i, "抠不出" + what + "的结尾");
  return comp.slice(i, j);
};
const THREAD = slice("function ChatThread({", "\nfunction ChatSearchSheet({", "单聊");
const GROUP = slice("function GroupThread({", "\nfunction PollCard({", "群聊");

test("五套皮肤都拼得出来，没有拼出 undefined 的窟窿", () => {
  // 少写一个旋钮不会报错，只会把 border-radius: undefined 写进去，
  // 那一整条规则被浏览器静默丢掉——界面上看着像「这一项没做」。
  ["thread", "gthread"].forEach(page => {
    assert.ok(Array.isArray(TS.CSS_BUILTINS[page]), page + " 没有内置皮肤");
    TS.CSS_BUILTINS[page].forEach(([name, css]) => {
      assert.doesNotMatch(css, /undefined|NaN/, page + " 的「" + name + "」里有拼空的值");
      assert.ok(css.length > 800, page + " 的「" + name + "」短得不像一套皮肤");
    });
  });
});

test("皮肤用到的每一个挂点，单聊和群聊都得有", () => {
  const css = TS.CSS_BUILTINS.thread.map(x => x[1]).join("\n");
  const hooks = [...new Set([...css.matchAll(/\[data-wk="([a-z]+)"\]/g)].map(m => m[1]))];
  assert.ok(hooks.length >= 8, "只抠出 " + hooks.length + " 个挂点，皮肤是不是被删空了");
  const missing = [];
  hooks.forEach(k => {
    const has = src => src.includes('"data-wk": "' + k + '"');
    // 头像不看两页的源码——它长在 Avatar 组件自己身上，两页都是用它画的
    if (k === "avatar") { if (!has(comp.slice(comp.indexOf("function Avatar({"), comp.indexOf("\nfunction Eyebrow({")))) missing.push("avatar（Avatar 组件）"); return; }
    // 卡片是一批共用组件（转账/礼物/位置/亲属卡…），两页都在用，同理不按页查
    if (k === "card") { if ((comp.match(/"data-wk": "card"/g) || []).length < 10) missing.push("card（卡片组件）"); return; }
    if (!has(THREAD)) missing.push(k + " ← 单聊");
    if (!has(GROUP)) missing.push(k + " ← 群聊");
  });
  assert.deepEqual(missing, [],
    "皮肤画了这些地方，可这几页没有对应的挂点——点下去那一项不会变：\n  " + missing.join("\n  "));
});

test("头像的挂点长在 Avatar 组件自己身上，不是一个一个调用点去补", () => {
  const av = comp.slice(comp.indexOf("function Avatar({"), comp.indexOf("\nfunction Eyebrow({"));
  // 三支：她设的图 / emoji / 自动头像。少挂一支，那一类头像就漏掉
  assert.equal((av.match(/"data-wk": "avatar"/g) || []).length, 3,
    "Avatar 有三个 return（图片 / emoji / 自动头像），得支支都挂");
  // 全 app 的头像都归它画：调用点多到不可能一个个补（补完也会漏下一个）
  assert.ok((comp.match(/h\(Avatar, \{|React\.createElement\(Avatar, \{/g) || []).length > 30,
    "Avatar 的调用点没那么多的话，这条推理就不成立了，回去重想");
});

test("卡片挂在卡片组件自己身上；礼物那张故意不挂，理由写在旁边", () => {
  assert.ok((comp.match(/"data-wk": "card"/g) || []).length >= 15, "卡片挂点少了");
  const gift = comp.slice(comp.indexOf("function GiftCard({"), comp.indexOf("function KinshipCardFace({"));
  assert.doesNotMatch(gift, /"data-wk": "card"/, "礼物那张挂上了——它是画出来的包裹，套统一圆角会把画切坏");
  assert.match(gift, /故意不挂 data-wk="card"/, "不挂的理由没写下来，下一个人会以为是漏了");
});

test("尖角是一个真三角，不是浮在旁边的小方块", () => {
  // 转 45 度的方块跟气泡是两块分开的东西，凑近看接不上——她说的「不太像」有这一份。
  assert.match(tsSrc, /border-right: 5px solid ' \+ o\.theirBg/, "对方那侧的尖角不是三角");
  assert.match(tsSrc, /border-left: 5px solid ' \+ o\.myBg/, "自己那侧的尖角不是三角");
  assert.doesNotMatch(tsSrc, /transform: rotate\(45deg\)/, "转 45 度那个方块还留着");
});

test("微信的时刻是一行没有底的灰字", () => {
  const wx = TS.CSS_BUILTINS.thread.find(x => x[0] === "仿微信")[1];
  // 原来给了它一颗灰药丸配白字——那是别家的样子，一眼出戏
  assert.match(wx, /\[data-wk="time"\] span \{[^}]*background: transparent !important;/,
    "微信的时刻还顶着一块底");
  assert.doesNotMatch(wx, /\[data-wk="time"\] span \{[^}]*color: #ffffff/, "时刻还是白字");
});
