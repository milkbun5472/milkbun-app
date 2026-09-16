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
    setTimeout: (fn, ms) => { timers.push(fn); return timers.length; },
    document: {
      getElementById: id => (id === "root" ? rootEl : nodes.find(n => n.id === id) || null),
      createElement: () => { const n = { style: { cssText: "" }, setAttribute(k, v) { this[k === "data-boot-guard" ? "guard" : k] = v; }, set innerHTML(v) { this._html = v; const m = v.match(/id="(__bg_\w)"/g) || []; m.forEach(x => nodes.push({ id: x.slice(4, -1) })); }, get innerHTML() { return this._html; } }; return n; },
      body: { appendChild: n => nodes.push(n) }
    },
    URL: URL, caches: undefined, navigator: {}
  };
  new Function("window", "document", "location", "setTimeout", "navigator", "caches", "URL", "Promise", src)
    (win, win.document, win.location, win.setTimeout, win.navigator, win.caches, URL, Promise);
  return { win, listeners, nodes, rootEl, flush: () => timers.splice(0).forEach(f => f()) };
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
  assert.equal(g.nodes.find(n => n.guard === "1"), undefined, "字体挂了整个 app 照样跑得起来，白屏从来不是它引起的");
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
