const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const engine = fs.readFileSync(path.join(__dirname, "..", "js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");
const sp = fs.readFileSync(path.join(__dirname, "..", "js/style-presets.js"), "utf8");

// 这个文件原本盯的是「补写循环别把已经写好的正文弄丢」。
// v55.62 起补写循环整个不存在了（她 2026-08-24：「都改。我永远只要一次」）——
// 她按次计费，多调一次就是多花一次钱，而那一次是在补我 prompt 没写好的窟窿。
// 病根查清楚了：max_tokens 是【天花板】不是预付款，思考模型的推理也从里面扣，
// 我压到 4200，推理吃光额度、正文只剩两百来字，然后再花调用去补。
// 她拿酒馆对比出来的：Ako 预设里 openai_max_tokens 就是 65535，一次调用写得又长又不断。
// 所以现在盯的是：一轮＝一次调用，额度给足，写不够照实说、正文照留。

test("一轮线下就是一次生成调用，没有补写那一路", () => {
  assert.ok(!/ensureOfflineMinimumScene/.test(engine), "补写函数和它的调用都要拆干净");
  const gen = engine.slice(engine.indexOf("async function generateOffline(p, ctx, session)"),
    engine.indexOf("async function summarizeOffline"));
  // 正文生成只有主调用和「模型不吐 JSON」的纯文本兜底，没有第三次
  const calls = gen.split("await callAI(").length - 1;
  assert.ok(calls <= 2, "generateOffline 里有 " + calls + " 处 callAI，多出来的那次是在花她的钱");
  assert.match(engine, /一轮就是一次调用/, "为什么只调一次，写在代码里");
  assert.match(engine, /她按次计费/);
});

test("额度给足：max_tokens 是天花板不是预付款", () => {
  assert.ok(!/NO_STREAM_CAP/.test(engine), "4200 那条上限不许留着");
  assert.match(engine, /window\.StylePresets\.outTokens\(minimumSceneChars/, "按最低字数算够用的天花板");
  assert.match(engine, /思考模型的推理 token 也算在里面/, "病因写在代码里");
  // 单人 / 群 / 小剧场三处都要给足
  assert.match(engine, /const gBudget = Math\.min\(window\.StylePresets\.OUT_CEILING/, "群线下");
  const theater = fs.readFileSync(path.join(__dirname, "..", "js/theater.js"), "utf8");
  assert.match(theater, /maxTokens: window\.StylePresets\.outTokens\(selfRevise \? 2400 : 1600\)/, "小剧场");
  assert.ok(!/maxTokens: selfRevise \? 6000 : 3200/.test(theater), "小剧场旧的窄额度不许留着");
});

test("字数规则三处共用一份：下限＋上限＋自己数着写", () => {
  assert.match(sp, /function wordRule\(minW\)/);
  assert.equal((engine.match(/window\.StylePresets\.wordRule\(/g) || []).length, 2, "单人线下与群线下各一处");
  // 只给下限、不给上限、不让它自己数——就是模型写到哪算哪的原因
  assert.ok(!/【最终正文硬下限】/.test(engine), "旧的只有下限那段不许留着");
  assert.match(sp, /不少于 " \+ minW \+ " 字、不超过 " \+ maxW \+ " 字/);
  assert.match(sp, /自己数着写/);
});

test("写不够时正文一律保留，并如实报数", () => {
  assert.match(engine, /const minimumShort = minimumSceneChars && minimumLengthChars < minimumSceneChars;/);
  assert.match(engine, /minimumLengthShortCount: minimumShort \? minimumLengthChars : 0/);
  assert.match(engine, /minimumLengthShortTarget: minimumShort \? minimumSceneChars : 0/);
  assert.match(engine, /minimumLengthShortBecause: minimumShort \? "模型就写了这么多，这一轮只调一次 API、没有再补写" : ""/);
  // 没写够绝不丢稿——这条是这个文件最早的由来，不许回退
  const gen = engine.slice(engine.indexOf("const minimumLengthChars"), engine.indexOf("const affinityDelta"));
  assert.ok(!/throw/.test(gen), "写不够就抛异常＝把她的正文丢了");
});

test("留了稿就要如实说，别让她以为最低字数的设置没生效", () => {
  assert.match(app, /if \(res && res\.minimumLengthShortBecause\)/);
  assert.match(app, /这篇只写到 " \+ _got \+ " 字/);
  assert.match(app, /正文已经保留/);
});
