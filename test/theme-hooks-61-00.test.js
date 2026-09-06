// 主题工作室的挂点（v61.00）。她 2026-09-03 要一份「仿微信」的 CSS 贴进
// 「单聊」那一页，可这一屏的气泡全是内联样式、一个 class 都没有——
// 用户只能写 [style*="pre-wrap"] 这种一碰就碎的选择器。
//
// ⚠️这些 data-wk 是【对外的名字】：别人照着它写好的主题存在自己机器上，
// 改名或删掉就等于把人家的主题弄坏了。所以钉在这儿。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

test("单聊那一屏该有的挂点，一个都不许少", () => {
  ["chat", "chathead", "body", "msg", "time", "row", "avatar", "bubble", "composer"]
    .forEach(k => assert.match(comp, new RegExp('"data-wk": "' + k + '"'), "少了 data-wk=" + k));
});

test("我和他分得开，图片那种气泡也认得出", () => {
  // 气泡和整条消息都带 data-me，CSS 才能只改一侧
  assert.match(comp, /"data-wk": "msg", "data-me": isU \? "1" : "0"/);
  assert.match(comp, /"data-wk": "bubble", "data-me": isU \? "1" : "0", "data-kind": m\.kind \|\| "text"/);
});

test("挂点只是一个写死的名字，夹带不了任何东西", () => {
  // 原来这条是靠「data-wk 那一行里不许出现 style:」来保证「加挂点不改长相」的。
  // 那是个代理判据，只在【挂点都落在没样式的元素上】时才成立。
  // v61.39 起挂点要落到卡片盒子、群聊外壳这些【本来就带样式】的元素上——
  // 皮肤要改的恰恰就是它们。照旧那么查，等于禁止给任何有样式的东西挂点。
  // 改成查真正查得到的那一半：名字必须是写死的字符串字面量，
  // 拼不进变量、模板串或表达式，也就带不进任何值。
  //
  // v61.76 起多了两种合法写法，两种都仍然只落得下写死的名字：
  //   ① 按状态在两个字面量之间挑一个（副标题：出戏时那抹状态色不交给皮肤，
  //      所以那一档不挂点）——挑来挑去还是那两个字面量；
  //   ② 转交（Svg / Marquee 的 wk）——图标和跑马灯自己不是 DOM 元素，
  //      挂点得由外面递进去。这一支的保证落在【每个调用点都传字面量】上，
  //      所以下面单独把 wk: 的调用点也查一遍；漏查的话这条口子就是真的开着。
  const lit = /^"[a-z]+"$/;
  // ⚠️挂点写在对象最后一项时后面跟的是 }（v65.05 的时钟那一处），别把它一起捞进来
  const all = [...comp.matchAll(/"data-wk":\s*([^,\n}]+)/g)].map(m => m[1].trim());
  assert.ok(all.length >= 30, "挂点只剩 " + all.length + " 个，是不是被删了");
  const PASS = ["wk || undefined"];               // ②：转交，值由调用点保证
  // ①：三元（可以一串接一串）的每个【取值位】都必须是字面量或 undefined。
  //    a ? x : b ? y : z 拆开是 [a, x, b, y, z]：单数位和最后那一位是取值位，
  //    双数位是条件——条件里写什么都不会进 DOM，不管。
  const litChain = v => {
    const parts = v.split(/\?|:/).map(x => x.trim());
    if (parts.length < 3 || parts.length % 2 === 0) return false;
    return parts.every((x, i) => (i % 2 === 0 && i !== parts.length - 1) || lit.test(x) || x === "undefined");
  };
  const bad = all.filter(v => !(lit.test(v) || PASS.includes(v) || litChain(v)));
  assert.deepEqual(bad, [], "这些挂点不是写死的名字，能把值夹带进 DOM：\n  " + bad.join("\n  "));

  // ②的另一半：转交那一支，每个调用点传的也必须是写死的名字
  for (const src of [comp, fs.readFileSync(path.join(__dirname, "..", "js", "core.js"), "utf8")]) {
    const calls = [...src.matchAll(/\bwk:\s*([^,\n}]+)/g)].map(m => m[1].trim());
    const bad2 = calls.filter(v => !(lit.test(v) || litChain(v)));
    assert.deepEqual(bad2, [], "这几处把变量当挂点名递进去了：\n  " + bad2.join("\n  "));
  }
  // Svg / Marquee 收到什么就原样放上去，自己不许再拼
  const core = fs.readFileSync(path.join(__dirname, "..", "js", "core.js"), "utf8");
  assert.match(core, /"data-wk": wk \|\| undefined,/, "Svg 那一支不是原样放上去的");
  assert.match(comp, /"data-wk": wk \|\| undefined,/, "Marquee 那一支不是原样放上去的");
});
