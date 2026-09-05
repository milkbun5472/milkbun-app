// 她 2026-09-05：「全部装饰能不能加一个没有框的选项，有些有框有点丑宝宝」。
// ⚠️原来【也能】做到没框，但要连点三处：外观挑一个 → 表面改「透明底」→ 边框改「无边框」，
//   而且卡的内边距和圆角还留着，装饰仍旧缩在一个看不见的框里。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
// 顶层函数原样抠出来在沙箱里跑：只钉「代码里写了什么」是不够的，
// 下面第三条就是变异测试逼出来的——卡撤掉了，边框转头被另一层画回来。
const fn = name => { const i = comp.indexOf("function " + name + "("); return comp.slice(i, comp.indexOf("\n}", i) + 2); };
const S = (() => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(["normalizeHomeDecorTilt", "homeDecorRgba", "homeDecorMaterialStyle", "homeWidgetPresetStyle"].map(fn).join("\n")
    + "\nthis.material = homeDecorMaterialStyle; this.preset = homeWidgetPresetStyle;", ctx);
  return ctx;
})();
const T = { ink: "#2b2721", line: "#e3ddd3", bg2: "#fffdf8" };

test("外观里多一款【无框】", () => {
  const i0 = comp.indexOf("const HOME_WIDGET_PRESETS = [");
  const seg = comp.slice(i0, comp.indexOf("\n];", i0));
  assert.match(seg, /\{ id: "bare", name: "无框"/);
  assert.match(seg, /不画卡片，装饰直接落在壁纸上/);
});

test("无框＝卡的四样一样都不画，内边距和圆角也不留", () => {
  const st = S.preset("bare", T, "quote");
  assert.equal(st.background, "transparent");
  assert.equal(st.border, "none");
  assert.equal(st.boxShadow, "none");
  assert.equal(st.backdropFilter, "none");
  assert.equal(st.padding, 0, "内边距还在，装饰还是缩在一个看不见的框里");
  assert.equal(st.borderRadius, 0);
  // ⚠️overflow 照旧 hidden：格子是按格算落位的，画到格子外面会盖住邻居
  assert.equal(st.overflow, "hidden");
  // 别的几款一个都没被改坏
  assert.match(S.preset("soft", T, "quote").background, /rgba\(255,255,255,\.52\)/);
  assert.match(S.preset("paper", T, "quote").background, /#fbf4e8/);
  assert.equal(S.preset("native", T, "quote"), null, "原生那款不该有壳");
});

test("材质那一层不许把边框又画回来——这是最容易漏的一处", () => {
  // borderMode 默认是「细边」，而那几行是【无条件】给 style.border 赋值的：
  // 不在 bare 这儿收住的话，卡刚被撤掉，边框转头又被这一层画上。
  const plain = S.material({ accent: "#b65f57" }, T, "bare");
  assert.equal(plain.border, undefined, "无框还是画了边框");
  assert.equal(plain.background, undefined, "无框还是画了底");
  // 但歪斜和对齐要留着——那是装饰自己的摆法，跟框没关系
  assert.equal(plain.transform, "rotate(0deg)");
  assert.match(S.material({ tilt: -8 }, T, "bare").transform, /rotate\(-8deg\)/);
  // 不是 bare 的时候照旧按 borderMode 画
  assert.match(S.material({ accent: "#b65f57" }, T, "soft").border, /1px solid rgba\(182,95,87,0\.52\)/);
  assert.equal(S.material({ borderMode: "none" }, T, "soft").border, "none");
  // 调用点得把外观 id 传进来，不然这一层根本不知道现在是不是无框
  assert.match(comp, /homeDecorMaterialStyle\(it\.decor, t, presetId\)/);
});

test("装饰才给【无框】，组件不给；组件才给【原生】，装饰不给", () => {
  // 组件去掉卡片多半只剩一堆浮着的字，那不是选项，是坏掉
  const grid = comp.slice(comp.indexOf("function HomePresetGrid("), comp.indexOf("function HomeSizeGrid("));
  assert.match(grid, /if \(p\.id === "native"\) return !!allowNative;/);
  assert.match(grid, /if \(p\.id === "bare"\) return !allowNative;/);
  // 两个入口：改已有的那一处按 kind 判，新建装饰那一处写死 false
  assert.match(comp, /allowNative: REG\[styleKey\]\.kind !== "decor"/);
  assert.match(comp, /h\(HomePresetGrid, \{ value: decorDraftPreset, allowNative: false/);
});
