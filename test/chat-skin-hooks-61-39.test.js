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

// ── 她 2026-09-03 追报 ────────────────────────────────────────────────
// 「我看我头像形状还是没挂上还是方的，他发消息等待的三个点也还是方的，
//   宝宝你做的感觉一个没生效耶」
// 两件事，一件是真漏了，一件是【我改的东西根本没到她手上】。
test("正在输入那三个点也是一条消息，得跟着皮肤走", () => {
  // 它原来是裸的：写死 #fff + 14px 圆角，一个挂点都没有。
  // 换了圆气泡的皮肤，满屏都圆了、只有这一颗还方着——而它天天出现，最扎眼。
  [["单聊", THREAD], ["群聊", GROUP]].forEach(([who, src]) => {
    const i = src.indexOf('"aria-label": character.name + " 正在输入"');
    const seg = i >= 0 ? src.slice(i, i + 900) : src.slice(src.indexOf("}), sending && h(\"div\", {"), src.indexOf("}), sending && h(\"div\", {") + 900);
    assert.ok(seg.length > 100, who + "抠不出正在输入那一段");
    assert.match(seg, /"data-wk": "bubble", "data-me": "0", "data-kind": "typing"/, who + "的三个点没挂上气泡挂点");
    assert.match(seg, /"data-wk": "row"/, who + "那一行没挂 row，间距跟别的消息对不齐");
  });
});

test("内置预设改了要告诉她——它是拷贝进编辑框的，不是引用", () => {
  // 这才是「感觉一个没生效」的真病根：挂点全补好了，可她编辑框里那段 CSS
  // 是改之前灌进去的旧拷贝，选择器还是老的，所以她那颗头像照旧是方的。
  // 界面上原来一个字都没说，看着就像我做的东西没生效。
  const ui = fs.readFileSync(path.join(root, "js/theme-studio-ui.js"), "utf8");
  assert.match(tsSrc, /const SKIN_VER = \d+;/, "内置没有版本号，就没法知道她手上那份旧不旧");
  assert.match(tsSrc, /"\/\* 内置 · " \+ nm \+ " · v" \+ SKIN_VER \+ " \*\/\\n"/, "灌出去的 CSS 没盖版本戳");
  assert.ok(typeof TS.cssStale === "function", "cssStale 没挂出去，界面调不到");
  // 认得出旧的、认得出新的、也不许把她自己写的 CSS 误判成内置
  const cur = TS.CSS_BUILTINS.thread[0][1];
  const ver = Number((tsSrc.match(/const SKIN_VER = (\d+);/) || [])[1]);
  // ⚠️这一整套全靠【改了内置的人记得把 SKIN_VER +1】。忘了 +1，她那份旧 CSS
  //   就永远不算旧、界面永远不提示，等于白做。所以把内置的内容按住：
  //   内容变了而版本没跟着变，这条就红，红出来的那句话直接告诉你怎么办。
  const bare = TS.CSS_BUILTINS.thread.map(x => x[1].replace(/^\/\* 内置 · .+? \*\/\n/, "")).join("\n");
  const sum = require("node:crypto").createHash("sha256").update(bare).digest("hex").slice(0, 12);
  assert.deepEqual({ ver, sum }, { ver: 4, sum: "0e6510d3f1d2" },
    "内置皮肤的内容变了：把 js/theme-studio.js 里的 SKIN_VER +1，再把这一行的 ver/sum 改成新的。\n" +
    "不 +1 的话，她编辑框里那份旧 CSS 永远不会被认成旧的，界面也就永远不提示重新灌。");
  assert.deepEqual(TS.cssStale("/* 内置 · 仿微信 · v" + (ver - 1) + " */\n.a{}"),
    { name: "仿微信", from: ver - 1, to: ver });
  assert.equal(TS.cssStale(cur), null, "刚灌进去的被当成旧的了");
  assert.equal(TS.cssStale(".a{border-radius:9px}"), null, "她自己写的 CSS 被当成内置了");
  // 版本戳是一行注释，不许把编译打坏
  const out = TS.compile(TS.normalize({ pageCSS: { thread: cur } }));
  assert.match(out, /\[data-wk="bubble"\]/, "带上版本戳之后规则被编译丢了");
  // 界面上得真的说出来
  assert.match(ui, /studio\.cssStale/, "界面没查陈旧，她永远不知道要重新灌一次");
  assert.match(ui, /有更新（v/, "查了却没写出来");
  assert.match(ui, /会盖掉你在这段里改过的东西/, "没提醒重新灌会盖掉她自己的改动");
});

// ── 她 2026-09-03 再追报 ──────────────────────────────────────────────
// 「ins 的发送键看不到。还有我觉得 whatsapp line telegram 这几个也太像了宝宝你弄一弄」
test("发送键不许透明——图标颜色是写死的 #fff", () => {
  // ⚠️ISend 拿的是 color 属性（写死 "#fff"），不是 currentColor，
  //   所以 CSS 里给 [data-wk="send"] 设 color 没用。底一透明就是白图标落在白底上。
  //   这跟 tabs-not-plain-pills.md 里那条「绝不许写死 #fff」是同一个坑。
  const send = comp.slice(comp.indexOf('"data-wk": "send"'), comp.indexOf('"data-wk": "send"') + 320);
  assert.match(send, /color: "#fff"/, "图标不再写死 #fff 的话，这条推理要重写");
  TS.CSS_BUILTINS.thread.forEach(([nm, css]) => {
    const m = /\[data-wk="send"\] \{[^}]*background: ([^;]+) !important;/.exec(css);
    assert.ok(m, nm + " 没给发送键上色");
    assert.ok(!/transparent|rgba\([^)]*,\s*0(\.0+)?\)/.test(m[1]),
      nm + " 的发送键是透明底：白图标落在白底上，她就看不见了（现在是 " + m[1].trim() + "）");
  });
});

test("五套之间真的分得开——不是只换了个色相", () => {
  // 判据照 tabs-not-plain-pills.md：原样搬到另一家还成立，就等于没做。
  // whatsapp / line / telegram 原来都是「浅底 + 白气泡 + 一块有色气泡 + 圆头像 + 尖角」。
  const feat = TS.CSS_BUILTINS.thread.map(([nm, css]) => {
    const g = re => { const m = re.exec(css); return m ? m[1].trim() : ""; };
    return {
      nm,
      底: g(/\[data-wk="chat"\][^{]*\{[^}]*background-image: ([^;]+) !important;/).slice(0, 40),
      已读在气泡里: /align-self: flex-end !important;/.test(css),
      尖角: /border-right: 5px solid/.test(css),
      气泡圆角: g(/\[data-wk="bubble"\] \{[^}]*border-radius: ([^;]+) !important;/)
    };
  });
  const sig = feat.map(f => [f.底, f.已读在气泡里, f.尖角, f.气泡圆角].join("|"));
  const dup = sig.filter((x, i) => sig.indexOf(x) !== i);
  assert.deepEqual(dup, [],
    "有两套长得一模一样（底/已读位置/尖角/圆角全同）：\n  " +
    feat.map((f, i) => f.nm + " → " + sig[i]).join("\n  "));
  // 三家各自那件最认脸的事
  const by = nm => feat.find(f => f.nm === nm);
  assert.ok(by("仿 WhatsApp").底.startsWith("url("), "WhatsApp 的底没有那层涂鸦——光靠米色跟别家分不开");
  assert.ok(by("仿 Telegram").底.startsWith("linear-gradient"), "Telegram 的底不是渐变");
  assert.equal(by("仿 Telegram").尖角, false, "Telegram 不该有尖角");
  assert.equal(by("仿 LINE").已读在气泡里, false, "LINE 的已读该在气泡外面");
  assert.equal(by("仿 WhatsApp").已读在气泡里, true, "WhatsApp 的已读该在气泡里");
});

test("已读那一行两处都挂了，而且认得出是谁说的", () => {
  // 单聊和群聊各有一份 msgFoot——「一层写在两处」，两处都得挂
  assert.equal((comp.match(/"data-wk": "meta", "data-me"/g) || []).length, 2,
    "msgFoot 有两份（单聊/群聊），得两处都挂");
  // ⚠️塞进气泡那一路不许 absolute 到 [data-wk="msg"]（那是【整行】）：
  //   对方那侧会把已读甩到屏幕最右边，离气泡十万八千里。
  const wa = TS.CSS_BUILTINS.thread.find(x => x[0] === "仿 WhatsApp")[1];
  assert.doesNotMatch(wa, /\[data-wk="msg"\] \{ position: relative/, "又锚到整行上了");
  assert.match(wa, /align-self: flex-end !important;/, "没落在气泡那一列的右缘");
});
