const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

// 切片两头都钉【函数名】：注释和中文文案天生会被改（anchor-on-code.md）
const i = scr.indexOf("function Ties({"), j = scr.indexOf("function RelComposer(", i);
assert.ok(i > 0 && j > i, "抠不出 Ties");
const ties = scr.slice(i, j);
const bi = scr.indexOf("function TiesBoard("), bj = scr.indexOf("function Ties({", bi);
assert.ok(bi > 0 && bj > bi, "抠不出 TiesBoard");
const board = scr.slice(bi, bj);

// ── 把 Ties 里那三个纯判断函数拿出来真跑，不只看字符串 ──────────────
// 桩照着【写存档那一段】的形状写：x_rels 是 { "a->b": {label, note} }
//（app.js 的 saveRel：n[key] = { label, note }）——stub-from-the-writer.md
function harness(rels) {
  const edge = (from, to) => rels[from + "->" + to];
  const origBwdOf = c => {
    if (!c.edit || !c.orig) return false;
    const f = edge(c.orig.a, c.orig.b), b = edge(c.orig.b, c.orig.a);
    return !!f && !!b && ((f.label || "") === (b.label || ""));
  };
  const saved = [];
  const onSave = (k, label, note) => {
    saved.push([k, label, note]);
    if (!label.trim()) delete rels[k]; else rels[k] = { label, note };
  };
  const idsOf = c => c.tab === "me" ? { A: "me", B: c.meChar } : { A: c.pair[0], B: c.pair[1] };
  const doSave = c => {
    const { A, B } = idsOf(c);
    const lb = c.label.trim();
    if (c.dir === "double") {
      onSave(A + "->" + B, lb, c.split ? c.noteFwd : c.note);
      onSave(B + "->" + A, lb, c.split ? c.noteBwd : c.note);
    } else {
      const fwd = c.single === "fwd";
      const wasDouble = c.edit && c.orig && !!origBwdOf(c);
      onSave((fwd ? A : B) + "->" + (fwd ? B : A), lb, c.note);
      if (wasDouble) onSave((fwd ? B : A) + "->" + (fwd ? A : B), "", "");
    }
  };
  return { rels, saved, doSave, origBwdOf, edge };
}

test("两条单向能共存：设了 B→A 兄妹，再设 A→B 暗恋，前一条还在", () => {
  const h = harness({ "c2->c1": { label: "兄妹", note: "" } });
  h.doSave({ edit: false, tab: "chars", pair: ["c1", "c2"], label: "暗恋", dir: "single", single: "fwd", note: "" });
  assert.deepEqual(Object.keys(h.rels).sort(), ["c1->c2", "c2->c1"]);
  assert.equal(h.rels["c2->c1"].label, "兄妹", "她先设的那条不许被抹掉");
  assert.equal(h.rels["c1->c2"].label, "暗恋");
});

test("源码里那句 clear opposite 已经不在了", () => {
  assert.doesNotMatch(ties, /clear opposite/,
    "一对人只能留一条单向，就是这一行拦的");
  assert.match(ties, /if \(wasDouble\) onSave\(/,
    "只有【原来是双向】才清另一头");
});

test("双向改成单向时，另一头要清掉——那是这次双向自己写的另一半", () => {
  const h = harness({ "c1->c2": { label: "恋人", note: "" }, "c2->c1": { label: "恋人", note: "" } });
  h.doSave({ edit: true, orig: { a: "c1", b: "c2" }, tab: "chars", pair: ["c1", "c2"],
    label: "前任", dir: "single", single: "fwd", note: "" });
  assert.deepEqual(Object.keys(h.rels), ["c1->c2"]);
  assert.equal(h.rels["c1->c2"].label, "前任");
});

test("判据是【原来是不是双向】，不是「反方向有没有东西」", () => {
  // 两条不同名的单向：改其中一条，另一条不许被当成半截双向抹掉
  const h = harness({ "c1->c2": { label: "暗恋", note: "" }, "c2->c1": { label: "兄妹", note: "" } });
  assert.equal(h.origBwdOf({ edit: true, orig: { a: "c1", b: "c2" } }), false, "两头不同名≠双向");
  h.doSave({ edit: true, orig: { a: "c1", b: "c2" }, tab: "chars", pair: ["c1", "c2"],
    label: "单恋", dir: "single", single: "fwd", note: "" });
  assert.equal(h.rels["c2->c1"].label, "兄妹", "另一条单向必须原地不动");
  assert.equal(h.rels["c1->c2"].label, "单恋");
});

test("openEdit 用同一条判据：两头同名才当双向打开", () => {
  assert.match(ties, /const isDouble = !!fwd && !!bwd && \(\(fwd\.label \|\| ""\) === \(bwd\.label \|\| ""\)\)/,
    "不这么判的话，两条单向会被当成双向打开，一存就并成一条");
  assert.match(ties, /dir: isDouble \? "double" : "single"/);
});

test("删除：双向删两半，两条单向只删正在编辑的那一条", () => {
  assert.match(ties, /if \(origBwdOf\(c\)\) \{/, "删除要跟 openEdit/doSave 用同一份判据");
});

test("关系面板挡住板子的指针捕获，否则「编辑」按不动", () => {
  // 板子 onPointerDown 里 setPointerCapture，面板长在板子里面：
  // 不挡的话 pointerup 投给板子、按钮拿不到 click（她 2026-09-19 报）
  assert.match(board, /setPointerCapture/, "板子确实在捕获指针");
  const panel = board.slice(board.indexOf("selLink ? h(\"div\""));
  assert.match(panel.slice(0, 200), /onPointerDown: ev => ev\.stopPropagation\(\)/,
    "这块面板必须自己挡住 pointerdown");
});
