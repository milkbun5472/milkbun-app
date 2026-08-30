const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const screens = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const S = (() => {
  const a = screens.indexOf("const CARRY_SECTIONS = [");
  const b = screens.indexOf("// 版块详情：打开即自动生成");
  assert.ok(a > 0 && b > a, "抠不出随身物那几个函数");
  return new Function(screens.slice(a, b) + "\nreturn { carryProbeSpecAll, carryProbeSpec, CARRY_SECTIONS };")();
})();

// 她 2026-08-30：「能不能全部做 1 次调用而不是每一个一次」
test("四栏一次写完：一份 instruction 里四栏的判据都在", () => {
  const sp = S.carryProbeSpecAll({ name: "裴照川" }, {}, {}, null);
  ["包内", "口袋", "珍藏小物", "衣柜"].forEach(z =>
    assert.ok(sp.instruction.indexOf("〔" + z + "〕") > 0, "少了这一栏：" + z));
  // 每一栏的【判据】才是防串栏的东西，不能只留个小标题
  ["出门要用", "伸手就摸得到", "一点用都没有", "按【场合】分组"].forEach(j =>
    assert.ok(sp.instruction.indexOf(j) > 0, "这一栏的判据丢了：" + j));
  // 剥「推演「某某」」那个开头时连着「的」一起剥，否则成了「〔衣柜〕的衣柜」
  assert.doesNotMatch(sp.instruction, /〔衣柜〕的衣柜/);
  assert.match(sp.instruction, /〔衣柜〕衣柜，按【场合】分组/);
  assert.doesNotMatch(sp.instruction, /推演「裴照川」此刻/, "小标题里不该还留着「推演某某」");
});

test("一次写完之后，跨栏重复从「事后拦」变成「不会发生」", () => {
  const sp = S.carryProbeSpecAll({ name: "裴照川" }, {}, {}, null);
  assert.match(sp.instruction, /同一件东西只许出现在一栏里/);
  assert.match(sp.instruction, /四栏是一起写的，你自己分配好/);
  // 四栏一次出，token 得给够（分开时是 4000×3 + 6000）
  assert.ok(sp.maxTokens >= 14000, "token 不够，最后那栏会被截断：" + sp.maxTokens);
  // schema 是四栏套在一个对象里，不是四份
  ["bag", "pocket", "trinket", "outfit"].forEach(k =>
    assert.ok(sp.schemaHint.indexOf('"' + k + '"') > 0, "schema 少了 " + k));
  assert.match(sp.schemaHint, /"outfit":\{"closet"/, "衣柜的形状跟另外三栏不一样，不能混成 items");
});

test("上一份和钉住的，按栏各喂各的", () => {
  const known = { bag: { items: [{ name: "油纸伞", note: "伞骨断过一根" }] } };
  const sp = S.carryProbeSpecAll({ name: "裴照川" }, known, { bag: ["油纸伞"] }, null);
  assert.ok(sp.instruction.indexOf("〔包内 · 上一次是这些〕") > 0, "上一份没按栏标出来");
  assert.ok(sp.instruction.indexOf("油纸伞") > 0);
  assert.match(sp.instruction, /默认原样照抄回来/);
  assert.match(sp.instruction, /钉住了/);
  // 没有旧数据的那几栏不该凭空多出一段
  assert.equal(sp.instruction.indexOf("〔口袋 · 上一次是这些〕"), -1);
});

test("真到手的东西只喂一遍，不是四栏各喂一遍", () => {
  const sp = S.carryProbeSpecAll({ name: "裴照川" }, {}, {}, { bought: ["一把新伞"], gifts: ["围巾"] });
  assert.equal((sp.instruction.match(/【他最近真到手的东西】/g) || []).length, 1);
  assert.ok(sp.instruction.indexOf("一把新伞") > 0 && sp.instruction.indexOf("围巾") > 0);
});

test("genCarryAll 变成一次调用，且少一栏不许丢掉别的栏", () => {
  const i = app.indexOf("  const genCarryAll = async char => {");
  const seg = app.slice(i, i + 1900);
  assert.equal((seg.match(/await runProbe\(/g) || []).length, 1, "还是一栏一刀");
  assert.match(seg, /carryProbeSpecAll\(char, known, pins, carryMaterialFor\(char\.id\)\)/);
  assert.doesNotMatch(seg, /for \(const key of keys\) \{\n\s*try \{/, "旧的串行循环还在");
  // 少了某一栏就只留那一栏不动，别把已经写好的三栏一起丢掉——那是一整次调用的钱
  assert.match(seg, /if \(!d \|\| typeof d !== "object"\) return;/);
  assert.match(seg, /got\+\+;/);
  assert.match(seg, /if \(!got\) throw new Error/, "四栏全没解析出来才算失败");
  assert.match(seg, /if \(got < keys\.length\) toast\(/, "少写了几栏得告诉她");
  // 代码那道去重仍然留着（规则降概率，代码才保证）
  assert.match(seg, /carryDedupe\(k, d, other\)/);
  assert.match(seg, /carryEvolveMerge\(k, known\[k\], /);
  // 单栏刷新那条路照旧还在（她还能只刷一栏）
  assert.match(app, /const genCarrySection = async \(char, key\) => \{/);
});
