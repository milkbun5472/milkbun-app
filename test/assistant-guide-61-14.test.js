// 帮手升级（她 2026-09-03：「程度是像原神的派蒙一样，如果一个新的旅行者进入这个世界
// 问它关于任何功能的问题它都可以回答，但是不会回答任何代码框架的问题。然后做个小悬浮屏
// 可以拖动边和它聊边改动或者研究功能，它也可以做改动比如做 css 装修或者更新人物档案之类的」）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "js/assistant.js"), "utf8");
const manSrc = fs.readFileSync(path.join(root, "js/assistant-manual.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

// 手册是纯数据，直接跑
const MAN = (() => { const g = {}; new Function("window", manSrc)(g); return g.AssistantManual; })();

// 全库唯一那份页名单，从 core.js 里现取
const core = fs.readFileSync(path.join(root, "js/core.js"), "utf8");
const SCREEN_ZH = (() => {
  const i = core.indexOf("const SCREEN_ZH = {"), j = core.indexOf("\n};", i);
  assert.ok(i >= 0 && j > i, "core.js 里找不到 SCREEN_ZH");
  return new Function("return " + core.slice(i + "const SCREEN_ZH = ".length, j + 2))();
})();

// 帮手的脑子抠出来真跑（不含界面）。callAI 是桩，能截下真正发出去的 system。
const A = (() => {
  const i = src.indexOf("(function () {\n  const useState = React.useState;");
  const j = src.indexOf("// ============================================================\n// 界面：");
  assert.ok(i >= 0 && j > i, "抠不出帮手的脑子");
  const store = {};
  const box = { sys: "", calls: 0 };
  const win = { AssistantManual: MAN };
  const sandbox = {
    React: { useState: () => [] }, h: () => null, Svg: null,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    loadJSON: (k, d) => { try { return k in store ? JSON.parse(store[k]) : d; } catch (e) { return d; } },
    callAI: async (act, sys) => { box.calls++; box.sys = sys; return box.reply || '{"reply":"好","patches":[]}'; },
    // ⚠️照 engine.js 里那两个真家伙来：extractJSON 会先把所有围栏（```）全局删掉
    //   再解析。桩要是不删，测试就跑在一条现实里不存在的路上——
    //   洗正文那把刀实际收到的是【裸代码行】，不是带围栏的代码块。
    parseJSONLoose: s => { try { return JSON.parse(String(s).replace(/```(?:json)?/gi, "")); } catch (e) { return null; } },
    extractJSON: s => { try { return JSON.parse(String(s).replace(/```(?:json)?/gi, "")); } catch (e) { return null; } },
    // ⚠️从【core.js 那一份真的】里读出来，不是在这儿另抄一份页名表：
    //   抄一份的话，core.js 哪天加了一页、这条测试照样绿，
    //   而秋秋在那一页上什么都说不出（stub-from-the-writer.md）。
    SCREEN_ZH: SCREEN_ZH,
    window: win
  };
  new Function(...Object.keys(sandbox), src.slice(i, j))(...Object.values(sandbox));
  return { api: win.Assistant, store, box, win };
})();

// ── ① 派蒙那一层：功能问得出来，而且不许现编 ──────────────────
test("手册覆盖到主要的几块，问什么都找得到", () => {
  const ids = MAN.entries.map(e => e.id);
  ["chat", "offline", "group", "call", "phone", "shop", "lore", "memlib",
    "fanfic", "stepin", "trpg", "tarot", "theme", "config", "home"].forEach(k =>
    assert.ok(ids.includes(k), "手册里缺了 " + k));
  assert.ok(MAN.entries.length >= 40, "词条太少，问几句就露馅了");
  // 每条都得说清「在哪儿」——一个新来的人最先要的就是这个
  MAN.entries.forEach(e => {
    assert.ok(e.where && e.what, e.id + " 缺了 where/what");
    assert.ok((e.kw || []).length, e.id + " 没有检索词，问到它也翻不出来");
  });
});

test("目录永远全发，命中的才发全文——两件事都得真的进 system", async () => {
  A.box.calls = 0;
  await A.api.ask({}, { characters: [] }, [], "穿书怎么玩？", "chat");
  assert.match(A.box.sys, /这个 App 有哪些东西 · 目录/);
  assert.ok(A.box.sys.indexOf("· 塔罗（") > 0, "目录没发全，它就不知道这个世界里有什么");
  assert.match(A.box.sys, /书脊/, "问穿书却没把穿书那条详细发过去");
  assert.doesNotMatch(A.box.sys, /腊月|羁绊值会/, "把不相干的词条也塞进去了");
});

test("手册里不许出现存储键 / 文件名 / 框架——那等于给代码那道门自己开个洞", () => {
  MAN.entries.forEach(e => {
    const body = [e.where, e.what, e.how].filter(Boolean).join(" ");
    assert.doesNotMatch(body, /x_[a-z_]+/i, e.id + " 里写了存储键");
    assert.doesNotMatch(body, /[\w-]+\.(js|json|html|css)\b/i, e.id + " 里写了文件名");
    assert.doesNotMatch(body, /react|localstorage|indexeddb|函数|变量/i, e.id + " 里写了代码术语");
  });
  assert.match(manSrc, /只写【怎么用】，不写【怎么做出来的】/, "这条铁律没写在文件里，下一个人还会往里塞");
});

// ── ② 代码那道门：代码兜的，不是提示词兜的 ────────────────────
test("问「怎么造出来的」当场回绝，一次调用都不花", async () => {
  const ctx = { characters: [] };
  for (const q of ["这个用的什么框架？", "给我看看源码", "React 怎么写这个", "数据存在 localStorage 里吗",
                   "fanfic.js 里那个函数是干嘛的", "仓库地址是啥", "前端是怎么实现的"]) {
    A.box.calls = 0;
    const r = await A.api.ask({}, ctx, [], q, "chat");
    assert.equal(A.box.calls, 0, "「" + q + "」还是花了一次调用");
    assert.equal(r.refused, true, "「" + q + "」没被挡住");
    assert.match(r.reply, /怎么玩/);
  }
});

test("「哪儿不对劲」不算代码问题——那是要它帮忙查的", async () => {
  const ctx = { characters: [] };
  for (const q of ["购物有 bug，送到了还显示在路上", "我设的文风没生效", "线下出图老是失败",
                   "API 在哪儿配", "接口填了还是不能用", "怎么把字调大"]) {
    A.box.calls = 0;
    await A.api.ask({}, ctx, [], q, "chat");
    assert.equal(A.box.calls, 1, "「" + q + "」被误挡了");
  }
});

// 一段既有正文又有代码块的回答；CSS 那一版故意把收尾的 } 单独放一行——
// 洗正文那把刀正是按行剔的，所以【这一段被洗过】和【没被洗过】看得出区别。
const DIRTY = "可以这样改：\n```css\nbody { color: red }\n```\n改完就好了。";
const CSS = "body {\n  font-size: 17px;\n}";

test("答完还要洗一遍：正文里不许留代码块", () => {
  const clean = A.api.scrubCode(DIRTY);
  assert.doesNotMatch(clean, /```/);
  assert.doesNotMatch(clean, /color: red/);
  assert.match(clean, /改完就好了/, "把正文也洗没了");
  assert.doesNotMatch(A.api.scrubCode("const x = 1;\n这句要留下"), /const x/);
  assert.match(A.api.scrubCode("const x = 1;\n这句要留下"), /这句要留下/);
});

test("这把刀真的架在 ask 上了，不是摆着好看", async () => {
  // ⚠️只测 scrubCode 本身是不够的：把 ask 里那一句调用删掉，函数照样是对的，
  //   测试照样绿——她收到的却是一整段代码。所以要从 ask 的出口验。
  A.box.reply = JSON.stringify({ reply: DIRTY, patches: [] });
  const r = await A.api.ask({}, { characters: [] }, [], "帮我看看", "chat");
  A.box.reply = null;
  assert.doesNotMatch(r.reply, /```/, "ask 出来的正文里还留着代码块");
  assert.doesNotMatch(r.reply, /color: red/, "围栏被上游剥掉之后，裸的代码行漏出去了");
  assert.doesNotMatch(r.reply, /^\s*css\s*$/m, "围栏剥掉后剩下的那个语言名也要扫掉");
  assert.match(r.reply, /改完就好了/);
});

test("洗的只有正文，装修那一栏的 CSS 不许洗", async () => {
  A.box.reply = JSON.stringify({ reply: "给你调大了字号。", patches: [
    { target: "theme", id: "global", title: "字调大", text: CSS }] });
  const r = await A.api.ask({}, { characters: [] }, [], "把字调大一点", "chat");
  A.box.reply = null;
  assert.equal(r.patches.length, 1);
  assert.equal(r.patches[0].text, CSS, "把它要动手改的东西也洗掉了，等于这个能力没了");
  // 反过来确认这段 CSS 确实会被那把刀改坏——不然这条断言等于没测
  assert.notEqual(A.api.scrubCode(CSS), CSS, "样本挑得不对：洗不洗它都一样，测不出来");
});

// ── ③ 能动手的那几样 ──────────────────────────────────────────
test("装修走主题工作台那一层，不另写一套 CSS 校验", () => {
  const seg = src.slice(src.indexOf("    theme: {"), src.indexOf("    memory: {"));
  assert.match(seg, /unsafeReason/, "没做安全扫描");
  assert.match(seg, /\.compile\(next\)/, "没先编一遍：编不过的 CSS 落库就把整个 App 弄变形了");
  assert.match(seg, /\.commit\(next\)/);
  assert.doesNotMatch(seg, /@import|花括号/, "自己又抄了一套校验规则");
});

test("档案只许改白名单里那几栏，不是整张卡", () => {
  const ctx = { characters: [{ id: "c1", name: "他", tagline: "旧签名" }], onPatchCharacter: () => {} };
  assert.throws(() => A.api.apply({ target: "profile", id: "c1", field: "npc", text: "1" }, ctx), /没有「npc」这一栏/);
  assert.throws(() => A.api.apply({ target: "profile", id: "c1", field: "", text: "x" }, ctx), /没有「空」这一栏/);
  let got = null;
  A.api.apply({ target: "profile", id: "c1", field: "tagline", text: "新签名" },
    { characters: ctx.characters, onPatchCharacter: (id, p) => { got = { id, p }; } });
  assert.deepEqual(got, { id: "c1", p: { tagline: "新签名" } });
  // 改前要按 field 取，不然她是在盲改
  assert.equal(A.api.before({ target: "profile", id: "c1", field: "tagline" }, ctx), "旧签名");
});

// ── ④ 小悬浮屏 ────────────────────────────────────────────────
test("小球能拖、位置记得住、夹得回屏内", () => {
  const seg = src.slice(src.indexOf("function AssistantDock("));
  assert.match(seg, /onPointerDown: onDown/);
  assert.match(seg, /saveDock\(\{ \.\.\.loadDock\(\), x: now\.x, y: now\.y \}\)/, "拖完不存位置，下次又回原处");
  assert.match(seg, /Math\.max\(6, Math\.min\(x, vw\(\) - w - 6\)\)/, "不夹回屏内的话，拖出去就点不着了");
  assert.match(seg, /顶上这条就是把手/, "窗口本身拖不动");
});

// 她 2026-09-03：「小球搞个 toggle 吧，现在有时候不触发」
test("点开走 click，不挂在 pointerup 上——手指抖两下不该算拖", () => {
  const seg = src.slice(src.indexOf("function AssistantDock("));
  assert.match(seg, /onClick: \(\) => \{ if \(!swallowIfDragged\(\)\) setOpen\(true\); \}/,
    "点开还挂在 pointerup 上的话，十次里有几次会被当成拖");
  assert.doesNotMatch(seg, /onPointerUp: onUp\(/, "旧的那套 pointerup 兼当点击还留着");
  // 真拖过要把紧接着那个 click 吞掉，否则一拖完就弹开
  assert.match(seg, /const swallowIfDragged = \(\) => \{ if \(movedRef\.current\) \{ movedRef\.current = false; return true; \}/);
  // 门槛得按手指来，不是按鼠标
  const m = seg.match(/const MOVE_MIN = (\d+);/);
  assert.ok(m && Number(m[1]) >= 6, "拖的门槛太小，按下去抖一下就被当成拖了");
});

test("量屏高跟 App 外壳同一把尺子，底部留白跟主聊天输入栏同一把尺子", () => {
  // 她 2026-09-03：「聊天框下面又太高了没有遵循规则」——
  // iOS 独立 app 里 window.innerHeight 是小视口，比外壳的 100vh 矮一截，
  // 拿它算浮窗就浮在半空、底下空一大条。
  assert.match(src, /const vhOf = \(\) => \{[\s\S]*?getElementById\("root"\)/, "还在拿 innerHeight 当屏高");
  const seg = src.slice(src.indexOf("function AssistantDock("));
  assert.doesNotMatch(seg, /window\.innerHeight/, "浮窗里还直接用着 innerHeight");
  assert.match(src, /style\.cssText = "position:fixed;left:-9999px;height:" \+ COMPOSER_PAD_BOTTOM/,
    "底部留白没照 COMPOSER_PAD_BOTTOM 量，等于自己拍了个数");
  assert.match(seg, /const maxY = H - hh - sb - 8;/, "夹回屏内时没把安全区算进去");
  // 整页那一版的输入栏也照同一把尺子
  assert.match(src, /paddingBottom: "calc\(" \+ COMPOSER_PAD_BOTTOM \+ " \+ 10px\)"/);
});

test("三处共用同一套气泡和改动稿卡片，不是各抄一份", () => {
  assert.equal((src.match(/function PatchCard\(/g) || []).length, 1);
  assert.equal((src.match(/function useAssistChat\(/g) || []).length, 1);
  assert.equal((src.match(/function Bubbles\(/g) || []).length, 1);
  assert.equal((src.match(/h\(PatchCard, \{ key: p\.pid/g) || []).length, 1, "卡片被抄成了两处");
  assert.match(src, /h\(Bubbles, \{ C: C, ctx: props, profile: props\.profile, cfg: cfg \}\)/, "整页没用公共气泡");
  assert.match(src, /h\(Bubbles, \{ C: C, ctx: props, profile: props\.profile, cfg: cfg, compact: true \}\)/, "悬浮屏没用公共气泡");
});

// 她 2026-09-03：「把问改和查毛病合并一起」
test("两档合成一档：查毛病的那套话直接进主提示词，不再另开一个模式", () => {
  assert.doesNotMatch(src, /setMode\("diagnose"\)/, "「查毛病」那个开关还在");
  assert.doesNotMatch(src, /mode === "diagnose"/, "还按模式分叉");
  assert.match(src, /查毛病的时候先看下面的现状快照/, "合并之后查毛病那套话也跟着没了");
  // ask 不该再收一个没人用的 mode——声明了没人引用比压根没写更坏
  assert.match(src, /async function ask\(active, ctx, history, text\)/);
});

// 她 2026-09-03：「它聊天也要有上下文然后可以清空」
// （封顶数和窗口大小别冻在这儿——底下「上下文按字数收」那条按判据管着，
//   这里只管「有没有落盘、发的时候读的是不是同一份、清不清得掉」。）
test("整页和小球是同一段对话，落在存档里，能清空", () => {
  assert.match(src, /const CHAT_KEY = "x_assistChat";/);
  assert.match(src, /const \[msgs, setMsgs\] = useState\(A\.loadChat\);/, "对话没从存档里读，关掉就没了");
  assert.match(src, /const before = A\.loadChat\(\);/, "发的时候拿的不是存档里那份，两处会各说各的");
  assert.match(src, /const clear = \(\) => \{ A\.clearAsking\(\); put\(\[\]\); \};/);
  // 真跑一遍：写进去读得出来，清空之后是空的
  A.api.saveChat([{ role: "me", text: "一" }]);
  assert.equal(A.api.loadChat().length, 1);
  A.api.saveChat([]);
  assert.equal(A.api.loadChat().length, 0);
});

// 她 2026-09-03：「开个设置页预设帮手名字叫秋秋，参考一下这个提示词写个可以改的预设」
test("设置页：名字、头像、主人格提示词、小球开关", () => {
  assert.match(src, /const DEFAULT_NAME = "秋秋";/);
  assert.match(src, /function AssistantSetup\(/);
  assert.match(src, /"主人格提示词"/);
  ["默认", "清空", "保存"].forEach(b => assert.ok(src.indexOf('btn("' + b + '"') > 0, "设置页缺了「" + b + "」"));
  assert.match(src, /put\(\{ ballOn: !cfg\.ballOn \}\)/, "小球没有开关");
  assert.match(src, /if \(!cfg\.ballOn\) return null;/, "开关关了小球还在");
  // 清空之后不许把默认那份又发回去
  // v62.05 这一句多了一层：她那份原样等于某一版旧默认（＝从没自己动过）时自动跟上新的。
  // 但「用 in 判、不用 ||」这个要害没变——她按清空存的是空串，走 || 会被当成没设过。
  assert.match(src, /prompt: \("prompt" in d\)/, "按了清空，下次读还是默认那份，等于清空是假的");
  assert.match(src, /LEGACY_PROMPTS\.indexOf\(String\(d\.prompt\)\) >= 0 \? DEFAULT_PROMPT : String\(d\.prompt\)/,
    "她那份还是旧默认时没自动跟上——改了默认她那边就永远不变");
  // 头像走图库存引用，不把 base64 塞进配置
  assert.match(src, /imgToVault/, "头像直接存 base64 会把本地存储撑爆");
});

test("预设里只放【它是谁】，安全面和契约不许混进去（她删得掉的东西不能是那些）", () => {
  const m = src.match(/const DEFAULT_PROMPT = \[([\s\S]*?)\]\.join\("\\n"\);/);
  assert.ok(m, "找不到默认预设");
  const p0 = m[1];
  assert.match(p0, /秋秋/);
  // v62.05 换成她亲手给的那一份；「诚实」那条还在，只是换了说法
  assert.match(p0, /不知道的事情不要猜，没有的功能不要编/);
  assert.doesNotMatch(p0, /style |persona |appearance |theme |memory /, "能改哪几样混进预设里了——她删一行就等于把白名单删了");
  assert.doesNotMatch(p0, /JSON|patches|框架|代码/, "输出契约或代码那道门混进预设里了");
  // 清空了也得知道自己是谁，不然退回一张通用助手的脸
  assert.match(src, /cfg\.prompt\.trim\(\) \|\| \("你是「" \+ cfg\.name \+ "」/);
});

// 她 2026-09-03：「给它和我也放头像框，它的头像预设画一只小肥鸟」
// v61.43 她给了自己的图：「左边是头像右边是图标」——程序画的那只换成她那张。
test("两边都有头像框；它默认是她给的那只小鸡", () => {
  assert.match(src, /function QiuBird\(/);
  assert.match(src, /h\(QiuFace, \{ cfg: props\.cfg, size: av, radius: 9 \}\)/, "它这边没头像");
  assert.match(src, /h\(MeFace, \{ profile: props\.profile, size: av, radius: 9 \}\)/, "我这边没头像");
  // 换过照片就用照片，没换就是那只鸡
  assert.match(src, /cfg\.avatarImage\s*\?\s*h\(Avatar,/);
  const bird = src.slice(src.indexOf("function QiuBird("), src.indexOf("window.QiuBird"));
  assert.match(bird, /src: "img\/qiu-avatar\.png"/);
  // 仍旧不许外链、不许把图 base64 塞进 js（那是要跟着 PWA 一起装的东西）
  assert.doesNotMatch(bird, /https?:|base64/, "头像不许外链或内嵌 base64");
  // 原图带透明底，得自己垫一层，否则深色主题下浅黄糊进背景只剩两只眼睛
  assert.match(bird, /background: "#f7ecd6"/, "没垫底色");
});

test("挂在 App 里，但一根手指都没碰主屏那几样", () => {
  assert.match(app, /if \(!window\.AssistantDock \|\| call \|\| ringing\) return null;/, "通话时也压着一颗球");
  assert.match(app, /h\(window\.AssistantDock, \{/);
  // 主屏那几样一个都不许动（.claude/rules/home-screen-layout.md）
  assert.match(app, /const _safeTop = \{ height: screen === "home" \? "env\(safe-area-inset-top\)" : 0 \};/);
  assert.match(app, /height: "100vh"/);
  // 手册要先于帮手加载，不然第一次问功能时它手上是空的
  const iM = index.indexOf("js/assistant-manual.js"), iA = index.indexOf("js/assistant.js");
  assert.ok(iM > 0 && iA > iM, "手册没挂上，或者挂在了帮手后面");
});

// 她 2026-09-03：「还可以跟随全局 api 或者单独设定一个」
test("线路：不选＝跟随全局，选了就走那条；解析只写一处", () => {
  assert.match(src, /apiId: d\.apiId \|\| ""/, "配置里没有这一栏");
  // 解析是一个函数，三处共用
  assert.match(src, /function activeFor\(ctx\) \{/);
  assert.match(src, /const hit = cfg\.apiId && \(ctx\.apiProfiles \|\| \[\]\)\.find\(p => p && p\.id === cfg\.apiId\);/);
  assert.match(src, /return hit \|\| \(ctx && ctx\.active\) \|\| null;/, "挑的那条不在了要退回全局，不能直接断线");
  // 界面里不许再各写一遍
  assert.equal((src.match(/cfg\.apiId && \(ctx\.apiProfiles/g) || []).length, 1, "解析被抄成了两处");
  // 收发真的用解析出来的那条，不是原样的 ctx.active
  assert.match(src, /const act = A\.activeFor\(ctx\);/);
  assert.match(src, /await A\.ask\(act, ctx, before, q\)/, "还在拿没解析过的那条发请求");
  assert.doesNotMatch(src, /A\.ask\(ctx\.active,/);
});

test("设置页摆得出来，而且照线下/后台那两栏的形状", () => {
  assert.match(src, /"秋秋走哪条线路"/);
  assert.match(src, /line\("", "跟随全局",/, "第一行不是「跟随全局」");
  assert.match(src, /list\.map\(p => line\(p\.id, nameOf\(p\), p\.model/, "底下没有一行一条线路");
  assert.match(src, /put\(\{ apiId: id \|\| "" \}\)/);
  // 挑过的线路被删掉了要说清楚，不能默默换一条
  assert.match(src, /原来挑的那条线路不在了/);
  // 一条都没配过的时候得给条路走
  assert.match(src, /还没配过线路，去 设置 · 文字模型 加一条/);
});

test("App 把线路表和全局那条都递下去了，两处都递", () => {
  assert.match(app, /h\(window\.AssistantDock, \{[\s\S]{0,400}?active: active,\s*\n\s*apiProfiles: apiProfiles,/, "小悬浮屏没收到线路表");
  assert.match(app, /h\(AssistantApp, \{[\s\S]{0,400}?active: active,\s*\n\s*apiProfiles: apiProfiles,/, "整页没收到线路表");
  // 秋秋的设置页也要收到，不然那一栏画不出来
  assert.match(src, /h\(AssistantSetup, \{ toast: props\.toast, apiProfiles: props\.apiProfiles, active: props\.active,/);
});

// ── 她 2026-09-03 的三条 ────────────────────────────────────────
// 二十来张卡、每张四千多字——她真实的局面
const many = Array.from({ length: 20 }, (_, i) => ({
  id: "c" + i, name: i === 3 ? "V" : "角色" + i,
  persona: "他是二十八岁的总裁。".repeat(350), appearance: "高"
}));
const cardOf = (snap, name) => snap.角色.find(x => x.名字 === name);

test("在说谁，那张卡就必须是全的", () => {
  // 「我之前问它人设的事它说看不到全部」→ 原来砍到 220 字。
  // v61.05 换成群聊那一层的额度，还是不行——那个额度是【按在场人数分总预算】的，
  // 二十来张卡摊下来每张只剩 1500 字（地板），V 的卡照样断在半截。
  // ⚠️借层要连它的理由一起借：群聊要摊是因为一份 system 里装五张卡，
  //   这份快照装的是她【所有】角色，理由压根不成立。
  const snap = A.api.snapshot({ characters: many }, "宝宝你看看 V 的人设卡有点 ooc");
  const v = cardOf(snap, "V");
  assert.equal(v.这张卡是否完整, true, "点了名的那张还是半截");
  assert.equal(v.人设.length, many[3].persona.length, "给过去的不是全文，是 " + v.人设.length + " 字");
  assert.doesNotMatch(src, /人设: clip\(c\.persona, 220\)/, "220 那把刀还在");
  // 判「有没有【调用】它」，不是「文件里有没有这个词」——
  // 上头那段注释就是写给下一个人看的（别再借那个按人数摊的额度），得留着。
  assert.doesNotMatch(src, /groupPersonaBudget\(/, "又借回那个按人数摊的额度了");
  assert.match(src, /借层要连它的理由一起借/, "为什么撤掉它的原因没留下，下一个人还会借回来");
  // 没在说的那些只给开头，而且卡上写明它不完整——不写明它只能靠猜
  const other = cardOf(snap, "角色7");
  assert.equal(other.这张卡是否完整, false);
  assert.ok(other.人设.length <= 320, "没在说的那些也全给了，白花一堆上下文");
  assert.match(other.注意, /别照这半截改/);
  // 它能改的那几栏，快照里也得看得见，不然是在盲改
  ["一句话简介", "生日", "性别", "出图定妆", "出图常服", "出图配饰"].forEach(k =>
    assert.ok(k in v, "档案里的「" + k + "」它看不见"));
});

test("角色少的时候索性全给，没必要挑", () => {
  const few = many.slice(0, 3).map(c => ({ ...c, persona: "他是二十八岁的总裁。".repeat(60) }));
  const snap = A.api.snapshot({ characters: few }, "随便问问");
  few.forEach(c => assert.equal(cardOf(snap, c.name).这张卡是否完整, true, c.name + " 没给全"));
});

test("「你再看看呢」也算在说 V——判据看的是整段对话，不是最后一句", () => {
  // 她上一句常常一个名字都不带，名字在前面提的。只看当前这一句，卡就又变成半截。
  const hist = [{ role: "me", text: "宝宝你看看 V 的人设卡有点 ooc" }, { role: "it", text: "抓到几个软肋…" }];
  const sys = A.api.buildSystem({ characters: many, profile: { name: "Lisa" } }, "宝宝你再看看呢", hist);
  const grab = n => (new RegExp('"名字": "' + n + '",[\\s\\S]*?"这张卡是否完整": (true|false)').exec(sys) || [])[1];
  assert.equal(grab("V"), "true", "这一句没提名字，V 的卡就又断了");
  assert.equal(grab("角色7"), "false", "顺手把所有人的卡都全给了");
  // 找名字用的就是【要发出去的那段窗口】，跟发的是同一份文本
  assert.match(src, /const focus = chatWindow\(history\)\.map/);
  // 一段长对话里提过八个人，也不能八张全卡一起塞
  assert.match(src, /const SNAP_FULL_MAX = 4;/);
  const hot = A.api.focusIds(many, "角色1 角色2 角色5 角色7 角色9 V", 4);
  assert.equal(hot.size, 4, "封不住数");
  assert.ok(hot.has("c3"), "最后提到的那个（V）该排在最前");
  // 提示词里要说清那一栏怎么用，不然它照旧嘴上说「我看不到」
  assert.match(src, /这张卡是否完整/);
  assert.match(src, /为 true 就是全文，放心照它出 patch、别再说自己看不到/);
});

test("上下文按字数收，不再死板地只发最近几条", () => {
  // 她 2026-09-03：「上下文可以放开点反正按次计费」
  assert.doesNotMatch(src, /\(history \|\| \[\]\)\.slice\(-1?[0-9]\)/, "还在按条数砍");
  assert.match(src, /const msgs = chatWindow\(history\)\.map/);
  const many = Array.from({ length: 80 }, (_, i) => ({ role: i % 2 ? "it" : "me", text: "字".repeat(40) }));
  assert.equal(A.api.chatWindow(many).length, 80, "八十条短消息也该全发");
  // 真有人贴了几篇长文进来，也不能把窗口撑爆
  const huge = Array.from({ length: 80 }, () => ({ role: "me", text: "字".repeat(5000) }));
  assert.equal(A.api.chatWindow(huge).length, A.api.CTX_MIN, "长的时候没收住");
  assert.ok(A.api.CTX_CHARS >= 40000, "窗口给得太紧了：按次计费，省这些字一分钱省不到");
  assert.ok(A.api.CHAT_KEEP >= 150, "存档留太少");
  assert.match(src, /\.slice\(-CHAT_KEEP\)/, "存档不封顶就是又一座坟场");
});

test("两个界面永远是同一段对话——小悬浮屏从不卸载，得有人喊它", () => {
  // 「退出界面聊天记录又没了」：整页里聊完退出去，再点开小球看见的是空的。
  // 病根是小球挂在 App 根上、换页也不重建，手里一直是自己那份旧的内存副本；
  // 「进来时读一次」修不好它——它压根没有「再进来」这回事。
  assert.match(src, /const chatSubs = new Set\(\);/);
  assert.match(src, /chatSubs\.forEach\(fn => \{ try \{ fn\(a\); \} catch \(e\) \{\} \}\);/, "落盘的时候没喊");
  assert.match(src, /useEffect\(\(\) => A\.onChat\(setMsgs\), \[\]\);/, "界面没听这一声");
  assert.match(src, /const put = list => \{ A\.saveChat\(list\); \};/, "还在自己 setState，那就只有自己换");
  // 真跑一遍：两个订阅者，其中一个写，另一个要收到
  const seen = [];
  const off1 = A.api.onChat(l => seen.push("A:" + l.length));
  const off2 = A.api.onChat(l => seen.push("B:" + l.length));
  A.api.saveChat([{ role: "me", text: "一" }, { role: "it", text: "二" }]);
  assert.deepEqual(seen, ["A:2", "B:2"], "有人没收到");
  off1(); off2();
  A.api.saveChat([]);
  assert.deepEqual(seen, ["A:2", "B:2"], "退订之后还在收");
});

// ── 她 2026-09-03：「他是能实际修改卡了吗宝宝比如里面改一小段。
//    或者能生成实际 css 应用到界面」──────────────────────────────
test("改一小段：只动那一段，别处一个字节都不动", () => {
  const orig = "他二十八岁。\n\n他会先理解你，会等你。\n\n他不摆霸总架子。\n\n他尊重你的决定。";
  const out = A.api.snippetEdit(orig, "他会先理解你，会等你。", "他会先理解你，但不代表他会让步——他等得起，也算得清。");
  assert.match(out, /他会先理解你，但不代表他会让步/);
  // 前后一个字节都不许变
  assert.ok(out.startsWith("他二十八岁。\n\n"), "前面被动过了");
  assert.ok(out.endsWith("\n\n他不摆霸总架子。\n\n他尊重你的决定。"), "后面被动过了");
  assert.equal(out.split("他尊重你的决定").length, 2, "别处被顺手改写了");
});

test("抄不准就不许硬改——找不到、或者有好几处，都要当场报错", () => {
  const orig = "他会等你。中间。他会等你。";
  assert.throws(() => A.api.snippetEdit(orig, "他会等你。", "改了"), /不止一处/);
  assert.throws(() => A.api.snippetEdit(orig, "他压根没说过这句", "改了"), /找不到/);
  assert.throws(() => A.api.snippetEdit(orig, "  ", "改了"), /没说要改原文里的哪一段/);
  // 空白对不上是常事（重抄时换了换行）：折成 \s+ 再找一次，按原文边界切
  const wrapped = "他二十八岁。\n他会\n先理解你。\n他不摆架子。";
  const out = A.api.snippetEdit(wrapped, "他会 先理解你。", "他会先算清。");
  assert.equal(out, "他二十八岁。\n他会先算清。\n他不摆架子。");
  // 折了空白之后【撞出好几处】的，也一样不许硬改——
  // 这一档比逐字歧义更容易漏：逐字看是一处，折了空白就成了两处。
  // ⚠️两处都得是「逐字对不上、折了空白才对上」的，不然走的是逐字那条路，测不到这一档
  const twice = "他会\n等你。中间。他会\t等你。";
  assert.throws(() => A.api.snippetEdit(twice, "他会 等你。", "改了"), /找不到/);
});

test("只看过半截就不许整段替换——代码拦，不指望它自觉", () => {
  // 它自己一直在担心这件事（「我不能把半截当全文直接出 patch」），
  // 但那只是降概率：模型高兴起来照样会出，那张四千字的卡当场只剩 300 字。
  // ⚠️开头那一句要在整份里【只出现一次】，不然被歧义那道闸挡下来，测的就不是这条了
  const long = "他二十八岁，是这家公司的总裁。\n" + "他做事有自己的判断。".repeat(400);
  const many = Array.from({ length: 20 }, (_, i) => ({ id: "c" + i, name: "角色" + i, persona: long }));
  const ctx = { characters: many, onPatchCharacter: () => { throw new Error("不该走到写入口"); } };
  A.api.snapshot({ characters: many }, "随便问问");          // 这一轮只给了开头 300 字
  assert.throws(() => A.api.apply({ target: "persona", id: "c7", text: "短短一句" }, ctx),
    /只看过这一栏的前 \d+ 字/);
  // 同一张卡，这一轮给了全文 → 整段替换放行
  let got = null;
  A.api.snapshot({ characters: many }, "看看角色7");
  A.api.apply({ target: "persona", id: "c7", text: "重写过的整份人设" },
    { characters: many, onPatchCharacter: (id, p) => { got = { id, p }; } });
  assert.deepEqual(got, { id: "c7", p: { persona: "重写过的整份人设" } });
  // 改一小段【不受这道闸限制】——它本来就不会碰别处
  let got2 = null;
  A.api.snapshot({ characters: many }, "随便问问");
  A.api.apply({ target: "persona", id: "c7", find: "他二十八岁，是这家公司的总裁。", text: "他二十九岁，是这家公司的总裁。" },
    { characters: many, onPatchCharacter: (id, p) => { got2 = p; } });
  assert.ok(got2 && got2.persona.length === long.length, "改一小段被那道闸挡住了");
});

test("记忆库不吃这一套（它是往里加的，没有原文那一段）", () => {
  assert.throws(() => A.api.apply({ target: "memory", id: "c1", find: "x", text: "y" }, {}), /不能改一小段/);
});

test("只改一小段的时候，界面摆的就是那一小段", () => {
  assert.match(src, /p\.find\s*\n?\s*\? h\("div"/, "两种改法没分开摆");
  assert.match(src, /"原文这一段"/);
  assert.match(src, /别处一个字都不动/);
  // find 要真的一路带到 patch 上，不然界面和 apply 都看不见它
  assert.match(src, /find: String\(x\.find \|\| ""\),/);
  // 提示词里要把两种改法说清，并且默认走「改一小段」
  assert.match(src, /改一小段（默认走这个）/);
  assert.match(src, /find 必须在原文里【只出现一次】/);
  assert.match(src, /你【绝对不许】整段替换/);
});

// ── 她 2026-09-03：「我问秋秋的时候退出界面还在生成的回复就没了」
//    「还有应用后退出界面再进来那个应用按钮又出来了」──────────────
test("「还在生成」是共享的，退出去再回来还在转", () => {
  // 查下来回复其实没丢（落盘和喊话都照做了）。真正的毛病是【看着像丢了】：
  // busy 原来是各个界面自己的 state，退出整页那一刻「在想…」跟着组件一起没了，
  // 她回来看见自己那句问话孤零零挂着，只能当它丢了。
  assert.match(src, /let inflight = 0;/);
  assert.match(src, /const \[busy, setBusy\] = useState\(A\.isBusy\);/, "busy 还是各界面自己的");
  assert.match(src, /useEffect\(\(\) => A\.onBusy\(setBusy\), \[\]\);/, "没人听这一声");
  assert.match(src, /A\.bumpBusy\(1\); A\.markAsking\(q\);/);
  assert.match(src, /finally \{ A\.clearAsking\(\); A\.bumpBusy\(-1\); \}/, "出错也得把忙的牌子摘掉，否则永远发不出话");
  // 忙的时候两处都发不出第二句——不然老那条回完接在后面，顺序全乱
  assert.match(src, /if \(!q \|\| A\.isBusy\(\)\) return;/);
  assert.doesNotMatch(src, /if \(!q \|\| busy\) return;/, "还在看自己那份 busy");
  // 真跑一遍
  let seen = [];
  const off = A.api.onBusy(v => seen.push(v));
  assert.equal(A.api.isBusy(), false);
  A.api.bumpBusy(1); assert.equal(A.api.isBusy(), true);
  A.api.bumpBusy(-1); assert.equal(A.api.isBusy(), false);
  A.api.bumpBusy(-1); assert.equal(A.api.isBusy(), false, "减到负数就永远不忙了");
  assert.deepEqual(seen, [true, false, false]);
  off();
});

test("真被系统收走的那次，回来要明说，还要给条重问的路", () => {
  // iOS 把 App 收走（或刷新）时在飞的请求会断，模块里的 inflight 一起归零，
  // 什么痕迹都没有——她那句问话看着就是被吞了。
  assert.match(src, /const ASK_KEY = "x_assistAsking";/);
  A.store[A.api.ASK_KEY] = JSON.stringify({ ts: Date.now(), q: "这一句会被吞掉" });
  assert.equal((A.api.staleAsking() || {}).q, "这一句会被吞掉");
  // 这会儿真在飞的话不算遗留的戳，别弹那条提示
  A.api.bumpBusy(1);
  assert.equal(A.api.staleAsking(), null, "正在生成还弹「没等到回复」");
  A.api.bumpBusy(-1);
  A.api.clearAsking();
  assert.equal(A.api.staleAsking(), null);
  // 界面上摆出来了，两处都摆
  assert.match(src, /function StaleAsk\(props\)/);
  assert.match(src, /上一句没等到回复/);
  assert.match(src, /"再问一次"/);
  assert.equal((src.match(/h\(StaleAsk, \{ C: C/g) || []).length, 2, "整页和小球得都摆");
});

test("改动稿的下场记在存档里，退出再进来按钮不会又冒出来", () => {
  // 她真按第二下的话：往记忆库里就是加两遍，改一小段则会因为找不到原文而报错。
  A.api.saveChat([{ role: "it", text: "给你改一小段", patches: [
    { pid: "p1", target: "persona", id: "cv", title: "改一句", text: "新句" },
    { pid: "p2", target: "memory", id: "cv", title: "加一条", text: "他怕打雷" }] }]);
  A.api.markPatch("p1", "已应用");
  const back = A.api.loadChat()[0].patches;
  assert.equal(back[0].done, "已应用", "应用过没记住，一退出按钮又出来了");
  assert.equal(back[1].done, undefined, "把别的 patch 也标了");
  A.api.markPatch("p2", "跳过了");
  assert.equal(A.api.loadChat()[0].patches[1].done, "跳过了");
  // 界面读的是存档里那一栏，不是自己那份内存 map
  assert.match(src, /state: p\.done, onApply/);
  // ⚠️光测 markPatch 本身不够：把 applyOne 里那句调用删掉，函数照样是对的，
  //   存档里却什么都没记，一退出按钮又冒出来。所以要从 applyOne 里验。
  const one = src.slice(src.indexOf("    const applyOne = p => {"), src.indexOf("    const skip = p =>"));
  assert.ok(one.length > 100, "抠不出 applyOne");
  assert.match(one, /A\.markPatch\(p\.pid, "已应用"\);/, "应用成功了却没记进存档");
  assert.match(one, /A\.markPatch\(p\.pid, "没应用："/, "失败了也得记，否则她会一直重按");
  assert.doesNotMatch(src, /const \[done, setDone\] = useState\(\{\}\)/, "旧的那份内存 map 还在");
  // 代码这一道也拦：已应用的不许再应用一次
  assert.match(src, /if \(p\.done === "已应用"\) return;/);
  A.api.saveChat([]);
});

// ── 她 2026-09-03：「页面上下文和版本回滚也做了吧，
//    还有秋秋的 app 图标也改成小肥鸟吧」──────────────────────────
test("页面上下文：她说「这一页」「他」，有指代对象", () => {
  // 借的是 ai-virtual-phone 那个想法（AGPL，只看不抄）。
  const line = A.api.pageLine({ screen: "thread", charName: "V" });
  assert.match(line, /她此刻在哪儿/);
  assert.match(line, /单聊/);
  assert.match(line, /这一页上是「V」/);
  assert.match(line, /别再反问她是哪一页/);
  // 没人的页面不许硬说「他」
  const solo = A.api.pageLine({ screen: "lore", charName: "" });
  assert.match(solo, /世界书/);
  assert.doesNotMatch(solo, /「他」/, "这一页上没有人，还教它认「他」");
  // 认不出来的页面就一个字都不发，别编一个页面名出来
  assert.equal(A.api.pageLine({ screen: "某个还没登记的页" }), "");
  assert.equal(A.api.pageLine(null), "");
  // 页名从 core.js 那份全库唯一的名单来（v63.44）；这儿只留「这一页对应手册哪一条」
  const info = A.api.pageOf({ screen: "trpg" });
  assert.equal(info.zh, "跑团");
  assert.equal(info.man, "trpg");
  // 登记的 man 必须真在手册里，不然那一栏是死的
  Object.keys(A.api.SCREEN_MAN).forEach(k => {
    const id = A.api.SCREEN_MAN[k];
    if (id) assert.ok(MAN.byId(id), k + " 指着一个手册里没有的词条：" + id);
  });
});

test("这一页上的人算「在说谁」——她一个名字都没提也得给全卡", () => {
  // 站在 V 的聊天里说「他的卡有点 ooc」，指的就是他。
  const many = Array.from({ length: 20 }, (_, i) => ({
    id: "c" + i, name: i === 3 ? "V" : "角色" + i,
    persona: "他二十八岁的总裁。".repeat(350), appearance: "高" }));
  const sys = A.api.buildSystem(
    { characters: many, profile: { name: "Lisa" }, page: { screen: "thread", charName: "V" } },
    "他的卡有点 ooc，你看看", []);
  const grab = n => (new RegExp('"名字": "' + n + '",[\\s\\S]*?"这张卡是否完整": (true|false)').exec(sys) || [])[1];
  assert.equal(grab("V"), "true", "站在他的聊天里问「他」，卡还是半截");
  assert.equal(grab("角色7"), "false");
  // 这一页的手册词条也捎上了，「这一页是干嘛的」不用她先说页名
  assert.match(sys, /【聊天（线上）】/);
  // ⚠️光测 pageLine 本身不够：把 buildSystem 里那句拼接删掉，函数照样是对的，
  //   发出去的 system 里却一个字都没有。所以要从出口验。
  assert.match(sys, /【她此刻在哪儿】她正开着「单聊」/, "那句人话没进 system");
  assert.match(src, /const focus = chatWindow\(history\)[\s\S]{0,200}?here && here\.who/);
});

test("改完能退回来：写之前先存一版，退回走同一个写入口", () => {
  // ⚠️不是「拿备份代替过目」——秋秋照旧先出改动稿由她点头，
  //   这一层管的是【点了应用之后才后悔】那一种。
  A.store["x_assistUndo"] = "[]";
  const chars = [{ id: "cv", name: "V", persona: "旧的那份人设" }];
  let cur = chars[0].persona;
  const ctx = { characters: chars, onPatchCharacter: (id, p) => { cur = p.persona; chars[0].persona = p.persona; } };
  A.api.apply({ pid: "p1", target: "persona", id: "cv", title: "改一改", text: "新的那份人设" }, ctx);
  assert.equal(cur, "新的那份人设");
  const list = A.api.loadUndo();
  assert.equal(list.length, 1, "写之前没存版本");
  assert.equal(list[0].prev, "旧的那份人设", "存的不是旧的那份");
  assert.equal(list[0].pid, "p1", "跟改动稿对不上，卡上那个「撤回」就找不到它");
  A.api.undo(list[0].uid, ctx);
  assert.equal(cur, "旧的那份人设", "退不回去");
  assert.equal(A.api.loadUndo()[0].undone, true);
  assert.throws(() => A.api.undo(list[0].uid, ctx), /已经退回过了/);
  assert.throws(() => A.api.undo("不存在", ctx), /已经不在了/);
});

test("改一小段也要存【动手之前】那一份，不能存成算完的", () => {
  // ⚠️算完再存的话，备份下来的已经是新文本了——等于备份了个假的，退回去还是新的。
  A.store["x_assistUndo"] = "[]";
  const orig = "他二十八岁。\n他会等你。\n他不摆架子。";
  const chars = [{ id: "cv", name: "V", persona: orig }];
  const ctx = { characters: chars, onPatchCharacter: (id, p) => { chars[0].persona = p.persona; } };
  A.api.apply({ pid: "p9", target: "persona", id: "cv", find: "他会等你。", text: "他会等你——但那不是让步。" }, ctx);
  assert.match(chars[0].persona, /但那不是让步/);
  assert.equal(A.api.loadUndo()[0].prev, orig, "备份的是改完之后那一份");
  A.api.undo(A.api.loadUndo()[0].uid, ctx);
  assert.equal(chars[0].persona, orig, "退回去之后不是逐字的原文");
});

test("退不了的那两种要明说，不许假装能退", () => {
  // 记忆库是往里加的，没有写回的路；新建的文风预设没有「原来的样子」。
  assert.equal(A.api.undoable({ target: "memory", id: "cv" }), false);
  assert.equal(A.api.undoable({ target: "style", id: "" }), false);
  assert.equal(A.api.undoable({ target: "style", id: "s1" }), true);
  assert.equal(A.api.undoable({ target: "persona", id: "cv" }), true);
  assert.equal(A.api.undoable({ target: "theme", id: "global" }), true);
  // 界面上也得说清楚，不然她按了没反应
  assert.match(src, /记忆库只进不出，退不了/);
  assert.match(src, /（新建的，退不了）/);
  // 存这一层也要封顶，不然又是一座坟场
  assert.match(src, /const UNDO_KEEP = 40;/);
  assert.match(src, /\.slice\(0, UNDO_KEEP\)/);
});

test("秋秋的 app 图标用她给的那张画；线稿那只留着当兜底", () => {
  // v61.43：走的是【和她自己换图标同一条路】——填进 customSrc，不另开一支渲染。
  const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
  assert.match(comp, /const APP_BUILTIN_ICON = \{ assistant: "img\/qiu-icon\.png" \};/);
  // v61.44：收成一个 appIconSrc——主屏磁贴、文件夹小图、拖动虚影都问它
  assert.match(comp, /const customSrc = appIconSrc\(appKey\);/, "自带图没接进那条现成的路");
  // 她在主题工作台换过的话仍旧她说了算（iconRef 在自带图前面）
  const fn = comp.slice(comp.indexOf("function appIconSrc("));
  assert.ok(fn.indexOf("iconRef(appKey)") < fn.indexOf("APP_BUILTIN_ICON[appKey]"), "她换的图标被自带图盖掉了");
  // 线稿那只还得在：文件夹里 15px 的小图和切换器只认 G 组件
  const g = src.slice(src.indexOf("window.GAssist = p =>"), src.indexOf("const loadJ ="));
  assert.ok(g.length > 200, "抠不出图标");
  assert.doesNotMatch(g, /M19\.6 3\.6a1\.9/, "还是那支笔");
  assert.match(g, /h\(Svg, p,/, "没走 Svg 那一层，就不跟着主题变色了");
  // 眼睛和嘴要单独写 fill，否则在 fill:none 的外层里是两个空圈
  assert.equal((g.match(/fill: \(p && p\.color\) \|\| "currentColor", stroke: "none"/g) || []).length, 3);
  assert.doesNotMatch(g, /#[0-9a-f]{3,6}/i, "图标里写死了颜色，深色主题下就瞎了");
  // 该有的几样：胖身子、呆毛、两只脚
  assert.match(g, /呆毛/); assert.match(g, /两只小脚/);
});
