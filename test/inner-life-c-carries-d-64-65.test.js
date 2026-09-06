// v64.34 我把 C 睡眠意识的两个 script 当成死代码从 index.html 里删掉了。
// C 自己确实什么都不拦（gateCheck 每一支都 return allow:true），但【D 做梦挂在它身上】：
// DreamLoop.observe 要 C 算出来的 sleepState 才知道 REM 窗到没到，而那一行就写在
// `if (window.SleepShadow)` 的里面。删掉之后 D 一起停了——不报错、界面上也看不出来，
// 「他做的梦」只是从那天起再没多一条。这一份是那次的封条。
//
// ⚠️她 2026-09-06 指着「TA 是什么脾气」问「这个 a 和 c 现在是啥情况」时查出来的。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => path.resolve(__dirname, "..", f);
const html = fs.readFileSync(P("index.html"), "utf8");
const app = fs.readFileSync(P("js/app.js"), "utf8");
const comp = fs.readFileSync(P("js/components.js"), "utf8");
const eng = fs.readFileSync(P("js/engine.js"), "utf8");
const scr = fs.readFileSync(P("js/screens.js"), "utf8");

test("D 要用的那份作息还有人算：C 的两个 script 必须在 index.html 里", () => {
  assert.match(html, /js\/inner-life-c-sleep-core\.js/, "C core 不在了，window.InnerLifeCSleepCore 就是 undefined");
  assert.match(html, /js\/inner-life-c-sleep-shadow\.js/, "C shadow 不在了，window.SleepShadow 就是 undefined");
  assert.match(html, /js\/dream-loop-core\.js/);
  assert.match(html, /js\/dream-loop-shadow\.js/);
  // 顺序：D 的 observe 读 C 的返回值，两边都得先加载好
  assert.ok(html.indexOf("inner-life-c-sleep-shadow.js") < html.indexOf("dream-loop-shadow.js"),
    "C 要排在 D 前面");
});

test("D 的 observe 确实是挂在 C 的 tick 里的——这条依赖不许悄悄消失", () => {
  const i = app.indexOf("if (window.SleepShadow) {");
  assert.ok(i > 0, "C 的 tick 那一段没了");
  const seg = app.slice(i, i + 900);
  assert.match(seg, /window\.SleepShadow\.tick\(/);
  assert.match(seg, /window\.DreamLoop\.observe\(c, r\.state\)/, "D 的入口不在 C 的 tick 里了——那它靠什么拿 sleepState？");
  // 旁边必须写着「删 C 会带走 D」，不然下一个人还是会当它是死代码
  assert.match(app.slice(Math.max(0, i - 700), i), /D 做梦就挂在这个 if 里面/);
});

test("C 仍然是【只算不拦】：每一支都放行，不许偷偷变成真闸", () => {
  const c = fs.readFileSync(P("js/inner-life-c-sleep-shadow.js"), "utf8");
  const gate = c.slice(c.indexOf("function gateCheck"), c.indexOf("// ---- 云端 presence 投影"));
  assert.ok(gate.length > 100, "抠不出 gateCheck");
  const returns = gate.match(/return \{[^}]*\}/g) || [];
  assert.ok(returns.length >= 4, "gateCheck 的出口少于 4 个，形状变了要重看这条");
  returns.forEach(r => assert.match(r, /allow: true/, "有一支不放行了：" + r));
});

// ── A 那一层：页面上写的话必须跟它真的在干的事对得上 ──────────────────
// v62.37 起 A 就是常开的，正文会折成一句话进 system（engine.js 的【此刻的情绪底色】）。
// 可「TA 是什么脾气」那一页从那天起一直写着「不会进 prompt」「只看不注入」——
// 她 2026-09-06 指着问的就是这个。
test("A 真的在往提示词里发，所以页面上不许再写它不发", () => {
  assert.match(eng, /parts\.push\("【此刻的情绪底色·只作内在背景】" \+ ctx\.aMood\.trim\(\)/,
    "A 的投影不再进 system 了？那下面几条断言要整个重看");
  assert.match(app, /aMood: aMoodTextOf\(char\.id\)/, "单聊那一路没接上");
  // ⚠️只查【会显示出来的字符串】——注释里照旧写着「原来那句是假的」，那是留给
  //   下一个人看的记录，不该被这条误伤。
  const shown = comp.split("\n").filter(l => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  ["现在不会进 prompt", "不会改变 Ta 的语气", "A 影子 · 只看不注入", "若开阀会投影"].forEach(bad => {
    assert.ok(!shown.includes(bad), "这句话是假的，还留在「TA 是什么脾气」上：" + bad);
  });
  // ⚠️只查 A 那一张诊断台：五感和 B 确实还是纯影子，它俩说「纯影子诊断」是对的，
  //   一刀切会把两句真话也误伤掉。
  const aSheet = scr.slice(scr.indexOf("function InnerLifeADiagnosticSheet"), scr.indexOf("// 五感系统 v1"));
  assert.ok(aSheet.length > 500, "抠不出 A 的诊断台");
  ["纯影子诊断", "只算不注入", "已获试点授权"].forEach(bad => {
    assert.ok(!aSheet.includes(bad), "这句话是假的，还留在 A 诊断台上：" + bad);
  });
  assert.match(aSheet, /常开/, "得说清它现在是开着的");
});

test("底色那几个词是发给模型的，这一页得说出来", () => {
  // ⚠️anchor 在 sec("temperament") 上：show("temper" 有两处，头一处是「正在影响 TA」那一页
  const i = comp.indexOf('...sec("temperament")');
  assert.ok(i > 0, "抠不出底色那一页");
  const seg = comp.slice(i, i + 1400).split("\n").filter(l => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  // v64.66 换成人话了：不说「进 prompt」，说「会一直垫在他说话的底下」——
  // 意思一样，但发给别人玩的时候读得懂。
  assert.match(seg, /会一直垫在 " \+ cNm \+ " 说话的底下/, "得说清这几个词是真在起作用的");
  // 「只是不影响脾气」说的是【认不出来的那几个词】，那句是对的，别误伤
  assert.ok(!/不会进 prompt|不会改变|不影响 " \+ cNm|对 " \+ cNm \+ " 没有影响/.test(seg), "不许再说它不起作用");
});

// ⚠️v64.66：作息真的管事了，那一行从「还没派上用场」挪进了「正在影响」，
//   所以它现在的落点是 live.push 那一条，不再是 shadow.push。
test("作息那一层在页面上写清了它在干嘛", () => {
  const i = comp.indexOf('key: "sleep", title: "作息"');
  assert.ok(i > 0, "作息那一条没了");
  const seg = comp.slice(i, i + 400);
  assert.match(seg, /照自己那份日程过日子/);
  assert.match(seg, /睡着的时候不会主动来找你/);
});
