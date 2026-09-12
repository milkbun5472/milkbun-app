// 她 2026-09-12：「宝宝情侣空间的唱片不能选要听哪首，点击只能编辑刻字」。
//
// 病不在播放那头——app.js 的 discPlay(cid, fromId) 从 v60.63 起就收得下
// 「从哪一首起」（记针位那次加的），**只是这一页从来没给过出口**：
// B 面那一行里唯一能点的地方是刻字那一格，封面和歌名都只是死的 div。
// 「能力早就有了、界面没接上」——跟论坛那次、约定那次是同一个形状。
//
// 顺带：全 app 的歌行（一起听的 cloudRow、查手机那张单）都是
// 【封面能点、歌名能点、右边还有一枚圆的播放键】，这一行是唯一的例外，
// 所以照那个形状补，不另发明一套。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const src = fs.readFileSync(path.join(__dirname, "..", "js/screens.js"), "utf8");

const grab = (a, b) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  assert.ok(i >= 0 && j > i, "抠不出 " + a);
  return src.slice(i, j);
};

// ── 真跑这个组件：拿假 h 收一棵树回来 ─────────────────────────────────
const SONGS = [
  { id: "sgd_1", title: "第一首", artist: "甲", note: "" },
  { id: "sgd_2", title: "第二首", artist: "乙", note: "因为那天下雨" },
  { id: "sgd_3", title: "第三首", artist: "丙", by: "ta" }
];
const render = (props) => {
  const plays = [], sets = [];
  const ctx = {
    h: (type, p, ...kids) => ({ type, props: p || {}, children: kids.flat().filter(x => x != null) }),
    useTheme: () => ({ bg: "#fff", bg2: "#eee", ink: "#222", fog: "#777", line: "#ddd", accent: "#a44", tint: "#57a" }),
    useState: init => [typeof init === "function" ? init() : init, v => sets.push(v)],
    cpSkin: () => ({}), hex6: () => true,
    Head: "HEAD", Eyebrow: "EYEBROW", F_DISPLAY: "d", F_BODY: "b"
  };
  vm.createContext(ctx);
  vm.runInContext(grab("const ic = (kind, c, size) =>", "\n};") + "\n};\n"
    + grab("function CoupleDiscShelf({", "\n}\n") + "\n}\nthis.C = CoupleDiscShelf;", ctx);
  const tree = ctx.C(Object.assign({
    partner: { id: "c1", name: "他" }, data: { songs: SONGS }, nowId: null, playing: false,
    onAdd: () => {}, onRemove: () => {}, onNote: () => {}, onPlay: id => plays.push(id),
    onPlayTop: () => plays.push("TOP"), nextId: "sgd_2", onGen: () => {}, gen: false, onBack: () => {}
  }, props || {}));
  const all = [];
  (function walk(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(walk);
    all.push(n);
    (n.children || []).forEach(walk);
  })(tree);
  return { all, plays, sets };
};
// 一行里能点的那几处：按它落在哪一首上归拢
const buttonsFor = (all, songId) => {
  const row = all.find(n => n.props && n.props.key === songId);
  assert.ok(row, "找不到 " + songId + " 那一行");
  const out = [];
  (function walk(n) { if (!n || typeof n !== "object") return;
    if (n.type === "button" && n.props.onClick) out.push(n);
    (n.children || []).forEach(walk); })(row);
  return out;
};

test("点封面、点歌名、点右边那枚圆键——三处都从这一首落针", () => {
  const r = render();
  const btns = buttonsFor(r.all, "sgd_2");
  // 封面 / 歌名 / 落针键 / ✕：四个可点的地方
  assert.equal(btns.length, 5, "一行里可点的地方数目变了（封面·歌名·刻字·落针·✕）");
  btns.forEach(b => b.props.onClick({ type: "click" }));
  assert.deepEqual(r.plays, ["sgd_2", "sgd_2", "sgd_2"], "点下去没有从这一首起放（或者多点了一处）");
});

test("刻字那一格还在，而且它不放歌", () => {
  const r = render();
  const note = buttonsFor(r.all, "sgd_2").find(b =>
    JSON.stringify(b.children).indexOf("因为那天下雨") >= 0);
  assert.ok(note, "背面那句不见了");
  note.props.onClick({ type: "click" });
  assert.deepEqual(r.plays, [], "点刻字把歌也放了");
  assert.ok(r.sets.indexOf("sgd_2") >= 0, "点了还是打不开刻字那一栏");
});

test("台上那枚「落针／接着放」不许把事件对象当成歌 id 递下去", () => {
  const r = render();
  // onClick 直接挂 onPlay 的话，React 会把事件对象当第一个参数传进来
  const top = r.all.find(n => n.type === "button" && n.props.onClick
    && ["落针", "接着放", "从这首重放"].indexOf(String(n.children[0])) >= 0);
  assert.ok(top, "台上那枚按钮找不到了");
  top.props.onClick({ type: "click", target: {} });
  assert.deepEqual(r.plays, [undefined], "它把事件对象当成「从哪一首起」传下去了");
});

test("父组件：给了歌 id 就从那首起，不给才接着上次那首", () => {
  const line = grab("      onPlay: id => onDiscPlay(", "\n");
  const f = new Function("onDiscPlay", "partner", "discNextIdOf",
    "return (" + line.replace(/^\s*onPlay:\s*/, "").replace(/,\s*$/, "") + ");");
  const got = [];
  const onPlay = f((cid, id) => got.push([cid, id]), { id: "c1" }, () => "sgd_2");
  onPlay("sgd_3"); onPlay();
  assert.deepEqual(got, [["c1", "sgd_3"], ["c1", "sgd_2"]]);
});

test("ic() 提到了模块作用域：情侣唱片这一页也拿得到同一套图标", () => {
  const i = src.indexOf("const ic = (kind, c, size) =>");
  assert.ok(i > 0, "ic 不见了");
  assert.equal(src[i - 1], "\n", "ic 还缩在某个函数里面（前面有缩进就是）");
  assert.ok(i < src.indexOf("function CoupleDiscShelf("), "ic 得在用它的那一页前面");
  assert.ok(src.indexOf("function ListenTogether(") > i, "ic 还在一起听里面");
  // 不许在这一页另画一个三角，也不许退回 ▶（mobile-ui-layout.md）
  const shelf = grab("function CoupleDiscShelf({", "\n}\n");
  assert.match(shelf, /ic\("play", t\.bg2, 14\)/);
  assert.ok(shelf.indexOf("▶") < 0 && shelf.indexOf("M8 5v14l11-7z") < 0, "又自己画了一个播放三角");
});
