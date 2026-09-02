const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
// ⚠️切到【下一个顶格 function】为止。别拿某个具体名字当终点：MemImportSheet 其实定义在
//   MemoryLib【前面】，用它当终点切出来的是空串，五条断言会一起假绿/假红。
const _i = scr.indexOf("function MemoryLib({");
const lib = scr.slice(_i, scr.indexOf("\nfunction ", _i + 10));

// 她 2026-09-02：「记忆库界面和 ui 好看，你参考一下，codex 弄了一部分我觉得还是差点意思」。
// Codex 的骨架（紧凑顶栏、时间轴、维护工具收进抽屉）没问题，差在三处，
// 其中两处是【明确违反已立规矩】的。

test("状态那三档不许是一排药丸", () => {
  // tabs-not-plain-pills：新写的一律不许直接摆一排药丸。
  // 记忆库现实里是一盒卡片，这三档是盒里分出来的三摞：
  // 一摞纸（全部）／折了角的一张（未了）／钉着的一张（常驻）。
  const seg = lib.slice(lib.indexOf('["all", "全部", activeTotal]'), lib.indexOf('characters.length ? h("div", { className: "flex items-end overflow-x-auto"'));
  assert.ok(seg.length > 400, "切片没对上");
  assert.match(seg, /clipPath: id === "open"/, "未了那张的折角没了");
  assert.match(seg, /id === "pinned" \? h\("span"/, "常驻那张的图钉没了");
  assert.match(seg, /id === "all" \? h\(Fragment/, "全部那一摞的纸边没了");
  // 不许只靠填色区分：形状/高度/位置至少还要变一样
  assert.match(seg, /height: on \? 54 : 43/, "选中和没选中高度要不一样");
  // 点得着：40px 手感（tabs-not-plain-pills 第 1 条）
  assert.ok(!/borderRadius: 9,/.test(seg), "药丸圆角还在");
});

test("换人是一排脸，不是一行下划线文字", () => {
  const seg = lib.slice(lib.indexOf('characters.length ? h("div", { className: "flex items-end overflow-x-auto"'));
  const face = seg.slice(0, seg.indexOf('h("div", { className: "flex items-center justify-between"'));
  assert.ok(!/borderBottom: "1\.5px solid "/.test(face), "下划线那版还在");
  assert.match(face, /h\(Avatar, \{ character: c, size: sz/, "这个 app 认人靠脸");
  assert.match(face, /filter: on \? "none" : "grayscale/, "选中/没选中不能只差一个填色");
  assert.match(face, /width: sz, height: sz/);
  // 「所有人」那格是几张脸摞着，一眼看得出它不是某个人
  assert.match(face, /few\.map\(\(x, i\)/);
});

test("情绪不再报数字——画在时间轴那颗点上", () => {
  assert.ok(!/"情绪 " \+ \(\(e\.v \|\| 0\) > 0 \? "\+" : ""\)/.test(lib),
    "「情绪 +4 · 强度 2」是把内部记分板端上桌");
  const dot = lib.slice(lib.indexOf("const rated = typeof e.a === \"number\";"), lib.indexOf("index < list.length - 1"));
  assert.match(dot, /const dia = rated \? 5 \+ a \* 1\.7 : 6/, "大小＝这件事有多重");
  assert.match(dot, /v >= 2 \? "#c98a3c" : v <= -2 \? "#5f7c9a"/, "颜色＝当时的心情");
  assert.match(dot, /border: rated \? "none" : "1px solid "/, "没评过情绪的要是空心的，一眼看得出");
  assert.match(dot, /title: rated \?/, "数字仍要能查到，只是不摆在脸上");
});

test("「快淡了」用的是真判据，不是另编一个分数", () => {
  // 参考那个 app 有个 0-100 的「记忆生命力」，那基于它自己的衰减模型；
  // 我们没有那个模型，硬造一个分数就是编。但我们有【真的】枯萎判据。
  assert.match(lib, /const isFading = e => !!\(e && \(e\.surfaceState \|\| "active"\) === "active" && !e\.pinned && !e\.open\s*\n?\s*&& \(e\.a \|\| 0\) <= 1 && \(e\.hits \|\| 0\) < 2/);
  assert.match(lib, /120 \* 86400000/);
  assert.match(lib, /faded \? "快淡了" : ""/);
  // 一处定义、两处引用：计数和卡片上那个标记必须是同一个判据
  assert.equal((lib.match(/\(e\.a \|\| 0\) <= 1 && \(e\.hits \|\| 0\) < 2/g) || []).length, 1,
    "判据又被抄成两份了（v60.53 当场犯过一次）");
  assert.match(lib, /const witheredCount = \(entries \|\| \[\]\)\.filter\(isFading\)\.length;/);
  // 和 app.js 里清理枯萎那条判据必须是同一套，不许两处各写各的
  const purge = app.slice(app.indexOf("const keep = memLibRef.current.filter"), app.indexOf("const keep = memLibRef.current.filter") + 320);
  ["!e.pinned", "!e.open", "(e.a || 0) <= 1", "(e.hits || 0) < 2", "120 * 86400000"].forEach(k =>
    assert.ok(purge.includes(k), "清理枯萎那条判据变了，界面这条要跟着改：" + k));
});

test("底下那行没东西就别画一条空横线", () => {
  // 情绪那段挪走之后这一行常常是空的，只剩一条线
  assert.match(lib, /\(tags\.length \|\| trace\) \? h\("div", \{ className: "flex flex-wrap items-center"/);
});
