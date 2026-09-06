// 她 2026-09-06（截图）：「宝宝秋秋写的这个应用不出来啊，文风台」。
//
// 她让秋秋给文风台写了一整段主题 CSS（head / headink / headdim / field / input / sheet…），
// 应用完一点变化都没有。查下来不是主题台的问题，是【那一页没有那些挂点】：
//   文风台自己手写了一条顶栏，没走共用的 Head——所以整页只有最外层那一个 data-wk="app"。
//   而秋秋手上那份清单写着「每一页都有」，他照着写，写完一条都不生效。
//
// 两头都补：① 文风台换成共用 Head（挂点当场就有了，紧凑栏那条规矩也一起合规）；
//          ② 秋秋每次都实测一遍【她此刻这一页真有哪些挂点】，清单不再说满话。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const { ruleText } = require("./_rules.js");
const lab = R("js/style-lab.js"), asst = R("js/assistant.js");

test("文风台的顶栏走共用 Head，不再自己手写一条", () => {
  // 规矩本身就写着这一句，别在这儿另立一份说法
  assert.match(ruleText("mobile-ui-layout"), /那条紧凑栏就是 `js\/components\.js` 的 `Head`/);
  assert.match(lab, /h\(Head, \{ zh: "文风预设台", onBack: props\.onBack, bg: "transparent" \}\)/);
  // 手写那条的零件一个都不许剩下（留着就是两条顶栏并存）
  assert.ok(!/"aria-label": "返回"/.test(lab), "手写的返回键还在");
  assert.ok(!/fontSize: 17, color: t\.ink \} \}, "文风预设台"/.test(lab), "手写的标题还在");
  // ⚠️底纹铺在外壳上、顶栏透上来（mobile-ui-layout §3.5）：外壳那张纸没被顺手删掉
  assert.match(lab, /const benchPaper = \(typeof pageSkin === "function"\)/);
});

test("秋秋会实测【这一页真有哪些挂点】，而不是照着一张说满话的清单写", () => {
  const w = asst.slice(asst.indexOf("function wkHere()"), asst.indexOf("function themeCssNote"));
  assert.ok(w.length > 200, "抠不出 wkHere");
  assert.match(w, /document\.querySelectorAll\("\[data-wk\]"\)/, "没真去扫 DOM");
  assert.match(w, /data-lisa-screen/, "没说清扫的是哪一页");
  // ⚠️整屏打开秋秋时 DOM 就是秋秋自己那一页，说了反而是错的
  assert.match(w, /if \(!page \|\| page === "assistant"\) return "";/, "整屏秋秋那一档没让开");
  assert.match(w, /没出现在这一行里的，这一页就是没有/, "没把话说死，模型还会照着清单猜");
  assert.match(w, /走 pagecolor/, "没告诉他这一页该走哪条路");
  assert.match(w, /catch \(e\) \{ return ""; \}/, "扫挂了要安静让开，别把整段提示词搞崩");
  // 真的拼进去了（v55.95 那个形状：声明了没人引用）
  const note = asst.slice(asst.indexOf("function themeCssNote"), asst.indexOf("const SHAPE"));
  assert.match(note, /\+ wkHere\(\)/, "算了没拼进去");
});

test("那份清单不再说「每一页都有」，还说清了图标要写 stroke", () => {
  const note = asst.slice(asst.indexOf("function themeCssNote"), asst.indexOf("const SHAPE"));
  assert.ok(!/【每一页都有】/.test(note), "又说成「每一页都有」了");
  assert.match(note, /【共用件上的（顶栏/);
  // 她这次那段 CSS 里 headink 写的是 color，而返回箭头是 SVG 的 stroke 属性——写 color 染不上
  assert.match(note, /要给它上色得写 \*\*stroke\*\*/, "没说图标要写 stroke");
});
