// 匿名马甲（她 2026-09-05：「匿名信箱生成出来的马甲和签名太依赖上下文了」）。
//
// 她截图里那一个：网名「本地无条件备份节点」、签名「就算数据丢了也没关系，我这里
// 永远存着一份」、背景图「亮着的代码终端旁边放着刚倒满温水的保温杯」——三样都是
// 把他这个人和他此刻在干嘛原样复述了一遍。那不是马甲，是工牌。
//
// 两半都得有（「规则降概率，代码才保证」）：
//   规则 —— 一条共用的判据，三处一起吃
//   代码 —— 这一枪不发【最近对话】，模型手上根本没有那份材料
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), engine = R("engine.js");
// ⚠️注释里会提到常量名、也会引用那几个被删掉的例子（就是为了说明为什么删）。
//   照原文搜的话，解释禁令的那行注释本身会被当成违规——所以先把整行注释剥掉再搜。
const appCode = app.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
const engineCode = engine.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
const rule = engine.slice(engine.indexOf("const ANON_MASK_RULE = `"), engine.indexOf("`;", engine.indexOf("const ANON_MASK_RULE = `")));
const bg = engine.slice(engine.indexOf("const ANON_MASK_BG = `"), engine.indexOf("`;", engine.indexOf("const ANON_MASK_BG = `")));

test("三处马甲共用同一条规矩，不许各写各的", () => {
  // 角色首次生成 / 角色刷新 / 她自己那一个
  assert.equal((appCode.match(/ANON_MASK_RULE/g) || []).length, 3, "三处得都吃到");
  assert.equal((appCode.match(/ANON_MASK_BG/g) || []).length, 2, "背景图那条给两处角色马甲用");
  assert.match(engine, /const ANON_MASK_RULE = `/);
  assert.match(engine, /const ANON_MASK_BG = `/);
});

test("规矩给的是判据，不是内容示范（prompt-no-content-samples）", () => {
  // 判据一句话：单独摘出来，认不认得出是谁
  assert.match(rule, /判据一句话/);
  assert.match(rule, /猜得到就是写坏了/);
  // 不许进网名的那几样，一样都不能少
  ["职业", "此刻在做什么", "口头禅", "简历"].forEach(w =>
    assert.ok(rule.includes(w), "少挡了一样：" + w));
  // 人设是拿来定语气的，不是拿来抄内容的——这句是这条规矩的题眼
  assert.match(rule, /定语气/);
  assert.match(rule, /不是给你抄内容用的/);
  // ⚠️一个内容示范都不许有：写了模型就照抄那个句式，一排马甲全长成一个样。
  //   原来那三个例子（「深夜城市天台的霓虹倒影」那一串）就是这么害的。
  ["深夜城市天台的霓虹倒影", "一只蜷着睡的橘猫", "褪色的旧船票特写"].forEach(x =>
    assert.ok(!appCode.includes(x) && !engineCode.includes(x), "旧那个内容示范还在：" + x));
  assert.ok(!/「[^」]{4,20}」「[^」]{4,20}」「[^」]{4,20}」/.test(rule), "规矩里又举了一串例子");
  assert.ok(!/如「/.test(rule) && !/如「/.test(bg), "规矩里又写了「如……」的示范");
});

test("背景图那条挡的是「把定位挂上去」", () => {
  assert.match(bg, /他此刻所在的地方/);
  assert.match(bg, /马甲就白戴了/);
  assert.match(bg, /别去描述他本人/);
});

test("代码这一道：马甲这一枪不发最近对话", () => {
  // 只靠提示词是降概率——材料还在模型手上，它迟早还会去抄
  const shots = app.match(/runProbe\(apiFor\(char\.id\), \{ \.\.\.ctxFor\(char\), recentChat: "" \}/g) || [];
  assert.equal(shots.length, 2, "两处角色马甲都得掐掉最近对话，实际 " + shots.length);
  // 人设和心情照给——那是拿来定语气的，掐掉就没语气可跟了
  const seg = app.slice(app.indexOf("const openAnon = async char"), app.indexOf("const anonBans"));
  assert.ok(!/persona: ""/.test(seg), "把人设也掐了，那就没东西定语气了");
  // 她自己那一个本来就只递一张空壳卡，不用再掐
  const mine = app.slice(app.indexOf('给用户「') - 400, app.indexOf('给用户「') + 200);
  assert.match(mine, /persona: ""/);
});

test("刷新那一枪照旧跟着心情走——掐的是材料，不是语气", () => {
  const seg = app.slice(app.indexOf("const refreshAnonPersona = async char"), app.indexOf("const refreshAnonPersona = async char") + 2200);
  assert.match(seg, /心情变了就换一套/, "刷新不再跟心情走了，那这个按钮就没意义了");
  assert.match(seg, /跟以前那套不许重样/);
  assert.match(seg, /recentChat: ""/);
});
