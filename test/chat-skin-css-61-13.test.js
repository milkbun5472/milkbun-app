// v61.13 她 2026-09-03：「你这是开了多一页气泡皮肤，你把它去掉，就在页面 css 里面
// 那栏线上里面存预设然后点击可以看见 css 预设在编辑框里可以再自己改」。
// 钉三件事：工作台没有多出来的那一栏；五套皮肤是【CSS 内置预设】（点一下灌进编辑框）；
// 五套共用一个骨架，而且都能过安全检查、能加页面前缀。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");

const ui = fs.readFileSync("js/theme-studio-ui.js", "utf8");

function studio() {
  global.window = global;
  global.localStorage = { getItem: () => null, setItem: () => {} };
  global.document = { readyState: "complete", addEventListener() {}, head: { appendChild() {} },
    getElementById: () => null, createElement: () => ({ setAttribute() {}, style: {} }), documentElement: {} };
  delete require.cache[require.resolve("../js/theme-studio.js")];
  require("../js/theme-studio.js");
  return global.window.ThemeStudio;
}

test("工作台还是三栏，没有单开的气泡皮肤页", () => {
  assert.ok(ui.indexOf('tab("skin"') < 0, "那一栏又被加回来了");
  assert.match(ui, /gridTemplateColumns: "repeat\(3,minmax\(0,1fr\)\)"/);
});

test("点内置预设＝把 CSS 灌进编辑框，之后还能自己改", () => {
  // setCSS 走的是 draft，编辑框读的也是 draft —— 灌进去之后就是可编辑的正文
  assert.match(ui, /studio\.CSS_BUILTINS\[page\]\.map\(\(\[nm, code\]\) => h\("button"[\s\S]{0,120}onClick: \(\) => \{ setCSS\(code\)/);
});

test("线上和群聊两页都有五套，且都是真能用的 CSS", () => {
  const S = studio();
  for (const page of ["thread", "gthread"]) {
    const list = S.CSS_BUILTINS[page];
    assert.equal(list.length, 5, page + " 那一页的内置数量不对");
    assert.deepEqual(list.map(x => x[0]), ["仿微信", "仿 LINE", "仿 Telegram", "仿 WhatsApp", "仿 Insta DM"]);
    for (const [nm, css] of list) {
      assert.equal(S.unsafeReason(css), "", nm + " 过不了安全检查");
      assert.ok(css.length > 1200, nm + " 太短，像是没写全");
      for (const k of ["bubble", "composer", "chathead", "body", "avatar", "time"])
        assert.ok(css.indexOf('data-wk="' + k + '"') >= 0, nm + " 里少了挂点 " + k);
      // 自己那侧和对方那侧必须分开写，否则两边一个色
      assert.ok(css.indexOf('[data-me="1"]') >= 0 && css.indexOf('[data-me="0"]') >= 0, nm + " 没分两侧");
      assert.doesNotThrow(() => S.scopeCSS(css, 'html[data-lisa-screen="' + page + '"]'), nm + " 加不上页面前缀");
    }
    // 两页共用同一份，不是各存一套
    assert.equal(S.CSS_BUILTINS.thread, S.CSS_BUILTINS.gthread);
  }
});

test("五套的差别只是那十几个数，骨架共用", () => {
  const st = fs.readFileSync("js/theme-studio.js", "utf8");
  assert.match(st, /const chatSkinCSS = o =>/);
  ["WECHAT_CSS", "LINE_CSS", "TELEGRAM_CSS", "WHATSAPP_CSS", "INSTA_CSS"].forEach(v =>
    assert.match(st, new RegExp("const " + v + " = chatSkinCSS\\(\\{"), v + " 没走共用骨架"));
});

test("灌 CSS 之前先把气泡皮肤退回出厂，否则 CSS 一个字也看不见", () => {
  // 皮肤那张 style 带 !important 又排在主题 CSS 后面（v61.05 她要的），
  // 身上挂着皮肤时点内置预设会像是坏了 —— 所以这里必须先清。
  assert.match(ui, /const clearSkin = \(\) => \{[\s\S]{0,200}applyBubblePreset\("default"\)/);
  assert.match(ui, /setCSS\(code\); clearSkin\(\);/);
});
