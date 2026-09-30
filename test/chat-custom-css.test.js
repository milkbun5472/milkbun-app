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
  // v74.332 那一块搬成公共的 ChatCssFields（单聊、群聊两处调）
  assert.match(comp, /function ChatCssFields\(\{ css, setCSS, fileBase, seedName, seedCSS, onPeek, page, title \}\)/);
  assert.match(comp, /h\(ChatCssFields, \{ css: customCSS, setCSS: setCustomCSS,[\s\S]*?title: "只给 TA 写 CSS" \}\)/);
  assert.match(comp, /saveTextFile\(\(fileBase \|\| "聊天"\) \+ "-聊天\.css", css, "text\/css"\)/);
  assert.match(comp, /accept: "\.css,\.txt,text\/css,text\/plain"/);
  assert.match(app, /customCSS: \(window\.ThemeStudio && s\.customCSS && !window\.ThemeStudio\.unsafeReason\(s\.customCSS\)\)/);
});

test("聊天那格也给挂点名单和插图按钮，跟主题工作台同一个组件", () => {
  const ui = R("js/theme-studio-ui.js");
  assert.match(ui, /g\.CssHookPicker = CssHookPicker;/);
  assert.match(ui, /g\.CssImageButton = CssImageButton;/);
  assert.match(comp, /h\(window\.CssHookPicker, \{ page: page \|\| "thread"/);
  assert.match(comp, /h\(window\.CssImageButton, \{ css: css, setCSS: setCSS, editorRef: editRef/);
  assert.match(ui, /h\(CssImageButton, \{ css: css, setCSS: setCSS, editorRef: cssEditor/, "工作台没搬过来用同一个");
});

test("群聊也有这一堆美化：同一块排版/CSS、限到这一个群、有预览台", () => {
  const g = comp.slice(comp.indexOf("function GroupSettingsSheet("), comp.indexOf("\nfunction NewGroupSheet"));
  assert.match(g, /h\(ChatLayoutFields, \{ layout: gLayout, setLayout: setGLayout, taName: "群成员", group: true/);
  assert.match(g, /h\(ChatCssFields, \{ css: gCss,[\s\S]*?page: "gthread"/);
  assert.match(g, /layout: gLayout, customCSS: gCss \}/, "存的时候没带上");
  assert.match(g, /if \(gPeek\) return h\(ThemePeekBar,/);
  assert.match(app, /'html\[data-lisa-screen="gthread"\]\[data-lisa-group="'/);
  assert.match(app, /window\.__previewGroupLook = draft => paintGroupLook\(draft\)/);
  assert.match(comp, /: h\("span", \{ "data-wk": "avatar", className: "shrink-0", style: \{ display: "inline-flex" \} \}, h\(Avatar, \{ character: character, size: size \|\| 34, radius: 8 \}\)\);/, "群成员头像没包挂点壳，头像框会被裁");
});

test("换一台手机不错位：<html> 上挂着跟手机走的尺寸变量，挂点那块教怎么用", () => {
  const core = R("js/core.js"), ui = R("js/theme-studio-ui.js");
  ["--app-h", "--app-w", "--app-vh", "--app-kb", "--app-safe-top", "--app-safe-bottom"].forEach(v => assert.ok(core.includes('"' + v + '"'), v));
  assert.match(core, /root\.setAttribute\("data-screen-size", size\)/);
  assert.match(ui, /换手机不走样 · 点一下加进去/, "看不懂的变量表换成了现成的几条");
  // 现成那几条搬进 ThemeStudio.sizePresets（按钮和「复制给别的 AI」共用一份）
  const ts = R("js/theme-studio.js");
  assert.match(ui, /studio\.sizePresets\(page\)/);
  assert.match(ts, /calc\(var\(--app-vh\) \* 12\)/);
  assert.match(ts, /html\[data-screen-size=\\"short\\"\]|html\[data-screen-size="short"\]/);
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

test("html[data-screen-size=…] 这种写在 html 自己身上的属性，限作用域后贴在同一个 html 上", () => {
  const src = R("js/theme-studio.js");
  const f = new Function(src.slice(src.indexOf("const unsafeReason"), src.indexOf("  // CSS 里也只保存 iv_")) + "\nreturn scopeCSS;")();
  assert.equal(f('html[data-screen-size="short"] [data-wk="bubble"]{a:b}', 'html[data-lisa-screen="thread"]'),
    'html[data-lisa-screen="thread"][data-screen-size="short"] [data-wk="bubble"]{a:b}');
  assert.equal(f('[data-wk="bubble"]{a:b}', 'html[x]'), 'html[x] [data-wk="bubble"]{a:b}');
});

test("线下和通话也有挂点，并且进了挂点名单", () => {
  ["offline", "offbody", "offcomposer", "offmsg", "offcard", "offname", "offtext", "offsay", "offthought", "offnarr",
   "call", "callhead", "calltitle", "callavatar", "callbody", "callmsg", "callbubble", "callact", "callcomposer", "hangup"].forEach(k => {
    assert.ok(comp.includes('"data-wk": "' + k + '"'), "组件上没挂：" + k);
    assert.ok(R("js/theme-studio.js").includes('["' + k + '", "'), "名单里没有：" + k);
  });
  assert.equal((comp.match(/"data-wk": "offline", className: "absolute inset-0 z-20 flex flex-col"/g) || []).length, 2, "单人线下和群线下都要挂");
});

test("排版多了入场动画、字号行距、顶栏输入栏样子；原样一条都不发", () => {
  const body = comp.slice(comp.indexOf("const CHAT_LAYOUT_DEFAULT"), comp.indexOf("// ── 聊天窗「排版」和「自己写 CSS」那两块"));
  const f = new Function(body + "\nreturn chatLayoutCSS;")();
  assert.equal(f({}), "");
  const css = f({ enter: "rise", fontSize: 16, lineHeight: 1.8, head: "glass", composer: "float" });
  assert.match(css, /@keyframes wkEnterRise/);
  assert.match(css, /\[data-wk="msg"\]\[data-recent="1"\]\{animation:wkEnterRise/);
  assert.match(css, /\[data-wk="bubble"\]\{font-size:16px !important;\}/);
  assert.match(css, /line-height:1\.8 !important/);
  assert.match(css, /\[data-wk="chathead"\]\{background:rgba\(255,255,255,\.55\)/);
  assert.match(css, /\[data-wk="composer"\]\{margin:0 10px 8px !important;border-radius:22px/);
  assert.equal(f({ fontSize: 99 }), "", "越界的字号不发");
});
test("整套美化打包：图一起带走、导进来换成新门牌、别人给的不安全 CSS 不收；单聊群聊两处都有", async () => {
  const body = comp.slice(comp.indexOf("const CHAT_LOOK_KIND"), comp.indexOf("// 那一行按钮：导出这一套"));
  const vault = { iv_old: new Blob(["x"], { type: "image/png" }) };
  let saved = null;
  const env = {
    imgVaultFetchBlob: async r => vault[r] || null,
    imgToVault: async d => "iv_new",
    saveTextFile: async (n, txt) => { saved = { n, txt }; },
    FileReader: class { readAsDataURL(b) { this.result = "data:image/png;base64,eA=="; setTimeout(() => this.onload(), 0); } },
    window: { ThemeStudio: { unsafeReason: css => /@import/.test(css) ? "不允许 @import" : "" } }
  };
  const api = new Function(...Object.keys(env), body + "\nreturn { exportChatLook, importChatLook };")(...Object.values(env));
  await api.exportChatLook({ skin: "仿微信", layout: { deco: { ta: { frame: "iv_old" } } }, customCSS: "[data-wk=\"chat\"]{background:url(iv_old)}" }, "江识");
  assert.equal(saved.n, "江识-美化.json");
  const pack = JSON.parse(saved.txt);
  assert.equal(pack.kind, "chat-look");
  assert.ok(pack.assets.iv_old, "用到的图没带上");
  const look = await api.importChatLook(saved.txt);
  assert.equal(look.layout.deco.ta.frame, "iv_new", "门牌没换成导进来的那张");
  assert.match(look.customCSS, /iv_new/);
  pack.look.customCSS = "@import url(x);";
  const bad = await api.importChatLook(JSON.stringify(pack));
  assert.equal(bad.customCSS, undefined, "不安全的 CSS 被收进来了");
  await assert.rejects(api.importChatLook("{\"kind\":\"theme\"}"), /这不是一份美化文件/);
  assert.equal((comp.match(/h\(ChatLookPack, \{/g) || []).length, 2, "单聊和群聊都要有");
});

test("通话底下是一排大按键，打字框按需拉出来、记住上次开没开", () => {
  const call = comp.slice(comp.indexOf("function CallScreen("), comp.indexOf("function anonNightBg("));
  assert.match(call, /const \[typeOpen, setTypeOpenRaw\] = useState\(\(\) => \{ try \{ return localStorage\.getItem\("x_callTypeOpen"\) === "1"/);
  assert.match(call, /localStorage\.setItem\("x_callTypeOpen", v \? "1" : "0"\)/);
  assert.match(call, /typeOpen \? h\("div", \{ "data-wk": "calltype"/);
  assert.match(call, /bigKey\("挂断",/);
  assert.ok(call.indexOf('bigKey("挂断"') > call.indexOf("canLive ? bigKey("), "挂断要在正中（说话键后面、打字键前面）");
  assert.ok(call.indexOf('bigKey("挂断"') < call.indexOf("bigKey(typeOpen"), "挂断要在正中");
});

test("线下暂离的提醒都撤了（她：我知道我还在线下）", () => {
  assert.doesNotMatch(comp, /h\(OfflineBackBar|liveTag\(|onJumpOffline/);
  assert.doesNotMatch(app, /offlineLiveOf:|onJumpOffline:/);
});

test("从哪儿退下回回哪儿：线下「离开」记 offline、切回「说话」记 online；点进来 offline 且那场还在就回线下", () => {
  assert.match(app, /const LAST_PLACE_KEY = "x_chatLastPlace";/);
  assert.match(app, /const backToScene = lastPlaceOf\(cid\) === "offline" && hasActive;/);
  assert.match(app, /const backToScene = lastPlaceOf\("g:" \+ gid\) === "offline" && hasActive;/);
  assert.match(app, /if \(!settingsFor\(cid\)\.defaultOffline && !backToScene\) return;/);
  assert.match(app, /onExit: \(\) => \{ if \(offlineRoomId === "main" && offlineChar\) setLastPlace\(offlineChar\.id, "offline"\);/);
  assert.match(app, /onClose: \(\) => \{ if \(offlineRoomId === "main" && offlineChar\) setLastPlace\(offlineChar\.id, "online"\);/);
  assert.match(app, /onExit: \(\) => \{ if \(offlineGroup\) setLastPlace\("g:" \+ offlineGroup\.id, "offline"\);/);
});

test("气泡换了底色，主题画的尖角也跟着换色", () => {
  const c = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
  assert.match(c, /\[data-wk="bubble"\]\[data-me="1"\]::before', \["border-left-color:"/);
  assert.match(c, /\[data-wk="bubble"\]\[data-me="0"\]::before', \["border-right-color:"/);
});
