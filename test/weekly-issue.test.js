const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// 资料室(2026-08-18 Lisa):专访一直只喂角色卡、没有声纹样本(日记有);
// 四个媒体腔换的是戏服不是视角，所以补两块靠真实数据说话的版面。
test("专访接入声纹样本，资料室语录逐字验真、数据本地统计", () => {
  const w = fs.readFileSync(path.join(__dirname, "..", "js", "weekly.js"), "utf8");
  assert.match(w, /function ownVoiceLines\(material, name\)/, "要能从素材里抽出本人原话");
  assert.match(w, /本周真实说过的话 · 声纹最高优先/, "专访要有声纹样本块");
  assert.match(w, /function weeklyStats\(mat, characters, uName\)/, "统计必须本地算");
  assert.match(w, /数字、人名、词全部照抄，一个都不许改/, "模型只配文，不碰数字");
  assert.match(w, /hay\.indexOf\(q\.text\) > -1/, "语录必须逐字来自真实记录");
  assert.match(w, /type: "desk"/, "资料室要成为一个版块");
  assert.match(w, /QUOTED · 本周语录/);
  assert.match(w, /BY THE NUMBERS/);
});

// 第二步(2026-08-18):四个媒体腔换的是戏服不是视角 → 扩池到 6 个、每期抽 3，
// 并补一块真正换立场的「读者来信」，外加更正启事与中缝广告(搭资料室的便车，不额外调用)。
test("媒体腔按周抽签，来信/更正/中缝到位", () => {
  const w = fs.readFileSync(path.join(__dirname, "..", "js", "weekly.js"), "utf8");
  const seg = w.slice(w.indexOf("const VOICES = ["), w.indexOf("// ---- 报道周窗口"));
  const mod = new Function(seg + "; return { VOICES: VOICES, voicesForWeek: voicesForWeek };")();
  assert.ok(mod.VOICES.length >= 6, "池子要够抽");
  assert.equal(mod.voicesForWeek("2026-W31").length, 3, "每期只出三块");
  assert.deepEqual(mod.voicesForWeek("2026-W31").map(v => v.id), mod.voicesForWeek("2026-W31").map(v => v.id),
    "同一周重抽必须一致，否则重刷会换掉整本刊物的构成");
  assert.notDeepEqual(mod.voicesForWeek("2026-W31").map(v => v.id), mod.voicesForWeek("2026-W34").map(v => v.id),
    "不同周应当抽出不同组合");
  assert.match(w, /async function genLetters/, "读者来信要换立场而不是换口音");
  assert.match(w, /type: "letters"/);
  assert.match(w, /CORRECTION · 更正/);
  assert.match(w, /CLASSIFIEDS · 中缝/);
  assert.match(w, /genMediaBatch\(active, weekVoices,/, "出刊要用抽签结果而不是全量 VOICES");
});

// 排版与省钱(2026-08-18 Lisa:一页光秃秃只有文字；每次点进版块还停在上一页的滚动位置)
test("周刊有纸感与分版视觉，换版回顶，且资料室只调一次", () => {
  const w = fs.readFileSync(path.join(__dirname, "..", "js", "weekly.js"), "utf8");
  assert.match(w, /const VOICE_LOOK = \{/, "每个媒体腔要有自己的视觉，不能排成一个样");
  assert.match(w, /function paperStyle\(t\)/, "要有纸感底，不是纯色背景");
  assert.match(w, /float: "left"/, "首段要有落款首字（drop cap）");
  assert.match(w, /transform: "rotate\(-7deg\)"/, "期数做成盖歪的印章");
  assert.match(w, /borderBottom: "1px dotted " \+ t\.line/, "目录要有引线");
  assert.match(w, /scrollRef\.current\.scrollTop = 0/, "换版必须回到顶部");
  // 资料室一次调用出五块，别再各调各的
  assert.match(w, /genDeskPage\(active, globalText, stats, userName, personasFor/);
  assert.match(w, /const total = 1 \+ charsWithMat\.length \+ weekVoices\.length \+ 1;/);
});
