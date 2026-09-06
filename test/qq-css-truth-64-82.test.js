// 她 2026-09-06（截图）：「秋秋这个能改 css 是假的，应用了也不改」。
//
// ⚠️病根不在写入那一头——applyOne/snippetEdit/ThemeStudio.commit 都是好的，
//   CSS 真的存进去了。问题是【存进去的那段 CSS 一条也匹配不到东西】：
//   模型自己发明了 `.theme-stylelab [data-page="stylelab"]` 这种选择器。
//   它会这么写，是因为秋秋的提示词里关于 theme 只有一句「text 是 CSS」——
//   没告诉它这三件事：
//     ① 这个 App 的样式几乎全是【内联 style】，不带 !important 等于没写；
//     ② 页面 CSS 会被系统【自动加作用域】，自己再加前缀就永远匹配不到；
//     ③ 埋了 data-wk 钩子的只有那几处，别处只能靠通用选择器硬压。
//
// v65.05：聊天页之外主屏也有了自己的一组挂点，于是「哪几页有哪些钩子」
//   收成一张表 WK_SCOPED——不许在旁边再并排开一对 WK_XXX / WK_XXX_PAGES。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => path.resolve(__dirname, "..", f);
const R = f => fs.readFileSync(P(f), "utf8");
const studio = R("js/theme-studio.js"), assistant = R("js/assistant.js");

test("钩子清单只有一份，秋秋引用它、不另抄一份", () => {
  assert.match(studio, /const WK_SCOPED = Object\.freeze\(\[/);
  assert.match(studio, /CSS_BUILTINS, WK_COMMON, WK_SCOPED,/, "没导出去，秋秋拿不到");
  assert.match(assistant, /\(ts\.WK_SCOPED \|\| \[\]\)\.map/, "秋秋没引用那一份");
  assert.match(assistant, /fmt\(g\.hooks\)/, "秋秋没把专有那几组念出来");
  // ⚠️assistant 里不许再铺一份钩子名单
  const shown = assistant.split("\n").filter(l => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  assert.ok(!/data-wk="chathead"[\s\S]{0,200}data-wk="bubble"/.test(shown), "秋秋里又抄了一份钩子表");
});

// ⚠️桩钉在【写它那一头】（stub-from-the-writer.md）：清单里每一个钩子，
//   都必须真的作为 data-wk 属性出现在源码里。谁哪天改了属性名或删了一个点，
//   这条当场红——不然秋秋会照着一张过期的地图写 CSS，而且照样不报错。
test("清单上的每个钩子，源码里都真的挂着", () => {
  const src = ["js/components.js", "js/screens.js", "js/phone.js", "js/dwell.js", "js/fanfic.js", "js/app.js"]
    .map(f => { try { return R(f); } catch (e) { return ""; } }).join("\n");
  // ⚠️只认【后面跟着一句中文说明】的那种行，别把 pages 里的 ["thread","gthread"] 也捞进来
  // ⚠️收在 TOKENS 之前：那张表长得一模一样（["bg","这一页的底色"]），但它是【八支色】不是挂点
  const blk = studio.slice(studio.indexOf("const WK_COMMON"), studio.indexOf("const TOKENS = Object.freeze(["));
  const names = [...blk.matchAll(/\["([a-z]+)", "[^"]*[\u4e00-\u9fa5]/g)].map(m => m[1]);
  assert.ok(names.length >= 30, "抠出来的钩子太少：" + names.length);
  assert.ok(!names.includes("thread") && !names.includes("gthread"), "把页名当成钩子捞进来了");
  // ⚠️三种挂法都算数：直接写 "data-wk": "x"、写在同一行的三元里（组件格 / 装饰格那种）、
  //   或者作为 wk 属性传给共用组件（GlassPane、IArrow 自己转成 data-wk）
  const hung = n => new RegExp('"data-wk":[^\n]*"' + n + '"').test(src)
    || src.indexOf('wk: "' + n + '"') >= 0 || src.indexOf('wk="' + n + '"') >= 0;
  const missing = names.filter(n => !hung(n));
  assert.deepEqual(missing, [], "清单上有、源码里没挂：" + missing.join("、"));
});

test("每一页都有的那几个挂点，挂在【共用组件】上而不是一页一页补", () => {
  // ⚠️她 2026-09-06：「既然做了那就得让他是真的」。
  //   补法照 Avatar 那条已经写在源码里的教训：「挂点长在组件自己身上，不在调用点上」——
  //   一页一页去补是补不完的，补完也会漏下一页。
  assert.match(studio, /const WK_COMMON = Object\.freeze\(\[/);
  assert.match(studio, /CSS_BUILTINS, WK_COMMON, WK_SCOPED,/, "没导出去，秋秋拿不到");
  const comp = R("js/components.js");
  // Head 一处挂上 → 九十来页的顶栏一起有
  const head = comp.slice(comp.indexOf("function Head({"), comp.indexOf("function Sheet({"));
  assert.match(head, /"data-wk": "head"/, "顶栏整条没挂");
  assert.equal((head.match(/"data-wk": "headink"/g) || []).length, 3, "返回键/标题/右侧操作位都要挂");
  assert.match(head, /"data-wk": "headdim"/, "副标题那行没挂");
  assert.match(head, /IArrow, \{ size: 18, color: INK, wk: "headink" \}/, "返回箭头的描边也得能改");
  // 其余三个共用组件
  const sheet = comp.slice(comp.indexOf("function Sheet({"), comp.indexOf("function Toggle({"));
  assert.match(sheet, /"data-wk": "sheet"/, "半窗没挂（八十来处）");
  assert.match(comp.slice(comp.indexOf("function Eyebrow({"), comp.indexOf("function Empty({")), /"data-wk": "eyebrow"/);
  assert.match(comp.slice(comp.indexOf("function Empty({"), comp.indexOf("function Head({")), /"data-wk": "empty"/);
  // 页面最外那层底
  assert.match(R("js/app.js"), /"data-wk": "app",\n\s*className: "w-full flex flex-col relative overflow-hidden"/, "页面外壳没挂");
});

test("聊天页专有的那几个还在，内置皮肤也只给那两页", () => {
  assert.match(studio, /zh: "聊天页", pages: Object\.freeze\(\["thread", "gthread"\]\)/);
  assert.match(studio, /const CSS_BUILTINS = \{ thread: CHAT_SKINS, gthread: CHAT_SKINS \}/);
});

test("秋秋被告知了那三件事，而且被要求【说实话】而不是硬出一份改不动的 CSS", () => {
  const note = assistant.slice(assistant.indexOf("function themeCssNote"), assistant.indexOf("const SHAPE"));
  assert.ok(note.length > 300, "抠不出那一段");
  assert.match(note, /每一条声明都要带 !important/, "没说内联样式压不过");
  assert.match(note, /绝不要自己加 \.theme-xxx 或 \[data-page=\.\.\.\] 这类前缀/, "没说系统会自动加作用域");
  // ⚠️v65.09 起这一行不再说「每一页都有」：有些页面自己手写了顶栏和控件，
  //   那几个挂点在它身上压根不存在（文风台就是），说满了就是一张会骗人的地图。
  assert.match(note, /【共用件上的（顶栏/, "没说清这几个是挂在共用件上的");
  assert.ok(!/【每一页都有】/.test(note), "又说成「每一页都有」了——有些页自己手写，没有这些挂点");
  assert.match(note, /"  【只有" \+ g\.zh/, "没分清哪些是某几页专有的");
  assert.match(note, /别去猜别的类名/, "没挡住它自己发明选择器");
  assert.match(note, /没有单独的钩子/, "没说清做不到的是哪一类");
  assert.match(note, /先说实话/, "没要求它承认改不动");
  assert.match(note, /别硬出一份改不动的 CSS 糊弄过去/);
  assert.match(note, /fmt\(ts\.WK_COMMON\)/, "没把每页都有的那几个发过去");
  // 真的拼进了那段提示词，不是算了没人用（v55.95 那个形状）
  assert.match(assistant, /\+ \(pages \? "，或某一页：" \+ pages : ""\) \+ "）\\n" \+ themeCssNote\(\)/, "算了没拼进去");
});

test("拿不到主题工作台时安静降级，别把整段提示词搞崩", () => {
  const note = assistant.slice(assistant.indexOf("function themeCssNote"), assistant.indexOf("const SHAPE"));
  assert.match(note, /if \(!ts \|\| !ts\.WK_COMMON\) return "";/);
});
