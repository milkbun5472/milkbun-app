// 电台第一版接上没有。这一份钉的是【接线】——js/radio.js 那一份算得再对，
// 没接到屏幕上、没接到 callAI 上，她拧不动就等于没做（v55.95 那条：声明了但没人引用，
// 比压根没写更坏，因为看代码以为已经在跑了）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js"), comp = R("js/components.js"), html = R("index.html"), ui = R("js/radio-ui.js");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");

test("主屏上有这个图标，两个文件也真的被加载", () => {
  assert.match(comp, /radio: \{ kind: "app", zh: "电台", G: window\.GRadio/);
  assert.match(ui, /root\.GRadio = /, "REG 指着一个不存在的图标，主屏上会掉回默认那个");
  assert.match(html, /<script src="js\/radio\.js\?v=/);
  assert.match(html, /<script src="js\/radio-ui\.js\?v=/);
  assert.ok(html.indexOf("js/radio.js") < html.indexOf("js/radio-ui.js"), "界面先于逻辑加载");
  assert.ok(html.indexOf("js/radio-ui.js") < html.indexOf("js/app.js"), "app.js 先跑的话 window.GRadio 还不存在");
});

test("拧得到：整页路由 + 退出之后那一条悬浮", () => {
  assert.match(app, /screen === "radio"\) body = \(window\.RadioUI \? h\(window\.RadioUI\.RadioScreen/);
  assert.match(app, /window\.RadioUI && screen !== "radio"\) \? h\(window\.RadioUI\.RadioMini/,
    "退出电台就没有那一条了——她要的是「悬浮 title 就写电台名字」");
  assert.match(ui, /className: "h-full flex flex-col"/, "整页那套外壳（施工规则/no-half-sheet.md）");
  assert.match(ui, /className: "flex-1 min-h-0 overflow-y-auto"/);
  assert.match(ui, /h\(Head, \{\s*\n?\s*zh: "电台"/, "自己手写顶栏＝又一次私搭乱建（mobile-ui-layout.md §1）");
  assert.match(ui, /bg: "transparent"/, "底纹铺在外壳上、顶栏透上来，不然顶上横一道没盖住的带子");
});

test("播放不住在组件里——她退出页面之后电台还在播", () => {
  assert.match(ui, /const Engine = \(\(\) => \{/);
  assert.match(strip(ui), /root\.RadioUI = \{ Engine: Engine/);
  // 位置一个字都不许存：Engine 里也不行
  assert.equal(strip(ui).indexOf("lastIndex"), -1);
  assert.match(ui, /Engine\.subscribe/, "组件不订阅的话，引擎在播、屏幕不动");
});

test("默认只看字不出声（她定的验收第一条）", () => {
  assert.match(ui, /let on = false, sound = false/, "默认就出声＝她那条验收标准从第一天起就试不了");
  assert.match(ui, /Engine\.settle\(\); Engine\.setPower\(true\); \}, \[\]\);/, "进电台页不开机");
  // 退出这一页不许关机——关了的话那条悬浮永远不出现，「退出去它还在播」就成了句空话
  assert.equal(ui.indexOf("return () => { Engine.setPower(false); }"), -1);
  assert.match(ui, /btn\("关掉电台", \(\) => \{ Engine\.setPower\(false\)/, "只有开没有关");
  // 显示到第几个字是按【这一条播了多久】算的，跟 TTS 无关——静音也要走字
  assert.match(strip(ui), /pos\.into \/ Math\.max\(1, pos\.item\.sec\)/);
  assert.equal(strip(ui).indexOf("onboundary"), -1, "靠 TTS 的回调驱动，关掉声音字就不动了");
});

test("扫过去的那几格不各花一次钱", () => {
  assert.match(ui, /const DWELL_MS = 900/);
  assert.match(ui, /setTimeout\(async \(\) => \{/);
  assert.match(ui, /return \(\) => clearTimeout\(tid\)/, "拧走了不取消，扫一遍频段就是十三枪");
});

test("三张单子都是「料全放 system、user 只留一句触发」", () => {
  const seg = app.slice(app.indexOf("const radioAsk = async"), app.indexOf("const genRadioDrift"));
  assert.match(seg, /callAI\(active, sys, \[\{ role: "user", content: "开始。" \}\], \{ maxTokens: 65535, tag: "电台" \}\)/);
  assert.ok(seg.indexOf("maxTokens: 2600") < 0 && seg.indexOf("maxTokens: 8000") < 0, "天花板压低了会截断正文");
  assert.match(seg, /没解析出东西。它回的是：/, "只说「解析失败」是个死胡同，报错里得带着我没看懂的那个东西本身");
});

test("频率由代码发，不用模型报的", () => {
  const seg = app.slice(app.indexOf("const genRadioWorld"), app.indexOf("const genRadioDay"));
  assert.match(seg, /const slots = R\.SLOTS\.slice\(\)/);
  assert.ok(seg.indexOf("raw.freq") < 0 && seg.indexOf("d.freq") < 0,
    "让模型报频率，它会往 88.0 / 101.1 这种好听的数字上挤，挤到一起就没有频段了");
  assert.match(seg, /R\.writeSeen\(R\.avoidPush\(seen, stations\.map\(x => x\.name\)\)\)/, "建过的台名没记进去，下次还会长成同一批");
});

test("每一枪都过闸——失败留痕迹，不然拧回来一次就是重打一枪", () => {
  const day = app.slice(app.indexOf("const genRadioDay"), app.indexOf("const genRadioDrift"));
  assert.match(day, /if \(!window\.AutoGate\.due\(key, period, \{ maxTries: 2, cooldownMs: 600000 \}\)\) return \[\];/, "没过闸");
  assert.match(day, /finally \{ window\.AutoGate\.mark\(key, period, items\.length > 0\); \}/,
    "抛异常就绕过记账＝失败没留痕迹，那正是 v65.03 一天八块钱的形状");
  const dri = app.slice(app.indexOf("const genRadioDrift"));
  assert.match(dri.slice(0, 900), /AutoGate\.claim\(key, period\)/, "掷临时台是一次就一枪，先占坑、成不成都不重来");
});

test("生成的时候不许顺手决定「今天有没有」", () => {
  const seg = strip(app.slice(app.indexOf("// ── 电台"), app.indexOf("const saveChar")));
  assert.ok(seg.indexOf("onAirToday") < 0 && seg.indexOf("signalToday") < 0,
    "今天在不在写进生成结果里，这个世界就只在她打开的那一刻才存在");
  assert.match(seg, /density: kind === R\.KIND\.DRIFT \? R\.DRIFT_DENSITY : 1/);
});

test("加速期的痕迹能一次清干净", () => {
  assert.match(app, /onClearDev: \(\) => window\.Radio\.clearDev\(\)/);
  assert.match(ui, /清掉测试痕迹/);
  assert.match(R("js/radio.js"), /if \(devShifted\(\)\) row\.dev = true;/, "不盖戳就分不清哪几天是测出来的");
});
