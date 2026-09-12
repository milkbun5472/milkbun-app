// 她 2026-09-12：「为啥我有些角色好感度明显可以涨有些好像卡了，刚好都是上次数据坏了
//   recover 的那几个一直卡在 50」，然后当场纠正了我第一版判断：
//   「都有关系的宝宝但是都不动…其他角色我没聊那么多的都明显涨了，王爷还是 50 而且还是恋人」。
//
// 「恋人」而还停在 50 是决定性的一句：baseAff(恋人)=80，affOf 的规矩是
// 「存过就用存的，没存过才问关系」——所以那 50 不是兜底，是**真的存着一个 50**。
//
// 它怎么被焊进去的（v65.76 那次的注释里写过一模一样的病）：
//   还没设关系时，第一句话就会写一次好感 → 那一刻 baseAff 是 50 → 50 进存档。
// 为什么后来设了「恋人」也不好：**「补足新起点」这一层只写在 saveRel 里**，
//   而 x_rels 有两条路——saveRel，和开机 loadJSON（云端恢复／导入存档／换设备同步
//   全从开机那条进来）。数据坏掉之后那几个人的关系正是从第二条路回来的，
//   于是那条路上一次都没补过，50 从此永远压着 80。
//
// v65.76 修的是第一条路。这一版把这层抠成公共的一支，两条路都走它。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const A = strip(app);
const grab = (from, to) => { const i = app.indexOf(from), j = app.indexOf(to, i); assert.ok(i > 0 && j > i, from); return app.slice(i, j); };

const F = (() => {
  const src = grab("  const REL_AFF = ", "  const affOf =");
  return new Function("rels", src + "\nreturn { affLift, affRebase, affReconcile, baseAffIn };")({});
})();
const LOVER = { "me->c1": { label: "恋人" } };

test("补足起点这一支是纯的：低了抬到起点，高了不动，没写过不管", () => {
  assert.equal(F.affLift(80, 50), 80);
  assert.equal(F.affLift(80, 79.9), 80);
  assert.equal(F.affLift(80, 80), null, "已经到了就别再写一遍");
  assert.equal(F.affLift(80, 90), null, "处出来的更高好感不许被一条标签压下去");
  assert.equal(F.affLift(80, null), null, "没写过＝affOf 本来就会去问关系");
  assert.equal(F.affLift(80, undefined), null);
  assert.equal(F.affLift(NaN, 50), null);
  assert.equal(F.affLift(120, 50), 100, "夹在 0~100 里");
});

test("saveRel 那条路的语义一个字没变：只在【升级】标签时补", () => {
  assert.equal(F.affRebase(50, 80, 51), 80);
  assert.equal(F.affRebase(80, 44, 90), null, "降级标签不扣分");
  assert.equal(F.affRebase(80, 80, 51), null, "起点没变就不重算");
  assert.equal(F.affRebase(50, 80, null), null);
  assert.equal(F.affRebase(50, 80, 90), null);
});

// ⭐她报的那一个
test("开机那条路也补：存着 50、关系写着恋人 → 抬回 80", () => {
  const r = F.affReconcile(LOVER, { c1: 50 }, {}, [{ id: "c1", name: "王爷" }]);
  assert.ok(r, "一个都没对齐");
  assert.equal(r.aff.c1, 80);
  assert.deepEqual(r.fixed.map(x => x.name + " " + x.from + "→" + x.to), ["王爷 50→80"]);
  assert.equal(r.applied.c1, 80, "补过了要记一笔");
});

test("这道补足对同一条起点【只发生一次】——之后掉下去是真掉的", () => {
  const first = F.affReconcile(LOVER, { c1: 50 }, {}, [{ id: "c1", name: "王爷" }]);
  // 补完之后相处里掉到 74，再开机一次
  const again = F.affReconcile(LOVER, { c1: 74 }, first.applied, [{ id: "c1", name: "王爷" }]);
  assert.equal(again, null, "又抬回 80 了：那就等于好感永远掉不下来");
});

test("关系换了一条更高的，下次开机还是补得上", () => {
  const first = F.affReconcile({ "me->c1": { label: "朋友" } }, { c1: 50 }, {}, [{ id: "c1", name: "王爷" }]);
  assert.equal(first.aff.c1, 60);
  const up = F.affReconcile(LOVER, first.aff, first.applied, [{ id: "c1", name: "王爷" }]);
  assert.ok(up, "起点换了却当成补过了");
  assert.equal(up.aff.c1, 80);
});

test("没关系的人一个字都不动（50 就是 50，不是病）", () => {
  const r = F.affReconcile({}, { c1: 50 }, {}, [{ id: "c1", name: "谁" }]);
  assert.ok(r, "账还是要记的");
  assert.deepEqual(r.fixed, []);
  assert.equal(r.aff.c1, 50);
  assert.equal(r.applied.c1, 50);
});

test("从来没写过好感的人不用管——affOf 自己会去问关系", () => {
  const r = F.affReconcile(LOVER, {}, {}, [{ id: "c1", name: "王爷" }]);
  assert.deepEqual(r.fixed, [], "凭空写一个 80 进去，等于把兜底那条路变成存档");
  assert.equal(r.aff.c1, undefined);
  assert.equal(r.applied.c1, 80, "账照记：下次她真聊出一个数来，就不该再被抬一次");
});

test("配角没有好感这回事，别给它记账也别改它", () => {
  const r = F.affReconcile(LOVER, { c1: 50 }, {}, [{ id: "c1", name: "配角", npc: true }]);
  assert.equal(r, null);
});

test("全都对齐过了就返回 null，别每次开机都白写一遍盘", () => {
  assert.equal(F.affReconcile(LOVER, { c1: 80 }, { c1: 80 }, [{ id: "c1", name: "王爷" }]), null);
});

test("坏数据不许把整批对齐弄崩", () => {
  const r = F.affReconcile(LOVER, { c1: 50 }, {}, [null, { name: "没有 id" }, { id: "c1", name: "王爷" }]);
  assert.equal(r.aff.c1, 80);
});

// ── 接到开机那条路上了没有 ────────────────────────────────────
test("开机真的走这一支，而且用的是【刚读出来的那两份】", () => {
  assert.match(A, /const _rels0 = loadJSON\("x_rels", \{\}\), _aff0 = loadJSON\("x_affinities", \{\}\);/);
  assert.match(A, /const _afx = affReconcile\(_rels0, _aff0, loadJSON\("x_affBase", \{\}\), c\);/,
    "拿 state 去对齐是不行的：这一帧里 setRels/setCharacters 还没生效");
  assert.match(A, /if \(_afx\.fixed\.length\) saveJSON\("x_affinities", _afx\.aff\);/, "补了不落盘，下次开机还得补一遍");
  assert.match(A, /saveJSON\("x_affBase", _afx\.applied\);/, "账不记，这道补足就变成每次开机都抬一遍");
  assert.match(A, /setAffinities\(_afx\.fixed\.length \? _afx\.aff : _aff0\);/, "落了盘却没进 state，界面上这一开机还是老数");
  assert.match(A, /\} else setAffinities\(_aff0\);/, "没有要对齐的时候也得照常把好感读进来");
});

test("改了她的数就要说一声（回执是个承诺）", () => {
  const i = A.indexOf("const _afx = affReconcile(");
  const blk = A.slice(i, i + 900);
  assert.match(blk, /if \(_afx\.fixed\.length\) setTimeout/, "一个都没补也弹一句，就是在骗她");
  assert.match(blk, /好感补回关系起点/);
  assert.match(blk, /Math\.round\(x\.from\) \+ "→" \+ Math\.round\(x\.to\)/, "得说清从多少到多少");
});

test("saveRel 和开机记的是【同一本账】", () => {
  assert.equal((A.match(/saveJSON\("x_affBase"/g) || []).length, 2, "两条路都要记");
  assert.match(A, /if \(after !== before\) \{ const _b = loadJSON\("x_affBase", \{\}\); _b\[cid\] = after; saveJSON\("x_affBase", _b\); \}/);
});

test("补足那条规则只许有一份（saveRel 不许再自己写一遍）", () => {
  assert.equal((A.match(/const affLift = /g) || []).length, 1);
  assert.match(A, /const affRebase = \(before, after, cur\) =>\n\s*\(Number\.isFinite\(before\) && Number\.isFinite\(after\) && after > before\) \? affLift\(after, cur\) : null;/,
    "affRebase 得是 affLift 的一层薄壳，不是第二份实现");
  assert.equal((A.match(/affLift\(/g) || []).length, 2, "只该有两个调用点：affRebase 一处、affReconcile 一处");
  assert.match(A, /const next = affLift\(base, aff\[id\]\);/, "开机那条路没走公共的那一支");
});

test("病历要留在代码里，别让下一个人又把开机这条路拆掉", () => {
  const i = app.indexOf("const affReconcile = ");
  const doc = app.slice(Math.max(0, i - 1400), i);
  assert.match(doc, /只写在 saveRel 里/, "得说清病根是「一层只写在两条路里的一条上」");
  assert.match(doc, /云端恢复、导入存档、换设备同步/, "得写明第二条路是谁");
  assert.match(doc, /2026-09-12/);
});
