const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const imp = fs.readFileSync(path.join(root, "js/impression.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

// 月度印象：每个月每个角色眼里的「她」——一张剪影 + 三个词 + 一句他亲口说的话
test("月份工具：跨年、补零、区间都要对", () => {
  const grab = name => {
    const i = imp.indexOf("  const " + name + " = ");
    return imp.slice(i, imp.indexOf("\n", imp.indexOf(";", imp.indexOf("=>", i))) + 1);
  };
  const m = new Function(
    "const monthKeyOf = ts => { const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };" +
    "const monthRange = k => { const [y, mm] = String(k).split('-').map(Number); return { start: new Date(y, mm - 1, 1).getTime(), end: new Date(y, mm, 1).getTime() - 1 }; };" +
    "const prevMonths = n => { const out = [], now = new Date(2026, 0, 15); for (let i = 0; i < n; i++) out.push(monthKeyOf(new Date(now.getFullYear(), now.getMonth() - i, 1).getTime())); return out; };" +
    "return { monthKeyOf, monthRange, prevMonths };")();
  assert.equal(m.monthKeyOf(new Date(2026, 7, 20).getTime()), "2026-08", "月份要补零");
  const r = m.monthRange("2026-08");
  assert.equal(new Date(r.start).getDate(), 1);
  assert.equal(new Date(r.end).getMonth(), 7, "月末不能溢出到下个月");
  assert.ok(new Date(r.end + 1).getMonth() === 8);
  assert.deepEqual(m.prevMonths(3), ["2026-01", "2025-12", "2025-11"], "往回数要能跨年");
  // 源码里也得是同一套实现
  assert.match(imp, /padStart\(2, "0"\)/);
  assert.match(imp, /new Date\(y, m, 1\)\.getTime\(\) - 1/);
});

test("剪影是插画不是照片：不给参考照，且明令不画五官", () => {
  const art = imp.slice(imp.indexOf("async function genArt"), imp.indexOf("window.Impression ="));
  assert.match(art, /generateSelfieImage\(prompt, null\)/, "刻意不传参考照——看不见脸，给了只会让它去画五官");
  assert.match(art, /完全看不见五官、没有脸部细节/);
  assert.match(art, /只取发型长度与身形，不画五官/);
  assert.match(art, /不画成头像或证件照/);
  assert.match(art, /可公开展示/);
});

test("quote 必须守声纹，不能写成通用抒情散文", () => {
  const gen = imp.slice(imp.indexOf("async function genText"), imp.indexOf("async function genArt"));
  assert.match(gen, /声纹最高优先/);
  assert.match(gen, /遮住名字也该认得出/);
  assert.match(gen, /别写成通用抒情散文，也别写成人物介绍/);
  assert.match(gen, /用「她」称呼她，不要直呼名字/);
  // 「Ta 眼里」已有的长期印象当底子，别每月推翻重来
  assert.match(gen, /底子，别推翻，只在它上面往前长一点/);
  assert.match(imp, /window\.Gaze && window\.Gaze\.text/);
  // 三个关键词不许同义、不许都在夸她（定死的槽位已废，改成按期轮换取词角度）
  assert.match(imp, /三个之间不许同义，也不许都在夸她/);
  // 出不全就算失败，不许写半张卡
  assert.match(gen, /if \(!quote \|\| !tags\.length\) throw new Error/);
});

test("图出不来不算失败：字是主体，剪影可以之后补", () => {
  const seg = imp.slice(imp.indexOf("async function make"), imp.indexOf("// 只重出剪影"));
  assert.match(seg, /catch \(e\) \{ props\.toast\("字写好了，剪影没出来/);
  assert.match(imp, /e\.img \? "只重出剪影" : "补一张剪影"/, "没图的卡片要能单独补一张");
});

test("补齐：只补有素材的月份，一月一月来，失败即停", () => {
  const seg = imp.slice(imp.indexOf("async function backfill"), imp.indexOf("// ---- 单张卡片"));
  assert.match(seg, /const missing = all\.filter\(k => !have\.has\(k\)\);/, "已经有的不重写");
  assert.match(seg, /M\.monthMaterial\(charId, char\.name, k, uName, props\.groups\)\.length >= 6\)/, "没素材的月份跳过，不硬编");
  assert.match(seg, /if \(!ok\) \{ props\.toast\("补到 " \+ M\.monthLabel\(k\) \+ " 时停下了/, "失败即停，前面的都保留");
  assert.match(seg, /want\.reverse\(\)/, "从最早的一个月往回补，时间顺序才对");
});

test("同一个月重写是覆盖，不是堆两张", () => {
  assert.match(imp, /\[charId\]: \[entry\]\.concat\(\(p\[charId\] \|\| \[\]\)\.filter\(x => x\.monthKey !== monthKey\)\)/);
});

test("三处注册齐全：脚本、图标、路由", () => {
  assert.match(html, /<script src="js\/impression\.js\?v=/);
  assert.match(comp, /impression: \{ kind: "app", zh: "月度印象"/);
  assert.match(comp, /"theater", "impression", "weekly"/, "要真的摆进桌面，不然点不到");
  assert.match(app, /screen === "impression"\) body = h\(ImpressionApp/);
  assert.match(app, /active: offlineActive/);
});

// v54.03：一进页面就白屏。imgSrc 不是全局的（theater.js 自己内部声明的一份），
// 照抄用法没带定义 → ReferenceError → 整个 App 挂掉。
test("用到的每个外部名字都得真有顶层定义，不能想当然", () => {
  const files = fs.readdirSync(path.join(root, "js")).filter(f => f.endsWith(".js") && f !== "impression.js");
  const topLevel = new Set();
  files.forEach(f => fs.readFileSync(path.join(root, "js", f), "utf8").split("\n").forEach(l => {
    const m = /^(?:const|let|var|function|async function)\s+([A-Za-z_$][\w$]*)/.exec(l);
    if (m) topLevel.add(m[1]);   // 顶格声明才跨脚本可见
  }));
  // impression.js 依赖的外部名字，逐个点名——加新依赖时也要加到这里
  ["blobToDataUrl", "imgToVault", "imgVaultFetchBlob", "generateSelfieImage", "callAI",
   "parseJSONLoose", "extractJSON", "imgApiReady", "useTheme", "F_BODY", "F_DISPLAY", "Svg", "resolveImg"]
    .forEach(n => assert.ok(topLevel.has(n), n + " 必须是别处的顶层声明，现在不是"));
  // imgSrc 恰恰不是全局的，所以本模块【必须自己声明一份】
  assert.ok(!topLevel.has("imgSrc"), "imgSrc 至今仍不是全局的（theater 也是自己声明）");
  assert.match(imp, /const imgSrc = ref => \(typeof resolveImg === "function" \? resolveImg\(ref\) : ref\);/,
    "本模块必须自带 imgSrc，不能指望它是全局的");
});

// v54.04：① 点补齐没反应 ② 本月不该能写——要跟周刊一样，等这个月过完
test("只有【已经过完的月】才能写，本月要等下月 1 号 0 点", () => {
  const m = new Function(`
    const monthKeyOf = ts => { const d = new Date(ts); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
    const prevMonths = (n, now) => { const out = [], d = now ? new Date(now) : new Date();
      for (let i = 1; i <= n; i++) out.push(monthKeyOf(new Date(d.getFullYear(), d.getMonth() - i, 1).getTime())); return out; };
    const latestWritable = now => prevMonths(1, now)[0];
    const isWritable = (k, now) => String(k) <= String(latestWritable(now));
    const nextOpenAt = now => { const d = now ? new Date(now) : new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(); };
    return { prevMonths, latestWritable, isWritable, nextOpenAt };`)();

  const 八月二十 = new Date(2026, 7, 20).getTime();
  assert.equal(m.latestWritable(八月二十), "2026-07", "8/20 能写的是 7 月");
  assert.equal(m.isWritable("2026-08", 八月二十), false, "本月不许写");
  assert.equal(m.isWritable("2026-07", 八月二十), true);
  assert.deepEqual(m.prevMonths(3, 八月二十), ["2026-07", "2026-06", "2026-05"], "补齐的候选里不许有本月");

  // 边界：9/1 0 点整，8 月就该开了
  const 九月一日零点 = new Date(2026, 8, 1, 0, 0, 0).getTime();
  assert.equal(m.isWritable("2026-08", 九月一日零点), true, "跨过 0 点上个月立刻可写");
  assert.equal(new Date(m.nextOpenAt(八月二十)).getTime(), 九月一日零点, "下次开写＝下月 1 号 0 点");
  // 跨年
  const 十二月十五 = new Date(2026, 11, 15).getTime();
  assert.equal(m.latestWritable(十二月十五), "2026-11");
  assert.equal(m.latestWritable(new Date(2027, 0, 3).getTime()), "2026-12", "1 月能写去年 12 月");

  // 源码里确实拦住了，而且 UI 说得清
  assert.match(imp, /if \(!M\.isWritable\(monthKey\)\) \{ props\.toast\(M\.monthLabel\(monthKey\) \+ " 还没过完/);
  assert.match(imp, /const openMonth = M\.latestWritable\(\);/);
  assert.match(imp, /本月还在过，写不出这个月你是什么样。/);
});

test("补齐必须永远给回音，不许静默", () => {
  const seg = imp.slice(imp.indexOf("async function backfill"), imp.indexOf("// ---- 单张卡片"));
  // 裸 JSON.parse 抛出去外面没人接 = 点了没反应，这次整段包起来
  assert.match(seg, /\} catch \(e\) \{ return props\.toast\("翻旧账的时候出错了：/);
  assert.match(seg, /if \(busy\) return props\.toast\("正在写，别急"\)/);
  assert.match(seg, /if \(!props\.active\) return props\.toast\("请先配置线下 API"\)/);
  // 三种"没得补"要分清，别一律一句话
  assert.match(seg, /最近一年每个月都写过了/);
  assert.match(seg, /几乎没有来往，写不出印象/);
  // 取素材本身也要带兜底
  assert.match(imp, /const grab = k => \{ try \{/);
  assert.doesNotMatch(imp, /JSON\.parse\(localStorage\.getItem\("x_chat/, "不许再有裸 JSON.parse");
});

// v54.05：① 不够个人化 ② 想只重写文案、别连着刷图 ③ 剪影该跟印象有关
test("逼它扣住真实发生过的事，并给一条可判定的自检", () => {
  assert.match(imp, /const CONCRETE_RULE = /);
  assert.match(imp, /title、tags、quote、silhouette 四样【都】要长在下面那段真实记录上/);
  assert.match(imp, /只有你们俩对得上号的具体东西/);
  // 关键：给【可判定】的检验标准，而不是再喊一句"要具体"
  assert.match(imp, /把她的名字换成任何一个别人——如果这句话照样成立，说明写空了，推翻重写/);
  assert.match(imp, /宁可写得小、写得怪，也别写得大而空/);
  // 给模型具体的钩子：她自己说过的话
  assert.match(imp, /const herLines = \(rows, uName\) =>/);
  assert.match(imp, /quote 可以直接扣住其中一句/);
});

test("剪影要画的是这一期的印象，不是一句孤零零的场景", () => {
  const art = imp.slice(imp.indexOf("async function genArt"), imp.indexOf("window.Impression ="));
  assert.match(art, /async function genArt\(desc, profile, mood\)/);
  assert.match(art, /这幅画要画出的气质·最重要/);
  assert.match(art, /姿态、光线、冷暖、留白多少，全部服务于这几个词/);
  // 两个调用点都要把 tags/title 带上，别只带一个
  assert.equal((imp.match(/M\.genArt\([^)]*\{ tags:/g) || []).length, 2, "生成与重出剪影都要带上这一期的印象");
  // 剪影描述本身也要长在真事上，并和关键词气质一致
  assert.match(imp, /意象【必须从这个月真实发生过的事里长出来】/);
  assert.match(imp, /关键词是冷的，画面就不该是暖的/);
});

test("文案与剪影能分开重来，且不给整张重刷的误触入口", () => {
  assert.match(imp, /async function rewriteText\(charId, entry\)/);
  // 只换字，图原样留着
  assert.match(imp, /Object\.assign\(\{\}, x, \{ title: d\.title, tags: d\.tags, quote: d\.quote, silhouette: d\.silhouette, turn \}\)/,
    "只换这五样，img 原样不动");
  assert.doesNotMatch(imp.slice(imp.indexOf("async function rewriteText"), imp.indexOf("// ---- 单张卡片")), /M\.genArt/,
    "只重写文案的那条路绝不能碰出图");
  assert.match(imp, /"只重写文案"/);
  assert.match(imp, /"只重出剪影"/);
  // 已写过的月份不给整张重来（那会连剪影一起白刷一次）
  assert.match(imp, /hasThis \? props\.toast\("点进那张卡片，可以只重写文案或只重出剪影"\) : make\(curChar, openMonth\)/);
});

// v54.06：两张卡是同一个骨架（我推演了…→她一句话→我的逻辑全部破产），
// 连 title 都是同一个模子。现成的 ANTI_CLICHE 管的是演的时候的毛病，压不住这个。
const dice = () => {
  const grab = name => {
    const i = imp.indexOf("  function " + name + "(");
    let d = 0, j = imp.indexOf("{", i), st = false;
    for (; j < imp.length; j++) { if (imp[j] === "{") { d++; st = true; } else if (imp[j] === "}") { d--; if (st && !d) { j++; break; } } }
    return imp.slice(i, j);
  };
  return new Function(
    imp.slice(imp.indexOf("const TAG_ANGLES"), imp.indexOf("const BANNED_SHAPE")) +
    imp.slice(imp.indexOf("const hashOf"), imp.indexOf("  // 起点按角色")) +
    grab("pickN") + "\nreturn { pickN, QUOTE_FORMS, TAG_ANGLES };")();
};

test("句式骰子：同卡稳定、重写必换、角色之间也不同", () => {
  const m = dice();
  assert.ok(m.QUOTE_FORMS.length >= 10, "写法池要够大");
  const f = (c, t) => m.pickN(m.QUOTE_FORMS, 1, c + "|2026-07|form", t)[0];
  assert.equal(f("c1", 0), f("c1", 0), "同一张卡不许自己重掷");
  const five = [0, 1, 2, 3, 4].map(t => f("c1", 0 + t));
  assert.equal(new Set(five).size, 5, "重写五次必须五种写法——靠哈希碰运气会撞面，实测撞过");
  assert.notEqual(f("c1", 0), f("c2", 0), "两个角色同一个月不该拿到同一种写法");
  // 转满一圈回到起点是可以接受的
  assert.equal(f("c1", 0), f("c1", m.QUOTE_FORMS.length));
});

test("取词角度也轮换，且三个角度互不相同", () => {
  const m = dice();
  const tg = (c, t) => m.pickN(m.TAG_ANGLES, 3, c + "|2026-07|tag", t);
  assert.equal(new Set(tg("c1", 0)).size, 3, "同一张卡的三个角度不许重复");
  assert.notDeepEqual(tg("c1", 0), tg("c1", 1), "重写要换一组角度");
  assert.notDeepEqual(tg("c1", 0), tg("c2", 0));
  // 以前定死槽位（气质/状态/他的私心）——第三格必然长成「拿她没办法」，雷同是规则自己造的
  assert.doesNotMatch(imp, /一个偏气质、一个偏状态、一个偏他自己的私心/, "定死的槽位已经废掉");
});

test("已经写烂的骨架要指着名字禁掉，同义改写也算", () => {
  assert.match(imp, /const BANNED_SHAPE = /);
  assert.match(imp, /我［推演／分析／计算／设想］了很多种/);
  assert.match(imp, /全部［破产／失效／崩塌／被切断］/);
  assert.match(imp, /同义改写也算/);
  assert.match(imp, /「不讲理的X」「不按套路的X」这类【形容词\+抽象名词】的取名法已经用过/);
  assert.match(imp, /BANNED_SHAPE/);
});

test("往期 quote 要喂回去，重写时连自己上一版一起避开", () => {
  assert.match(imp, /你以往几个月写过的话 · 骨架不许重复/);
  assert.match(imp, /句子的【搭法】必须和上面每一句都不一样/);
  // 生成时避开别的月份
  assert.match(imp, /const past = \(book\[charId\] \|\| \[\]\)\.filter\(x => x\.monthKey !== monthKey\)\.map\(x => x\.quote\)/);
  // 重写时把自己上一版也算进去——重写就是为了不要它
  assert.match(imp, /\.concat\(\[entry\.quote\]\)/);
  assert.match(imp, /const turn = Number\(entry\.turn \|\| 0\) \+ 1;/);
  assert.match(imp, /turn: 0, ts: Date\.now\(\)/, "新卡片要记下 turn，重写才知道转到第几面");
});

// v54.07：她说某个角色七月聊了很多，却被告知"没有来往写不了"。
// 原因是取素材只数了单聊和单人线下——而她和顾朝顾暮大半的话是在群里说的。
test("群聊也算素材，但封闭群不算", () => {
  const seg = imp.slice(imp.indexOf("function monthMaterial"), imp.indexOf("// 他自己说过的话"));
  assert.match(seg, /grab\("x_gchat:" \+ g\.id\)/, "群记录要读");
  assert.match(seg, /\(g\.memberIds \|\| \[\]\)\.includes\(charId\)/, "只算他真的在的群");
  assert.match(seg, /if \(!\(gset\[g\.id\] && gset\[g\.id\]\.memoryInterop\)\) return;/,
    "封闭群不算——记忆不进也不出，和周刊同一条规矩");
  // 群里只取他俩的话：别人说什么不构成"他眼里的她"
  assert.match(seg, /if \(!isUser && !isHim\) return;/);
  assert.match(seg, /"【群】" \+ txt/, "标出来源，模型才知道这句是当众说的");
  // 三个调用点都要把 groups 传下去，漏一个就又数不到
  // 四处：生成 / 补齐筛选 / 只重写文案 / 界面上那行素材统计。漏一个就又数不到群
  assert.equal((imp.match(/uName, props\.groups\)/g) || []).length, 4);
  assert.match(app, /groups: groups,\s+\/\/ 群聊也是素材/);
});

test("素材不够时要报出实际条数，别让人猜", () => {
  assert.match(imp, /只找到 " \+ rows\.length \+ " 条你俩的往来（单聊\+单人线下\+互通群）/);
  assert.doesNotMatch(imp, /几乎没有来往，写不出印象"\); return false/, "旧的含糊文案已经换掉");
});

test("取素材走 loadJSON——它会先读 IDB 镜像，聊天记录可能不在 localStorage 里", () => {
  const seg = imp.slice(imp.indexOf("function monthMaterial"), imp.indexOf("// 他自己说过的话"));
  assert.match(seg, /typeof loadJSON === "function" \? \(loadJSON\(k, \[\]\) \|\| \[\]\)/);
  assert.match(seg, /先读 IDB 镜像/);
  // x_chat / x_gchat 都在 engine 的 IDB 文本键前缀里，裸读 localStorage 会漏
  const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
  assert.match(engine, /IDB_TEXT_PREFIXES = \[[^\]]*"x_chat:"/);
  assert.match(engine, /IDB_TEXT_PREFIXES = \[[^\]]*"x_gchat:"/);
});

// v54.08：她说江识七月聊了几百条也显示没有。逻辑本身实测是对的（六条、跨月正确排除），
// 所以要么读不到那份记录、要么记录不在那个月——界面上直接把数字摆出来，别再靠猜。
test("角色页要显示这个月的素材条数，分来源", () => {
  assert.match(imp, /function materialBreakdown\(charId, charName, monthKey, uName, groups\)/);
  assert.match(imp, /const g = rows\.filter\(r => String\(r\.text\)\.indexOf\("【群】"\) === 0\)\.length;/);
  assert.match(imp, /chatAll/, "还要报这个角色一共有多少条聊天记录");
  assert.match(imp, /素材：单聊\+线下 " \+ b\.direct \+ " 条 · 群 " \+ b\.group \+ " 条"/);
  // 关键的分辨句：有记录但不在这个月 vs 根本读不到
  assert.match(imp, /这个角色的聊天记录一共 " \+ b\.chatAll \+ " 条，只是都不在这个月/);
  assert.match(imp, /materialBreakdown/, "要导出给界面用");
  // 统计本身不能把页面搞崩
  assert.match(imp, /try \{ b = M\.materialBreakdown\(/);
});
