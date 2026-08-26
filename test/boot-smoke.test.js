const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ROOT = path.join(__dirname, "..");

// 开屏即崩的守门人。已经吃过两次同一个亏：
//   · Codex db3e7ae：真声档 canLive 写在 isGroup 声明之前，TDZ，一开就白屏；
//   · 我 v56.31：calEventsRef.current = calEvents 写在 calEventsRef 声明之前，同一个形状。
// 两次都是 node --check 通过、每个组件单独渲染也通过——**只有真的把整个 App 跑一遍才看得见**。
// 这里就干这件事：按 index.html 的顺序加载全部脚本，然后调一次 App()。
// React 换成只记结构的假货、hooks 打桩，所以不需要浏览器，也不会真发请求。
function boot() {
  const files = fs.readFileSync(path.join(ROOT, "index.html"), "utf8").split("\n")
    .filter(l => l.includes('<script src="')).map(l => l.match(/src="([^?"]+)/)[1]);
  const noop = () => {};
  const stubEl = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    appendChild: noop, removeChild: noop, setAttribute: noop, getAttribute: () => null, addEventListener: noop,
    removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], insertBefore: noop, remove: noop,
    focus: noop, click: noop, dataset: {}, children: [], textContent: "", innerHTML: "" });
  const ctx = {
    console: { log: noop, warn: noop, error: noop, info: noop }, Math, Date, JSON, Promise, Array, Object, String, Number,
    Boolean, RegExp, Error, Map, Set, WeakMap, WeakSet, Symbol, Proxy, Reflect, Intl, parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent, setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
    structuredClone: x => JSON.parse(JSON.stringify(x)), requestAnimationFrame: f => setTimeout(f, 0), cancelAnimationFrame: noop,
    document: Object.assign(stubEl(), { getElementById: () => null, createElement: stubEl, head: stubEl(), body: stubEl(),
      documentElement: stubEl(), visibilityState: "visible", cookie: "", readyState: "complete" }),
    localStorage: { _d: {}, getItem(k) { return this._d[k] == null ? null : this._d[k]; }, setItem(k, v) { this._d[k] = String(v); },
      removeItem(k) { delete this._d[k]; }, key(i) { return Object.keys(this._d)[i] || null; }, get length() { return Object.keys(this._d).length; } },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    indexedDB: { open: () => ({ addEventListener: noop, result: null }) },
    navigator: { userAgent: "node", language: "zh-CN", serviceWorker: { register: () => Promise.resolve() }, clipboard: {} },
    location: { href: "http://x/", protocol: "http:", hostname: "x", search: "", reload: noop },
    history: { pushState: noop, replaceState: noop }, URL: function () {},
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve("") }),
    btoa: s => Buffer.from(String(s)).toString("base64"), atob: s => Buffer.from(String(s), "base64").toString(),
    performance: { now: () => 0 }, crypto: { getRandomValues: a => a, randomUUID: () => "u" },
    AbortController: function () { this.signal = {}; this.abort = noop; }, TextEncoder, TextDecoder,
    Blob: function () {}, FileReader: function () {}, Audio: function () { return stubEl(); }, Image: function () { return stubEl(); },
    matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
    addEventListener: noop, removeEventListener: noop, alert: noop, confirm: () => true, prompt: () => null,
    speechSynthesis: { getVoices: () => [] }, SpeechSynthesisUtterance: function () {},
    MutationObserver: function () { this.observe = noop; this.disconnect = noop; },
    ResizeObserver: function () { this.observe = noop; this.disconnect = noop; },
    IntersectionObserver: function () { this.observe = noop; this.disconnect = noop; }
  };
  ctx.URL.createObjectURL = () => ""; ctx.URL.revokeObjectURL = noop;
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.top = ctx;
  const el = (type, props, ...ch) => ({ type, props, ch });
  ctx.React = { createElement: el, useState: i => [typeof i === "function" ? i() : i, noop], useEffect: noop,
    useLayoutEffect: noop, useRef: () => ({ current: null }), useCallback: f => f, useMemo: f => f(),
    useContext: () => ({}), createContext: () => ({ Provider: "P", Consumer: "C" }), Fragment: "F", memo: f => f, StrictMode: "S" };
  ctx.ReactDOM = { createRoot: () => ({ render: noop }), render: noop, flushSync: f => f(), createPortal: x => x };
  vm.createContext(ctx);
  const failed = [];
  files.forEach(f => {
    if (f.indexOf("vendor/") === 0) return;
    let src; try { src = fs.readFileSync(path.join(ROOT, f), "utf8"); } catch (e) { return; }
    try { vm.runInContext(src, ctx, { filename: f }); }
    catch (e) { failed.push(f + " → " + e.constructor.name + ": " + e.message); }
  });
  return { ctx, failed };
}

test("index.html 里的每个脚本都加载得起来", () => {
  assert.deepEqual(boot().failed, []);
});

test("App() 调得动——TDZ / 拼错的名字 / 漏定义的常量都会在这里现原形", () => {
  const { ctx } = boot();
  let out;
  assert.doesNotThrow(() => { out = ctx.App(); },
    "App 一抛，用户看到的就是白屏：node --check 和单个组件的渲染都拦不住这一类");
  let n = 0;
  (function walk(x) { if (!x) return; if (Array.isArray(x)) return x.forEach(walk);
    if (x.type !== undefined) { n++; walk(x.ch); walk(x.props && x.props.children); } })(out);
  assert.ok(n > 0, "App 渲染出来是空的");
});

// 这一条钉的是具体那次事故：ref 的赋值必须在它自己的声明之后
test("每个 xxxRef.current = 的赋值都排在它的声明之后", () => {
  const src = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8").split("\n");
  const declAt = {}, bad = [];
  src.forEach((l, i) => {
    const d = /^\s*const\s+(\w+Ref)\s*=\s*useRef\(/.exec(l);
    if (d && declAt[d[1]] == null) declAt[d[1]] = i;
  });
  src.forEach((l, i) => {
    // 只看 App 顶层那一层（缩进正好两格）——渲染时就会执行的才踩得到 TDZ；
    // 嵌在回调里的等到被调用时早就初始化好了，不算。
    const a = /^ {2}(\w+Ref)\.current\s*=\s*[^=]/.exec(l);
    if (!a) return;
    const d = declAt[a[1]];
    if (d != null && i < d) bad.push("js/app.js:" + (i + 1) + " 用了 " + a[1] + "，但它到第 " + (d + 1) + " 行才声明");
  });
  assert.deepEqual(bad, []);
});
