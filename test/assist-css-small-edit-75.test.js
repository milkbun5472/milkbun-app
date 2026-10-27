// 秋秋改美化只动她说的那一处（她 2026-10-13：「要它改某一个小部分，它的改动会牵扯到我不想改的地方」）
const assert = require("node:assert"); const path = require("node:path");
const fs = require("fs"), vm = require("vm");
const store = {};
const anyFn = new Proxy(function () { return anyFn; }, { get: (t, k) => k === Symbol.toPrimitive ? () => "" : anyFn, apply: () => anyFn });
const ctx = { console, setTimeout, clearTimeout, Promise, JSON, Math, Date, String, Number, Array, Object, RegExp, Error, Set, Map, Symbol,
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: () => {} },
  React: anyFn, h: anyFn, useState: () => [null, () => {}], useEffect: () => {}, useRef: () => ({}), useMemo: f => f(),
  loadJSON: (k, d) => (store[k] ? JSON.parse(store[k]) : d), saveJSON: (k, v) => { store[k] = JSON.stringify(v); return true; } };
ctx.window = ctx; ctx.document = { addEventListener() {}, createElement: () => anyFn };
// 主题工作台的最小替身：存进来的 CSS 记在 saved 里
let saved = { globalCSS: "", pageCSS: { chat: ".a{color:red}\n[data-wk=\"note\"]{font-size:11px}" } };
ctx.ThemeStudio = { load: () => saved, PAGES: [["all","全部"],["chat","单聊"]], unsafeReason: () => "", scopeCSS: c => c,
  save: v => { saved = v; }, saveFull: v => { saved = v; } };
vm.createContext(ctx);
try { vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "assistant.js"), "utf8"), ctx); } catch (e) { console.log("load err", e.message); }
const A = ctx.Assistant; console.log("has", !!A, A && Object.keys(A.TARGETS).includes("theme"));
ctx.ThemeStudio.compile = () => {}; ctx.ThemeStudio.commit = v => { saved = v; };
const run = p => { try { A.apply(p, {}); return "OK " + JSON.stringify(saved.pageCSS.chat); } catch (e) { return "ERR " + e.message; } };
// 原来有 CSS、这条整份写的：不拒（她 2026-10-17 群里弹了好几次），接在旧的后面，旧规则一条不少
assert.match(run({ target: "theme", id: "chat", text: ".b{}" }), /^OK .*\.a\{color:red\}.*font-size:11px.*\.b\{\}/);
saved.pageCSS.chat = ".a{color:red}\n[data-wk=\"note\"]{font-size:11px}";
// 新的那份把旧的原样包进去了：当整份收下，不再重复一遍
assert.equal(run({ target: "theme", id: "chat", text: ".a{color:red}\n[data-wk=\"note\"]{font-size:11px}\n.d{}" }), "OK " + JSON.stringify(".a{color:red}\n[data-wk=\"note\"]{font-size:11px}\n.d{}"));
saved.pageCSS.chat = ".a{color:red}\n[data-wk=\"note\"]{font-size:11px}";
assert.equal(run({ target: "theme", id: "chat", find: "font-size:11px", text: "font-size:13px" }), "OK " + JSON.stringify(".a{color:red}\n[data-wk=\"note\"]{font-size:13px}"));
assert.match(run({ target: "theme", id: "chat", append: true, text: "[data-wk=\"note\"][data-part=\"busy\"]{color:blue}" }), /^OK .*\.a\{color:red\}.*data-part/);
assert.equal(run({ target: "theme", id: "chat", whole: true, text: ".c{}" }), "OK " + JSON.stringify(".c{}"));
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
assert.ok((comp.match(/"data-wk": "note", "data-part"/g) || []).length >= 10, "居中小灰字都要带 data-part");
assert.match(comp, /"data-wk": "cardrow", "data-me": isU \? "1" : "0", "data-kind": m\.kind/);
console.log("ok");
