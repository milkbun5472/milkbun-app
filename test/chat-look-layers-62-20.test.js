// 长相的四层（她 2026-09-04 定）
//
// 她原话：「设置里的皮肤 css 应该在最底层，随时可以被角色设置里的皮肤做单个 override，
//   比如全局是 line 我给 a 选微信应该覆盖它。然后气泡皮肤这个现在只在设置有，
//   给全部角色也来一份，也是角色 over 全局。然后皮肤应该在气泡下面，也就是如果我改了气泡，
//   他应该显示在 override 微信皮肤的气泡。自定义背景也是要 override 微信背景的默认色。」
//
// 从下往上：
//   ① 全局皮肤（主题工作台 · 单聊页 CSS）
//   ② 这个人的皮肤
//   ③ 全局气泡
//   ④ 这个人皮肤那层【底】再压一次（不然「微信顶栏配 LINE 的底」）
//   ⑤ 这个人的气泡
//   ⑥ 她给这个聊天设的背景图
// 全靠 <style> 在 head 里的先后决胜（同权重、都带 !important，后来的赢），
// 所以只能有一个出口一次性按顺序重排——各写各的 append，顺序必然乱。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 真跑那一段：桩掉 document，看它到底按什么顺序把几张 style 挂上去
const runLook = look => {
  const order = [], byId = {};
  const el = id => byId[id] || (byId[id] = { id: id, textContent: "" });
  const doc = {
    getElementById: id => byId[id] || null,
    createElement: () => ({ id: "", textContent: "" }),
    head: { appendChild: e => { const i = order.indexOf(e.id); if (i >= 0) order.splice(i, 1); order.push(e.id); byId[e.id] = e; } }
  };
  // createElement 返回的裸对象要能被 put 认领：改写成先建后填 id 的形状
  doc.createElement = () => ({ id: "", textContent: "", get _ () { return 0; } });
  const i = comp.indexOf("let CHAT_LOOK = {};");
  const j = comp.indexOf("// 老名字留着：全局气泡改了就调它");
  assert.ok(i > 0 && j > i, "抠不出 applyChatLook 那一段");
  const fn = new Function("document", "BUBBLE_SKIN", "resolveImg",
    comp.slice(i, j) + "\nreturn applyChatLook;")(doc, { myBg: "#f00", charBg: "#0f0", radius: 8 }, v => v);
  // 桩里的 getElementById 要在 appendChild 之后才认得出来，所以先跑一遍再看顺序
  fn(look); fn(look);
  return { order, byId };
};

const SCOPE = 'html[data-lisa-screen="thread"][data-lisa-char="c1"]';

test("六层按这个顺序挂上去，一层都不许换位", () => {
  const { order } = runLook({ scope: SCOPE, skinCSS: SCOPE + ' [data-wk="chat"]{background-color:#ededed !important;}',
    bubble: { myBg: "#95ec69" }, chatBg: "iv_abc" });
  assert.deepEqual(order, ["wk-char-skin-css", "wk-skin-css", "wk-char-skin-bg-css", "wk-char-bubble-css", "wk-chat-bg-css"],
    "顺序变了——后挂的赢，换位就等于换了谁盖谁");
});

test("⚠️限的是【这一个人的窗口】，不是【单聊这一页】", () => {
  // 别人的聊天窗也是 thread：只按页面限的话，给沈屿白挑的气泡会照样出现在陆闻那儿。
  // 这一条是浏览器里当场撞出来的，不是想出来的。
  const { byId } = runLook({ scope: SCOPE, skinCSS: "", bubble: { myBg: "#95ec69" }, chatBg: "data:image/png;base64,AAA" });
  assert.ok(byId["wk-char-bubble-css"].textContent.startsWith(SCOPE + " "), "给某个人挑的气泡没限到人");
  assert.ok(byId["wk-chat-bg-css"].textContent.startsWith(SCOPE + " "), "背景图没限到人");
  assert.match(byId["wk-char-bubble-css"].textContent, /data-lisa-char/, "只限了页面没限到人");
  // 全局那一份反过来【不许】限：它本来就该管所有地方
  assert.doesNotMatch(byId["wk-skin-css"].textContent, /data-lisa-(screen|char)/, "全局气泡被限住了，别处就没皮肤了");
});

test("不在某个人的聊天窗里时，那几层必须全空", () => {
  // 换人／退回列表的那一瞬间，上一个人的皮肤不许还留在页面上
  const { byId } = runLook({ scope: "", skinCSS: 'x [data-wk="chat"]{background:#000 !important;}',
    bubble: { myBg: "#95ec69" }, chatBg: "data:image/png;base64,AAA" });
  ["wk-char-skin-css", "wk-char-skin-bg-css", "wk-char-bubble-css", "wk-chat-bg-css"]
    .forEach(id => assert.equal(byId[id].textContent, "", id + " 还留着上一个人的"));
});

test("跟随全局＝那一层是空的，不是写一份跟全局一样的", () => {
  const { byId } = runLook({ scope: SCOPE, skinCSS: "", bubble: null, chatBg: "" });
  assert.equal(byId["wk-char-skin-css"].textContent, "");
  assert.equal(byId["wk-char-bubble-css"].textContent, "");
  assert.equal(byId["wk-char-skin-bg-css"].textContent, "");
  assert.equal(byId["wk-chat-bg-css"].textContent, "");
  assert.ok(byId["wk-skin-css"].textContent.length > 0, "全局那一份不该跟着空掉");
});

test("背景图当 url() 用之前要洗干净：逃不出那对引号", () => {
  const { byId } = runLook({ scope: SCOPE, chatBg: 'a.png") ;} body{display:none' });
  const css = byId["wk-chat-bg-css"].textContent;
  // 判据不是「里面有没有那串字」——它留在引号里是死的。判据是【逃没逃出去】：
  // 花括号仍旧只有一对，url( 和它的收尾之间没有第二个引号。
  const v = /url\("([^"]*)"\)/.exec(css);
  assert.ok(v, "url() 那对引号被打断了");
  assert.ok(v[1].indexOf('"') < 0 && v[1].indexOf("\\") < 0, "值里还留着能逃出引号的字符");
  // 把整段 url("…") 挖掉再数括号：留在引号里的花括号是死的，跑到外面才算逃出去
  const bare = css.replace(/url\("[^"]*"\)/, "url()");
  assert.equal((bare.match(/\{/g) || []).length, 1, "花括号被撑开了＝真跑出去了");
  assert.equal((bare.match(/\}/g) || []).length, 1, "同上");
});

test("⚠️别把 data: 图洗坏了——它自己就带分号", () => {
  const { byId } = runLook({ scope: SCOPE, chatBg: "data:image/png;base64,iVBORw0KGgo=" });
  assert.match(byId["wk-chat-bg-css"].textContent, /url\("data:image\/png;base64,iVBORw0KGgo="\)/,
    "顺手把 ; 也删了的话，她上传的每一张背景图都会坏掉");
});

test("这个人的皮肤那层底要再压一次——不然是「微信顶栏配 LINE 的底」", () => {
  const { byId } = runLook({ scope: SCOPE, skinCSS: SCOPE + ' [data-wk="chat"], ' + SCOPE + ' [data-wk="body"]{background-color:#ededed !important;}\n' + SCOPE + ' [data-wk="chathead"]{background:#ededed !important;}' });
  const re = byId["wk-char-skin-bg-css"].textContent;
  assert.match(re, /\[data-wk="chat"\]/, "没把聊天页那块底抠出来");
  assert.match(re, /#ededed/);
  assert.ok(re.indexOf("chathead") < 0, "抠多了——这一层只该管底，别把顶栏也搬到气泡上面去");
});

test("App 那头把三样都算好传进来，且皮肤 CSS 跟主题用同一支 scopeCSS 限页面", () => {
  assert.match(app, /const charSkinCSS = \(name, scope\) => \{/, "没有按名字取内置皮肤那一步");
  assert.match(app, /window\.ThemeStudio\.scopeCSS\(hit\[1\], scope\)/,
    "自己另写了一套加前缀的写法——两处限法迟早不一样");
  assert.match(app, /const lookScope = id => 'html\[data-lisa-screen="thread"\]\[data-lisa-char="' \+ String\(id\)\.replace/,
    "限法里没有人——别人的窗口也是 thread，只限页面等于没限");
  assert.match(app, /setAttribute\("data-lisa-char", inChat \? String\(activeChar\.id\) : ""\)/,
    "没往 <html> 上挂当前是谁，选择器就永远选不中");
  assert.match(app, /applyChatLook\(\{\s*scope: scope,\s*skinCSS: charSkinCSS\(s\.skin, scope\),/, "没把这个人的皮肤传下去");
  assert.match(app, /bubble: \(s\.bubble && typeof s\.bubble === "object"\) \? s\.bubble : null,/, "没把这个人的气泡传下去");
  assert.match(app, /\}, \[activeChar && activeChar\.id, chatSettings, screen\]\);/, "换人／改设置／换页时不重算，等于改了不生效");
  // 存得下来才算数
  assert.match(app, /skin: s\.skin \|\| "",/, "没存这个人的皮肤");
  assert.match(app, /bubble: \(s\.bubble && typeof s\.bubble === "object"\) \? s\.bubble : null,\s*\n\s*apiId:/, "没存这个人的气泡");
});

test("两个选择器都留着【跟随全局】那一档，不然退不回去", () => {
  const i = comp.indexOf('h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.sub } }, "只给 TA 换皮肤")');
  assert.ok(i > 0, "只给 TA 换皮肤那一格没了");
  const seg = comp.slice(i, i + 2600);
  assert.match(seg, /\[\["", "跟随全局"\]\]\.concat\(/, "皮肤那格没有跟随全局");
  assert.match(seg, /\{ key: "", name: "跟随全局"/, "气泡那格没有跟随全局");
  assert.match(seg, /onClick: \(\) => setBubble\(o\.key \? Object\.assign\(\{ _preset: o\.key \}, bubblePresetSkin\(o\.key\)\) : null\)/,
    "气泡那格写的还是全局那一路（applyBubblePreset 会改所有人）");
  assert.ok(seg.indexOf("h(BubbleSkinPresets") < 0, "还挂着那个写全局的按钮排——点一下会把所有人的气泡都改掉");
});
