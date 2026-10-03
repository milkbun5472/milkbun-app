// 朋友圈的 AI 味（群里芸 2026-10-03：「pyq 感觉 ai 味好重啊」）
//
// 先说查出来【不是】什么：不是漏层。朋友圈走 runProbe{voice:true}，buildBundle
// 那整套反八股（反陈词滥调/居高临下/三件套/空安慰/看穿腔/语域跟场面走）一条不少。
// 所以再加禁令没用。病在那句指令本身，两处：
//   ① 站位：原来是「以『X』身份发一条朋友圈」＝【在旁边替他写】。v55.91 群里王爷
//      变霸总就是栽在这儿——料全对，站位是导演位，写出来就是那个类型的通用样子。
//      她 2026-10-03 点名：「改成你就是 X 在发朋友圈」。
//   ② 原来给的是「心情/日常/感想」＝【掷答案】，三个最泛的类目，模型只会滑回
//      先验中心（感悟体、小作文）。按 bans-make-it-dumber 的后半：掷约束不掷答案。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");

const seg = (() => {
  const i = app.indexOf("  const genMoment = async char =>");
  const j = app.indexOf("const content = String(d && d.content", i);
  assert.ok(i > 0 && j > i, "抠不出 genMoment");
  return app.slice(i, j);
})();

test("① 站位：你就是他，不是替他写", () => {
  assert.match(seg, /完全代入「" \+ char\.name \+ "」/, "要用全库通用那句「完全代入」");
  assert.match(seg, /你就是他/);
  assert.ok(!/以「" \+ char\.name \+ "」身份发一条朋友圈/.test(seg),
    "「以…身份」那种旁观写法不许回来");
});

test("② 不许再掷答案：那三个最泛的类目不能出现在指令里", () => {
  // ⚠️只看【指令那一行】，别扫注释——第一版写成扫整段，结果被我自己写在注释里
  //   记录病根的那句「原来还给了『心情/日常/感想』」给绊红了。
  //   注释天生要讲清为什么改，拿它当违规证据是测试自己的错。
  const line = seg.split("\n").find(l => l.includes("instruction:"));
  assert.ok(line, "抠不出 instruction 那一行");
  assert.ok(!/心情\/日常\/感想/.test(line), "「心情/日常/感想」＝替它选好了往哪写");
  assert.ok(!/有角色味道/.test(line), "「有角色味道」是空话，在 prompt 里等于没说");
});

test("③ 改成掷轴，走公共件 js/axes.js，而不是就地现写", () => {
  const i = seg.indexOf("const MOMENT_AXES = ["), j = seg.indexOf("const _momRolled");
  assert.ok(i > 0 && j > i, "抠不出那几条轴");
  const axes = seg.slice(i, j);
  assert.ok((axes.match(/key: "/g) || []).length >= 4, "至少四条轴，才搭得出组合空间");
  assert.match(seg, /window\.Axes\.roll\(MOMENT_AXES/,
    "掷法要走公共件——我第一版在这儿就地写了个 _pick，那本身就违规（one-public-mechanism）");
  assert.match(seg, /别为了凑这几条而写/, "要说清它们是防塌回中心的，不是填空题");
});

test("④ 真跑：每次掷出来的不一样，而且常有轴落回模型手里", () => {
  const Axes = require("../js/axes.js");
  global.window = global.window || {}; global.window.Axes = Axes;
  const i = app.indexOf("      const MOMENT_AXES = ["), j = app.indexOf("      const _ownMoms =");
  const code = app.slice(i, j);
  const seen = new Set(); let free = 0;
  for (let n = 0; n < 300; n++) {
    const out = new Function("char", "moments", "window", code + "\nreturn _momAxes;")({ id: "c" + n }, { length: n }, global.window);
    seen.add(out);
    if (out.includes("你自己想") || out.includes("没有给你任何限制")) free++;
  }
  assert.ok(seen.size > 40, "300 次只掷出 " + seen.size + " 种，组合空间太小");
  assert.ok(free > 120, "300 次只有 " + free + " 次把某一轴还给模型，关门关太死");
});
