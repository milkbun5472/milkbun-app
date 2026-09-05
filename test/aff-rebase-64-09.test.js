// 她 2026-09-05 报的：「生成角色的时候如果设置了恋爱关系好感会提高到 80 开始，
// 但是有 bug 就是如果说了第一句话之后再加关系，他就永远固定成 50 开始」。
//
// 根因在这一行：`affOf = affinities[id] != null ? affinities[id] : baseAff(id)`。
// **第一句话就会写一次好感**（setAff(id, affOf(id) + inc)），而那一刻还没设关系，
// 于是 50 被当成起点焊死进存档；之后再加「恋人」，baseAff 再也不会被问到。
//
// 病根不是「80 没生效」，是**起点和走过的路被压成了同一个数**。
// 修法：改关系的那一刻两份 rels 都在手上，算得出改前改后的起点——
// 还没走远就整段平移过去，走远了的一个字都不动。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const code = app.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

const F = (() => {
  const grab = (from, to) => { const i = app.indexOf(from), j = app.indexOf(to); assert.ok(i > 0 && j > i, "抠不出 " + from); return app.slice(i, j); };
  const src = grab("  const REL_AFF = {", "  const affOf = charId =>")
    + "\nreturn { REL_AFF, baseAffIn, affRebase, AFF_REBASE_DRIFT };";
  return new Function(src)();
})();

test("起点还是按关系推的，恋人 80", () => {
  assert.equal(F.REL_AFF["恋人"], 80);
  assert.equal(F.baseAffIn({ "me->c1": { label: "恋人" } }, "c1"), 80);
  assert.equal(F.baseAffIn({ "c1->me": { label: "我的恋人" } }, "c1"), 80, "反向那条关系也该算");
  assert.equal(F.baseAffIn({}, "c1"), 50, "没关系就是 50");
  // 两条关系都在时取【高的】那一个——两个方向都要验，
  // 否则「取最后一个」和「取最高」这两种写法在其中一个方向上答案一样，测不出来
  assert.equal(F.baseAffIn({ "me->c1": { label: "朋友" }, "c1->me": { label: "恋人" } }, "c1"), 80);
  assert.equal(F.baseAffIn({ "me->c1": { label: "恋人" }, "c1->me": { label: "朋友" } }, "c1"), 80, "取的是最后一个，不是最高的");
  // 一句话里带两个词也一样（「前任，现在还是朋友」→ 按朋友 60 算，不按前任 44）
  assert.equal(F.baseAffIn({ "me->c1": { label: "前任，现在还是朋友" } }, "c1"), 60);
  // 别的角色的关系不许算进来
  assert.equal(F.baseAffIn({ "me->c2": { label: "恋人" } }, "c1"), 50);
});

test("她报的那一种：说过一句话（51）之后再加恋人 → 挪到 81，不是卡在 51", () => {
  assert.equal(F.affRebase(50, 80, 51), 81, "那一点点是挣来的，平移的时候要保住");
  assert.equal(F.affRebase(50, 80, 50), 80, "一句话都没说的也该跟着走");
});

test("真处出来的一个字都不动", () => {
  // 从 50 处到 72 再设恋人：那 22 分是聊出来的，不该被一次改关系抹掉（也不该白送到 100）
  assert.equal(F.affRebase(50, 80, 72), null);
  // 边界：正好在容差上算「还没走远」，超一点就不动
  assert.equal(F.AFF_REBASE_DRIFT, 12);
  assert.equal(F.affRebase(50, 80, 50 + F.AFF_REBASE_DRIFT), 92);
  assert.equal(F.affRebase(50, 80, 50 + F.AFF_REBASE_DRIFT + 1), null);
});

test("⚠️只往上挪，不往下挪——两头的代价不对称", () => {
  // 分手：恋人(80) → 前任(44)，好感 90。**一个字都不许动。**
  //   要是照「双向平移」来，它会当场掉成 54——一段真处出来的关系被一次改标签抹掉。
  assert.equal(F.affRebase(80, 44, 90), null, "分手把好感打下来了");
  assert.equal(F.affRebase(80, 44, 80), null);
  assert.equal(F.affRebase(60, 34, 61), null, "朋友改成对手也不许往下打");
  // 往上照旧
  assert.equal(F.affRebase(60, 80, 62), 82, "朋友升成恋人没跟着走");
  // 新角色压根没写过好感的不受影响：affOf 本来就直接问关系，设「对手」照样是 34
  assert.equal(F.baseAffIn({ "me->c1": { label: "对手" } }, "c1"), 34);
});

test("没写过好感的、和起点没变的，都不许动", () => {
  assert.equal(F.affRebase(50, 80, null), null, "没写过的话 affOf 本来就会去问关系");
  assert.equal(F.affRebase(50, 80, undefined), null);
  assert.equal(F.affRebase(80, 80, 51), null, "起点没变就别动");
  assert.equal(F.affRebase(50, 51, 50), 51, "起点动一点也照样跟着走");
});

test("不许超出 0~100", () => {
  assert.equal(F.affRebase(50, 82, 62), 94, "挚爱(82) 是关系表里最高的那一档");
  // 真实取值里 after 最高 82、drift 最高 12，算出来到不了 100——所以封顶这一道
  // 是防御性的。用一组够得着上限的数验它真的在：
  assert.equal(F.affRebase(95, 99, 99), 100, "封顶 100，不许算出 103");
  assert.equal(F.affRebase(99, 100, 100), null, "已经在顶上了就别动");
});

test("接在改关系那一处，而且只认【我和角色】那条线", () => {
  const seg = code.slice(code.indexOf("const saveRel = (key, label, note)"), code.indexOf("const relSummaryFor"));
  assert.match(seg, /const m = \/\^me->\(\.\+\)\$\/\.exec\(key\) \|\| \/\^\(\.\+\)->me\$\/\.exec\(key\);/,
    "角色和角色之间的关系也去动好感了");
  // 改之前那一份 rels 是 p、改之后是 n：两份都得用上，否则算不出「起点变了没有」
  assert.match(seg, /const before = baseAffIn\(p, cid\), after = baseAffIn\(n, cid\);/);
  assert.match(seg, /const next = affRebase\(before, after, cur\);/);
  assert.match(seg, /saveJSON\("x_affinities", nx\);/, "挪完没落盘，刷新就回去了");
  // 悄悄改一个数是不行的，得让她看见
  assert.match(seg, /toast\("好感起点跟着关系挪到了 "/);
  // ⚠️别读一份不存在的 ref：第一版写了 affinitiesRef.current，这个 App 里根本没有这东西
  assert.ok(!/affinitiesRef/.test(code), "又去读那个不存在的 ref 了");
  assert.match(seg, /setAffinities\(ap => \{/, "没走函数式更新，拿到的可能是过期的那一份");
});
