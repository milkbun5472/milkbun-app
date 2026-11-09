// 她 2026-09-16 转来群里两条：「开屏以后是白屏」「我加入到了主屏幕，现在没法刷新，抓心挠肝」
// ——而她自己好好的。
//
// 病根不在代码，在【有文件没加载进来】：某个 <script src> 拉不下来（边缘节点没同步到、
// 网抖了一下、代理掐了），那一整份就是空的，后面谁引用它谁炸，屏幕上一片白。
// 而 engine.js 里那道兜底用的是 window.addEventListener("error", …)【不带 capture】，
// **资源加载失败根本不冒泡到 window**，那道兜底一次都没响过——错误日志里干干净净。
// 她那边好好的，因为文件她已经有了；有人过一会儿说「哦哦可以了」，重试就好——
// 那正是这个病的签名。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const engine = fs.readFileSync(path.join(root, "js", "engine.js"), "utf8");

// 把那段内联守卫抠出来，在假 DOM 里真跑一遍
function runGuard() {
  const i = html.indexOf("<title>ARCHIVE</title>");
  const seg = html.slice(i, html.indexOf("</script>", i));
  const src = seg.slice(seg.indexOf("<script>") + 8);
  const listeners = [];
  const nodes = [];
  const rootEl = { childElementCount: 0 };
  const timers = [];
  const win = {
    addEventListener: (k, fn, cap) => listeners.push({ k, fn, cap: !!cap }),
    location: { href: "https://x.test/index.html", origin: "https://x.test", reload: () => { win.__reloaded = true; } },
    // ⚠️按【时间先后】跑，不按注册先后（2026-11-05）：最后那道兜底是开头就挂上的，
    //   照注册顺序跑会让它插到 2 秒那条前面去，测出来的顺序跟真浏览器正好相反。
    setTimeout: (fn, ms) => { timers.push({ fn: fn, at: ms || 0, n: timers.length }); return timers.length; },
    document: {
      getElementById: id => (id === "root" ? rootEl : nodes.find(n => n.id === id) || null),
      createElement: () => { const n = { style: { cssText: "" }, setAttribute(k, v) { this[k === "data-boot-guard" ? "guard" : k] = v; }, set innerHTML(v) { this._html = v; const m = v.match(/id="(__bg_\w)"/g) || []; m.forEach(x => nodes.push({ id: x.slice(4, -1) })); }, get innerHTML() { return this._html; } }; return n; },
      body: { appendChild: n => nodes.push(n) }
    },
    URL: URL, caches: undefined, navigator: {}
  };
  new Function("window", "document", "location", "setTimeout", "navigator", "caches", "URL", "Promise", src)
    (win, win.document, win.location, win.setTimeout, win.navigator, win.caches, URL, Promise);
  return { win, listeners, nodes, rootEl, flush: () => timers.splice(0)
    .sort((a, b) => a.at - b.at || a.n - b.n).forEach(t => t.fn()) };
}

test("资源加载失败要抓【捕获阶段】——不抓就一条都收不到", () => {
  const g = runGuard();
  const res = g.listeners.filter(l => l.k === "error" && l.cap);
  assert.equal(res.length, 1, "内联守卫没挂捕获阶段的 error");
  // engine.js 那一处也补上了（它只管记进 x_errlog，屏幕上那道在 index.html）
  assert.match(engine, /\}, true\);/);
  assert.match(engine, /资源加载失败【不冒泡到 window】/);
  assert.match(engine, /log\("asset", "没加载成功："/);
});

test("哪个文件没拉下来就说哪个；屏幕还是空的才说话", () => {
  const g = runGuard();
  const fire = url => g.listeners.find(l => l.cap).fn({ target: { tagName: "SCRIPT", src: url } });
  fire("https://x.test/js/components.js?v=68.99");
  g.flush();
  const card = g.nodes.find(n => n.guard === "1");
  assert.ok(card, "白屏了却没人说一句话");
  assert.match(card.innerHTML, /components\.js/, "没说是哪个文件");
  assert.match(card.innerHTML, /你的存档一个字都没少/, "得先让人别慌");
  assert.match(card.innerHTML, /重新加载/);
  assert.match(card.innerHTML, /清掉离线缓存再加载/, "主屏幕 App 没有地址栏，这颗是她说的「没法刷新」那一颗");
  assert.equal(g.win.__bootGuardShown, true, "engine.js 那条红条该让位");
});

test("谷歌字体连不上是常事，不许拿它吓唬人", () => {
  const g = runGuard();
  g.listeners.find(l => l.cap).fn({ target: { tagName: "LINK", href: "https://fonts.googleapis.com/css2?family=Fraunces" } });
  g.flush();
  assert.ok(!g.nodes.some(n => n.guard === "1" && /没加载进来/.test(n.innerHTML || "")),
    "字体挂了整个 app 照样跑得起来，白屏从来不是它引起的");
  assert.deepEqual(g.win.__assetFail, []);
});

test("app 已经画出来了就别弹——这一条是给白屏用的", () => {
  const g = runGuard();
  g.rootEl.childElementCount = 3;
  g.listeners.find(l => l.cap).fn({ target: { tagName: "SCRIPT", src: "https://x.test/js/tarot.js" } });
  g.flush();
  assert.equal(g.nodes.find(n => n.guard === "1"), undefined);
});

test("这一段必须内联、而且排在所有 script 前面", () => {
  // engine.js 自己也可能是没拉下来的那一个；靠它来兜底等于没兜
  const guard = html.indexOf("data-boot-guard");
  const firstScript = html.indexOf('<script src="vendor/react.production.min.js">');
  assert.ok(guard > 0 && firstScript > guard, "守卫排到 script 后面去了，engine.js 挂掉时就没人说话");
});

test("那颗按钮只碰这个 app 自己的壳缓存，一个字的存档都不动", () => {
  // .claude/rules/never-say-delete-first.md：会让数据消失的事，先说导出。
  // 这颗不会：聊天/记忆/图在 localStorage 和 IndexedDB 里，它碰不到。
  const i = html.indexOf("function nuke()");
  const seg = html.slice(i, html.indexOf("window.__hardReload", i));
  assert.match(seg, /k\.indexOf\("archive-"\) === 0/, "把别人的缓存也删了");
  assert.ok(seg.indexOf("localStorage") < 0 && seg.indexOf("indexedDB") < 0, "碰到存档了");
  assert.match(html, /一个字的存档都不碰/);
});

// 她 2026-09-19：「为啥有些人在国内打不开，重新加载的按钮也没用点不了」
test("谷歌字体不许挡渲染——国内连不上时它是挂着等超时，不是立刻失败", () => {
  const line = html.split("\n").find(l => l.includes("fonts.googleapis.com/css2"));
  assert.ok(line, "找不到字体那一行");
  assert.match(line, /media="print"/,
    "rel=stylesheet 是阻塞渲染的：连不上就白屏，连白屏守卫那颗按钮都点不动");
  assert.match(line, /onload="this\.media='all'"/,
    "拉到了要翻成 all，不然连得上的人也用不上字体");
});

// 她 2026-11-01：「一直白屏」「重进几次、用梯子还是白屏」——文件都拉下来了，app 卡在等本机存档仓库打开
test("开机卡在读本机存档：10 秒后说清卡在哪个仓库", () => {
  const g = runGuard();
  g.win.__bootWait = ["文字存档", "密钥库"];
  g.flush();
  const card = g.nodes.find(n => n.guard === "1");
  assert.ok(card, "卡在 IndexedDB 时屏幕不能一直空着");
  assert.match(card.innerHTML, /文字存档、密钥库/);
  assert.match(card.innerHTML, /你的存档一个字都没少/);
  assert.match(card.innerHTML, /重新加载/);
  assert.equal(g.win.__bootStuckShown, true);
});

test("等齐了、或者界面已经出来了，就不弹「开机卡住」", () => {
  // ⚠️这一条守的是【别弹「开机卡住」那张】。root 一直空着时最后那道兜底照样会说话，
  //   那是对的（2026-11-05 补的），所以按卡片内容判，不是按「一张都没有」。
  const g = runGuard();
  g.win.__bootWait = [];
  g.flush();
  assert.ok(!g.nodes.some(n => n.guard === "1" && /开机卡在读本机存档/.test(n.innerHTML || "")));
  const h = runGuard();
  h.win.__bootWait = ["文字存档"];
  h.rootEl.childElementCount = 2;
  h.flush();
  assert.equal(h.nodes.find(n => n.guard === "1"), undefined, "界面已经出来了就一张都不许弹");
});

test("app.js 开机把还在等的那几样记进 __bootWait，挂上界面后收卡", () => {
  const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
  assert.match(app, /const bootWait = window\.__bootWait = \[\];/);
  assert.match(app, /track\("文字存档", txtP\)/);
  assert.match(app, /track\("密钥库",/);
  assert.match(app, /if \(window\.__bootStuckShown\) document\.querySelectorAll\("\[data-boot-guard\]"\)/);
});

// 她 2026-11-05 转来的截图：封面在、「来这儿·第 5 天」也在，一翻开就是一片白。
// 封面整张是 index.html 自己画的，一行 app 的代码都不用——所以【看得见封面】不代表 app 装上了。
// 上面两条兜底一条要「文件报过错」、一条要「app.js 已经在等存档」，脚本压根没跑起来、
// 或者在 app.js 开口之前就炸了，两条都不响，屏幕就永远白着。最后这一道不管原因只认结果。
test("守到最后：到点 root 还是空的，不管什么原因都得开口", () => {
  assert.ok(html.includes('card("秋秋没装进来"'), "没有最后那一道");
  // 2026-11-08 改：原来这里卡死「只看 root 空不空」。真出事了才发现它分不清
  //   【装不进来】和【还在下载】——公共版装订成一整份，一次更新要重下两三兆，
  //   十四秒不够的人被这张卡劝去换浏览器，一按重新加载又从头下。所以允许多一个前提：
  //   还有文件在路上就先不下判词（见下一条）。root 空不空仍然是唯一的收工条件。
  const m = html.match(/setTimeout\(function \(\) \{\s*var root = document\.getElementById\("root"\);\s*if \(\(shown && !stillLoading\(\)\) \|\| \(root && root\.childElementCount > 0\)\) return;[\s\S]*?\}, (\d+)\);/);
  assert.ok(m, "最后那一道的形状不对：收工只看 root 空不空，别的前提只许是「还在下载」");
  assert.ok(Number(m[1]) >= 12000, "开口太早，网慢的人会被误伤：" + m[1]);
  // 前面两道各自的前提都还在，没被这一道顶掉
  assert.match(html, /if \(shown \|\| !bad\.length \|\|/, "「文件没拉下来」那一道被动了");
  assert.match(html, /if \(shown \|\| !w \|\| !w\.length \|\|/, "「卡在读存档」那一道被动了");
  assert.ok(html.includes("你的存档一个字都没少"), "最吓人的是以为数据没了，这句不能少");
});

test("脚本跑炸了也要留下一句话，不是默默丢掉", () => {
  assert.match(html, /if \(e && e\.message && !jsErr\) jsErr = String\(e\.message\)\.slice\(0, 120\);/,
    "target 是 window 的那种 error 被原样丢了，最后一道就没的说");
  assert.ok(html.includes('jsErr ? "出错了：" + jsErr'), "记下来了却没摆出来");
});

test("在 QQ／微信里打开的，给的办法不一样", () => {
  const m = html.match(/var inapp = (\/[^\n]+?\/i)\.test\(navigator\.userAgent/);
  assert.ok(m, "抠不出内置浏览器那条正则");
  const r = new RegExp(m[1].slice(1, -2), "i");
  ["Mozilla/5.0 (iPhone) QQ/8.9.0", "Mozilla/5.0 (Android) MQQBrowser/13.1",
   "Mozilla/5.0 (iPhone) MicroMessenger/8.0.40"].forEach(ua => assert.ok(r.test(ua), "没认出：" + ua));
  ["Mozilla/5.0 (iPhone) Safari/605.1.15", "Mozilla/5.0 (Macintosh) Chrome/131.0.0.0 Safari/537.36"]
    .forEach(ua => assert.ok(!r.test(ua), "误伤了正经浏览器：" + ua));
  assert.ok(html.includes("用浏览器打开"), "没教她怎么从内置浏览器里出来");
});

// 她 2026-11-08 转来「好多人进去白屏」，截图正是上面那张卡，而且没有「出错了」那半句：
// 没有文件报错、没有 JS 报错、app.js 也没开口。那就还有一种它一直没分清的情况——它还在下载。
test("还有文件在路上就别下判词：先说「还在下载」，等下完了再说", () => {
  assert.match(html, /function stillLoading\(\) \{[\s\S]*?performance\.getEntriesByType\("resource"\)/,
    "没有「还有文件在路上吗」这一问");
  assert.match(html, /script\[src\]/, "要拿页面上的 script 跟下完的名单比，才知道还差几个");
  assert.ok(html.includes('card("还在下载，没卡住"'), "缺那张不吓人的「还在下载」卡");
  assert.match(html, /waited < 60000/, "没有等待上限：下不动的人会被永远吊着");
  assert.match(html, /setTimeout\(function \(\) \{ verdict\(waited \+ 6000\); \}, 6000\)/,
    "摆完「还在下载」要接着再看，不能摆上就不管了");
  assert.ok(html.includes("别反复重新加载"), "这张卡的重点就是别按重新加载——一按就从头下");
  const slow = html.slice(html.indexOf('card("还在下载，没卡住"'));
  assert.ok(slow.slice(0, 400).includes("你的存档一个字都没少"), "这张卡也不能少这句");
});

// 同一张卡要能换内容：先摆「还在下载」，下完了还是空的再换成判词。
test("卡片能换一张，不会叠成两张", () => {
  assert.match(html, /querySelector\('\[data-boot-guard="1"\]'\)/, "新卡上来没把旧卡撤掉");
});
