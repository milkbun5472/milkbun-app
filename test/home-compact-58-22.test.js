const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const dwell = fs.readFileSync(path.join(__dirname, "..", "js", "dwell.js"), "utf8");
const grab = (a, b) => { const i = comp.indexOf(a), j = comp.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出：" + a); return comp.slice(i, j); };

function makeHome(layout, folders) {
  const src = [
    grab("  const DEFAULT_LAYOUT = [", "  const SP_RE = /^sp_/;"),
    grab("  const SP_RE = /^sp_/;", "  // 存档 + 注册表 → 完整布局"),
    grab("  function buildLayout(saved) {", "  function persistFolders(nf)")
  ].join("\n");
  const regSrc = grab("  const REG = {", "\n  };") + "\n  };";
  const REG = new Function(regSrc.replace(/G:[^,}]+/g, "G: null") + "\nreturn REG;")();
  const foldersRef = { current: JSON.parse(JSON.stringify(folders || {})) };
  const api = new Function("REG", "foldersRef",
    src + "\nreturn { buildLayout, trimTailRows, placeDense, REG };")(REG, foldersRef);
  return { api, foldersRef, layout: JSON.parse(JSON.stringify(layout || {})) };
}
const rowOfEach = (api, keys) => api.placeDense(keys).at;

// 她 2026-08-30：「组件之间也没那么紧凑了，原来日历底部能完全显示在屏幕上现在不行了」、
// 「每一页都还是可以滑动就算下面没东西」——每页尾巴被补位垫出一整排看不见的空行（≈90px）。
test("平时不渲染尾巴上那几排纯空格", () => {
  const { api } = makeHome();
  // 前四格是真东西（第 0 行），后面八个空格会排到第 1、2 行
  const keys = ["cast", "ties", "phone", "cwallet"].concat(
    Array.from({ length: 8 }, (_, i) => "sp_0_" + i));
  const kept = api.trimTailRows(keys);
  assert.deepEqual(kept, ["cast", "ties", "phone", "cwallet"], "第 0 行之后的空格该全部不渲染");
});

test("跟真东西同一排的空格要留着——那是她自己摆的洞", () => {
  const { api } = makeHome();
  const keys = ["cast", "sp_0_0", "ties", "sp_0_1"].concat(
    Array.from({ length: 6 }, (_, i) => "sp_0_" + (i + 2)));
  const kept = api.trimTailRows(keys);
  assert.ok(kept.includes("sp_0_0") && kept.includes("sp_0_1"), "第 0 行里的洞被误删了");
  const at = rowOfEach(api, keys);
  keys.forEach((k, i) => { if (/^sp_/.test(k) && at[i] > 0) assert.ok(!kept.includes(k), k + " 在第 " + at[i] + " 行还留着"); });
});

test("整页都是空格就一个都不渲染（空页不该占着一屏高度）", () => {
  const { api } = makeHome();
  assert.deepEqual(api.trimTailRows(Array.from({ length: 24 }, (_, i) => "sp_3_" + i)), []);
});

test("高组件后面那一排空格也要按真实占位算", () => {
  const { api } = makeHome();
  // 日历 3 宽 3 高：真东西吃到第 2 行，右边一列的洞该留、第 3 行往后的空格该去
  const keys = ["w_cal"].concat(Array.from({ length: 15 }, (_, i) => "sp_0_" + i));
  const kept = api.trimTailRows(keys);
  const at = rowOfEach(api, keys);
  const keptSpacerRows = kept.filter(k => /^sp_/.test(k)).map(k => at[keys.indexOf(k)]);
  assert.ok(keptSpacerRows.length === 3, "日历右边那一列的三个洞该留着，实际留了 " + keptSpacerRows.length + " 个");
  assert.ok(Math.max(...keptSpacerRows) <= 2, "留到第 " + Math.max(...keptSpacerRows) + " 行去了，日历只占到第 2 行");
});

test("编辑态要把空格全发出去，不然没地方放东西", () => {
  const i = comp.indexOf('className: "grid grid-cols-4 gap-y-3 gap-x-3"');
  const src = comp.slice(i, i + 260);
  assert.match(src, /editMode\s*\?\s*\(keys[^)]*\)\s*:\s*trimTailRows\(keys\)/,
    "渲染那一行没有按编辑态区分：编辑时必须发全部空格（落点），平时才裁尾巴");
});

// 她 2026-08-30：「6页的日记和备忘录入口是duplicate可以删了，
// 日记正版在下面四个dock上，备忘录做了组件」
test("日记和备忘录不再出现在主屏，而且不会被安全网补回来", () => {
  const { api, foldersRef } = makeHome();
  assert.equal(api.REG.diary, undefined, "日记还在 REG 里，安全网就会一直把它补回主屏");
  assert.equal(api.REG.memo, undefined, "备忘录还在 REG 里");
  // 存档里残留的那两个也该被滤掉
  const L = api.buildLayout({ 0: ["cast", "ties"], 5: ["diary", "memo"] });
  const all = new Set();
  L.forEach(a => (a || []).forEach(k => all.add(k)));
  assert.ok(!all.has("diary") && !all.has("memo"), "她存档里第 6 页那两个残留没被清掉");
  assert.ok(all.has("cast"), "把别的也一起清掉了");
  assert.equal(foldersRef.current.diary, undefined);
});

test("空页留着（她说她喜欢空页）", () => {
  const { api } = makeHome();
  const L = api.buildLayout({ 0: ["cast"], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] });
  assert.ok(L.length >= 8, "页数被收掉了，她要留着，现在只剩 " + L.length + " 页");
});

test("地方改叫去处", () => {
  const { api } = makeHome();
  assert.equal(api.REG.dwell.zh, "去处");
  assert.ok(!/zh: "地方"/.test(comp), "主屏图标名还有写「地方」的");
  assert.match(dwell, /zh: "去处", en: "Places"/, "去处那一页的标题没改");
  assert.ok(!/} }, "地方"\)/.test(dwell), "去处页面里还有个标题写着「地方」");
});

// 她 2026-08-30 截图：情侣卡的「江识」被挤成一个字一行，「在一起第 55 天」也断成两行
test("情侣卡的名字和天数都锁单行", () => {
  const i = comp.indexOf("function UsWidget(");
  assert.ok(i > 0, "找不到情侣组件了");
  const body = comp.slice(i, comp.indexOf("\nfunction ", i + 10));
  const lineWith = needle => body.split("\n").find(l => l.includes(needle)) || "";
  const nameLine = lineWith("p.remark || p.name");
  assert.match(nameLine, /whiteSpace: "nowrap"/, "名字没锁单行，被右边那排小圆点一挤就一个字一行：" + nameLine.trim());
  assert.match(nameLine, /textOverflow: "ellipsis"/, "名字太长得用省略号收掉，不能撑高卡片");
  const daysLine = lineWith("\"在一起第 \" + days");
  assert.match(daysLine, /whiteSpace: "nowrap"/, "「在一起第 N 天」没锁单行，会断成两行：" + daysLine.trim());
  assert.match(daysLine, /flexShrink: 0/, "天数没设 flexShrink:0，还是会被压窄换行");
});
