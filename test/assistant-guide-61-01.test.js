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
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    loadJSON: (k, d) => { try { return k in store ? JSON.parse(store[k]) : d; } catch (e) { return d; } },
    callAI: async (act, sys) => { box.calls++; box.sys = sys; return box.reply || '{"reply":"好","patches":[]}'; },
    // ⚠️照 engine.js 里那两个真家伙来：extractJSON 会先把所有围栏（```）全局删掉
    //   再解析。桩要是不删，测试就跑在一条现实里不存在的路上——
    //   洗正文那把刀实际收到的是【裸代码行】，不是带围栏的代码块。
    parseJSONLoose: s => { try { return JSON.parse(String(s).replace(/```(?:json)?/gi, "")); } catch (e) { return null; } },
    extractJSON: s => { try { return JSON.parse(String(s).replace(/```(?:json)?/gi, "")); } catch (e) { return null; } },
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
test("整页和小球是同一段对话，落在存档里，能清空", () => {
  assert.match(src, /const CHAT_KEY = "x_assistChat";/);
  assert.match(src, /const \[msgs, setMsgs\] = useState\(A\.loadChat\);/, "对话没从存档里读，关掉就没了");
  assert.match(src, /const before = A\.loadChat\(\);/, "发的时候拿的不是存档里那份，两处会各说各的");
  assert.match(src, /const clear = \(\) => \{ setDone\(\{\}\); put\(\[\]\); \};/);
  // 攒着不封顶就是又一座坟场（phone-data-layers.md）
  assert.match(src, /const CHAT_KEEP = 60;/);
  assert.match(src, /\.slice\(-CHAT_KEEP\)/);
  // 上下文真的发回去了
  assert.match(src, /\(history \|\| \[\]\)\.slice\(-14\)/);
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
  assert.match(src, /\("prompt" in d\) \? String\(d\.prompt\) : DEFAULT_PROMPT/, "按了清空，下次读还是默认那份，等于清空是假的");
  // 头像走图库存引用，不把 base64 塞进配置
  assert.match(src, /imgToVault/, "头像直接存 base64 会把本地存储撑爆");
});

test("预设里只放【它是谁】，安全面和契约不许混进去（她删得掉的东西不能是那些）", () => {
  const m = src.match(/const DEFAULT_PROMPT = \[([\s\S]*?)\]\.join\("\\n"\);/);
  assert.ok(m, "找不到默认预设");
  const p0 = m[1];
  assert.match(p0, /秋秋/);
  assert.match(p0, /你必须诚实/);
  assert.doesNotMatch(p0, /style |persona |appearance |theme |memory /, "能改哪几样混进预设里了——她删一行就等于把白名单删了");
  assert.doesNotMatch(p0, /JSON|patches|框架|代码/, "输出契约或代码那道门混进预设里了");
  // 清空了也得知道自己是谁，不然退回一张通用助手的脸
  assert.match(src, /cfg\.prompt\.trim\(\) \|\| \("你是「" \+ cfg\.name \+ "」/);
});

// 她 2026-09-03：「给它和我也放头像框，它的头像预设画一只小肥鸟」
test("两边都有头像框；它默认是那只程序画的小肥鸟", () => {
  assert.match(src, /function QiuBird\(/);
  assert.match(src, /h\(QiuFace, \{ cfg: props\.cfg, size: av, radius: 9 \}\)/, "它这边没头像");
  assert.match(src, /h\(MeFace, \{ profile: props\.profile, size: av, radius: 9 \}\)/, "我这边没头像");
  // 换过照片就用照片，没换就是鸟
  assert.match(src, /cfg\.avatarImage\s*\?\s*h\(Avatar,/);
  // 鸟得是画出来的，不是一个 emoji 或者外链图
  const bird = src.slice(src.indexOf("function QiuBird("), src.indexOf("window.QiuBird"));
  assert.ok((bird.match(/h\("(ellipse|circle|path|rect)"/g) || []).length >= 10, "这只鸟画得太潦草");
  assert.doesNotMatch(bird, /http|base64/, "头像不许外链");
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
