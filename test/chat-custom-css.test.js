// 每个聊天自己写 CSS，可导出导入（她 2026-09-30）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js"), comp = R("js/components.js");
test("限到这个人这一页、压在最上面", () => {
  assert.match(app, /const charCustomCSS = \(css, scope\) =>/);
  assert.match(app, /window\.ThemeStudio\.resolveCSSImages\(window\.ThemeStudio\.scopeCSS\(css, scope\)\)/);
  assert.match(app, /customCSS: charCustomCSS\(s\.customCSS, scope\)/);
  const i = comp.indexOf('put("wk-chat-bg-css"'), j = comp.indexOf('put("wk-char-custom-css"');
  assert.ok(i > 0 && j > i, "自己写的那层要排在背景图后面（最上面）");
});
test("设置里能写、能导出导入，存档接住且挡掉不安全的", () => {
  assert.match(comp, /"只给 TA 写 CSS"/);
  assert.match(comp, /saveTextFile\(who \+ "-聊天\.css", customCSS, "text\/css"\)/);
  assert.match(comp, /accept: "\.css,\.txt,text\/css,text\/plain"/);
  assert.match(app, /customCSS: \(window\.ThemeStudio && s\.customCSS && !window\.ThemeStudio\.unsafeReason\(s\.customCSS\)\)/);
});

test("聊天那格也给挂点名单和插图按钮，跟主题工作台同一个组件", () => {
  const ui = R("js/theme-studio-ui.js");
  assert.match(ui, /g\.CssHookPicker = CssHookPicker;/);
  assert.match(ui, /g\.CssImageButton = CssImageButton;/);
  assert.match(comp, /h\(window\.CssHookPicker, \{ page: "thread"/);
  assert.match(comp, /h\(window\.CssImageButton, \{ css: customCSS/);
  assert.match(ui, /h\(CssImageButton, \{ css: css, setCSS: setCSS, editorRef: cssEditor/, "工作台没搬过来用同一个");
});

test("换一台手机不错位：<html> 上挂着跟手机走的尺寸变量，挂点那块教怎么用", () => {
  const core = R("js/core.js"), ui = R("js/theme-studio-ui.js");
  ["--app-h", "--app-w", "--app-vh", "--app-kb", "--app-safe-top", "--app-safe-bottom"].forEach(v => assert.ok(core.includes('"' + v + '"'), v));
  assert.match(core, /root\.setAttribute\("data-screen-size", size\)/);
  assert.match(ui, /高度别写死 px/);
  assert.match(ui, /html\[data-screen-size=\\"short\\"\]|html\[data-screen-size="short"\]/);
});

test("长相预览台：草稿铺到真聊天窗、设置页只藏不卸、回去改时按存档重铺", () => {
  assert.match(app, /const paintChatLook = draft =>/);
  assert.match(app, /window\.__previewChatLook = draft => paintChatLook\(draft\)/);
  assert.match(comp, /window\.__previewChatLook\(\{ skin, bubble, font, chatBg, customCSS, layout \}\)/);
  assert.match(comp, /lookPeek \? \{ display: "none" \} : null/);
  assert.match(comp, /h\(ThemePeekBar, \{ zh: cNm \+ " 的聊天长相（还没保存）", onBack: endPeek \}\)/);
});

test("美化 A：每条消息挂上连发头尾、类型、刚进来；单聊群聊同一份", () => {
  assert.match(comp, /function msgRunAttrs\(list, i, part, last, same\)/);
  assert.equal((comp.match(/\.\.\.msgRunAttrs\(messages, i,/g) || []).length, 2, "单聊、群聊两处都要挂");
  const body = comp.slice(comp.indexOf("const MSG_RUN_BREAK"), comp.indexOf("// ── 排版开关"));
  const f = new Function(body + "\nreturn msgRunAttrs;")();
  const L = [{ role: "user" }, { role: "user" }, { role: "assistant" }, { role: "assistant", kind: "narration" }];
  const same = (a, b) => a.role === b.role;
  assert.equal(f(L, 0, 0, true, same)["data-first"], "1");
  assert.equal(f(L, 1, 0, true, same)["data-first"], "0");
  assert.equal(f(L, 1, 0, true, same)["data-last"], "1");
  assert.equal(f(L, 2, 0, true, same)["data-last"], "1", "旁白不算连着说");
});
test("美化 C：排版开关编成 CSS、限到这个人、排在自己写的 CSS 前面", () => {
  const body = comp.slice(comp.indexOf("const CHAT_LAYOUT_DEFAULT"), comp.indexOf("const bubbleDecls"));
  const f = new Function(body + "\nreturn chatLayoutCSS;")();
  assert.equal(f(null), "", "原样就一条都不发");
  const css = f({ bubble: "plain", avatar: "first", name: true, time: "hide", gap: "tight", top: 80 });
  assert.match(css, /:not\(\[data-preview\]\)\{background:transparent/, "长按菜单里那颗仍留气泡，不然深底上读不清");
  assert.match(css, /\[data-first="0"\] \[data-wk="row"\] > \[data-wk="avatar"\]\{visibility:hidden/);
  assert.match(css, /padding-top:80px/);
  assert.match(app, /layoutCSS: \(\(\) => \{ try \{ const c = typeof chatLayoutCSS === "function" \? chatLayoutCSS\(s\.layout\)/);
});
test("长按菜单里那颗气泡跟着美化走；引用块拆成可单独美化的两截", () => {
  assert.match(comp, /"data-wk": "bubble", "data-me": isMine \? "1" : "0", "data-kind": \(message && message\.kind\) \|\| "text", "data-preview": "1"/);
  assert.match(R("js/theme-studio.js"), /\["quoteicon", "/);
  assert.match(R("js/theme-studio.js"), /\["name", "/);
});

test("头像框 / 挂件：TA 和她各一套，编进排版那层 CSS，门牌发出去前换成真地址", () => {
  const body = comp.slice(comp.indexOf("const CHAT_LAYOUT_DEFAULT"), comp.indexOf("// 排版里「头像框 / 挂件」那一行"));
  const f = new Function(body + "\nreturn chatLayoutCSS;")();
  const css = f({ deco: { ta: { frame: "iv_a", frameSize: 140, pend: "iv_b", pendPos: "tl" }, me: { frame: "iv_c" } } });
  assert.match(css, /\[data-me="0"\] \[data-wk="row"\] > \[data-wk="avatar"\]::after\{[^}]*left:-20%;top:-20%;width:140%;height:140%;background:url\("iv_a"\)/);
  assert.match(css, /\[data-me="0"\][^{]*::before\{[^}]*left:-12%;top:-12%;[^}]*url\("iv_b"\)/);
  assert.match(css, /\[data-me="1"\][^{]*::after\{[^}]*url\("iv_c"\)/);
  assert.match(comp, /isU && dsp\.myAvatar && h\("span", \{ "data-wk": "avatar"/, "她那颗没包挂点壳，框会被头像的圆角裁掉");
  assert.match(app, /window\.ThemeStudio\.resolveCSSImages\(window\.ThemeStudio\.scopeCSS\(c, scope\)\)/);
});

test("头像框 / 挂件也能直接贴网上的图片地址", () => {
  const body = comp.slice(comp.indexOf("const CHAT_LAYOUT_DEFAULT"), comp.indexOf("// 排版里「头像框 / 挂件」那一行"));
  const f = new Function(body + "\nreturn chatLayoutCSS;")();
  assert.match(f({ deco: { ta: { frame: "https://x.com/a.png" } } }), /url\("https:\/\/x\.com\/a\.png"\)/);
  assert.match(comp, /placeholder: "或者贴一个图片地址 https:\/\/…"/);
});

test("群聊设置分成六个框，原来那些行都还在", () => {
  const g = comp.slice(comp.indexOf("function GroupSettingsSheet("), comp.indexOf("\nfunction NewGroupSheet"));
  ["群名 · 成员", "记忆互通 · 他们自己聊", "怎么相处", "这个群长什么样", "记忆库 · 群规矩", "清掉"].forEach(x => assert.ok(g.includes('gCard({ title: "' + x + '"'), x));
  // 长相跟单聊那叠卡一样：汉字索引牌 + 一行状态
  assert.match(g, /meta\.char\),/); assert.match(g, /meta\.state\)\),/);
  ["记忆互通", "群里自己聊起来", "默认进线下", "记忆上下文条数", "群聊背景", "清除聊天记录", "删除群聊"].forEach(x => assert.ok(g.includes(x), "丢了：" + x));
});

test("气泡透明度只淡底色：纯色、rgb、渐变都吃得住；100 原样；投影有现成几档", () => {
  const body = comp.slice(comp.indexOf("function bubbleBgAlpha"), comp.indexOf("// 投影的几档现成的"));
  const f = new Function(body + "\nreturn bubbleBgAlpha;")();
  assert.equal(f("#ff0000", 100), "#ff0000");
  assert.equal(f("#ff0000", 50), "rgba(255,0,0,0.50)");
  assert.equal(f("linear-gradient(#fff, rgba(0,0,0,0.8))", 50), "linear-gradient(rgba(255,255,255,0.50), rgba(0,0,0,0.40))");
  assert.match(comp, /q\(bubbleBgAlpha\(S\.myBg, S\.myAlpha\)\)/);
  assert.match(comp, /numRow\("我的气泡不透明度 %", "myAlpha", 0, 100, 100\)/);
  assert.match(comp, /BUBBLE_SHADOWS\.map/);
});

test("群聊设置那几个框平时只露标题，点开才展开", () => {
  const g = comp.slice(comp.indexOf("function GroupSettingsSheet("), comp.indexOf("\nfunction NewGroupSheet"));
  assert.match(g, /const \[gOpen, setGOpen\] = useState\(""\);/);
  assert.match(g, /on \? h\("div", \{ style: \{ padding: "0 14px 16px"/);
});
