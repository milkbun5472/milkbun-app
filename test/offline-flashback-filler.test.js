const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");

// 她 2026-08-28：「人设卡写了王爷当了十二年质子，线下现在每轮都在十二年前刚入京」。
// 回忆是最便宜的填充：要凑篇幅、要给这一刻添点重量时，卡里最显眼的那段往事永远是
// 第一个被抓过来的，而且每一轮模型都觉得「这次真用得上」——所以规则压不住，
// 得照 crossChannelSaid 那套，把【已经讲过的】摆回它面前。

const F = (() => {
  const i = engine.indexOf("const FLASHBACK_CUE");
  assert.ok(i > 0, "取数函数没了");
  const j = engine.indexOf("function offlineHistory(msgs", i);
  return new Function(engine.slice(i, j) + "\nreturn { offlineFlashbacksSaid, offlineFlashbackBlock };")();
})();

// 她截图里那一段的原文
const REAL = `画的那道墨痕在夜风里彻底发硬了，笑一下都扯着皮肉。
十二岁那年刚到京城，住在礼部安排的驿馆里。外头守着四个带刀的禁军。那时候我知道，所有规矩都是刀刃。后来长大了，成了名正言顺的靖安王，进出宫禁有仪仗。
到了你这儿，门闩形同虚设，丫鬟婆子习以为常。`;

test("她那一段里的往事要认出来，眼前发生的事不许被当成回忆", () => {
  const got = F.offlineFlashbacksSaid([REAL]);
  assert.ok(got.some(x => x.indexOf("十二岁那年刚到京城") === 0), "最典型的那一句没抓到：" + JSON.stringify(got));
  assert.ok(!got.some(x => x.indexOf("画的那道墨痕") >= 0), "把此刻正在发生的事当成回忆了");
  assert.ok(!got.some(x => x.indexOf("到了你这儿") >= 0), "把此刻正在发生的事当成回忆了");
});

test("只认把叙事拉回过去的路标，当下的时间语一律放过", () => {
  [
    "今年的雪来得早，院子里那株梅还没开。",
    "明年开春我带你去趟江南。",
    "这几年府里添了不少人。",
    "过几年再说吧。",
    "他把手里的茶盏放下，抬眼看她。"
  ].forEach(t => assert.deepEqual(F.offlineFlashbacksSaid([t]), [], "误抓：" + t));
});

test("常见的几种回忆开头都要认得", () => {
  [
    "当年在北境那一战，他左肩中过一箭。",
    "小时候母亲总说我坐没坐相。",
    "三年前她还不是这个样子。",
    "初到王府那阵，连门在哪儿都摸不清。",
    "刚到京城的时候，连口热汤都喝不上。",
    "早年他也不是没试过。"
  ].forEach(t => assert.equal(F.offlineFlashbacksSaid([t]).length, 1, "漏了：" + t));
});

test("同一段讲两遍只摆一条，且最多摆五条", () => {
  const dup = F.offlineFlashbacksSaid([REAL, REAL]);
  assert.equal(new Set(dup).size, dup.length, "重复的没去掉");
  const many = Array.from({ length: 12 }, (_, i) => "当年那件事第" + i + "回。");
  assert.equal(F.offlineFlashbacksSaid(many).length, 5);
});

test("一段都没讲过就什么都不发，别白占上下文", () => {
  assert.equal(F.offlineFlashbackBlock([]), "");
  assert.equal(F.offlineFlashbackBlock(["他把茶盏放下，抬眼看她。"]), "");
  assert.match(F.offlineFlashbackBlock([REAL]), /〔这场线下里你已经往回讲过的事〕/);
});

test("单聊线下和群线下都要挂上这条尾巴，数字生命不发", () => {
  const single = engine.match(/async function generateOffline\([\s\S]*?async function summarizeOffline/)[0];
  assert.match(single, /const flashbackTail = isDigital \? "" : offlineFlashbackBlock\(/, "言秋那条线不发扮演类规则");
  assert.match(single, /characterSupplyTail \+ flashbackTail \+ styleTail/, "拼进去了才算发");
  const group = engine.match(/async function generateOfflineGroup\([\s\S]*?async function summarizeOfflineGroup/)[0];
  assert.match(group, /const gFlashbackTail = offlineFlashbackBlock\(/);
  assert.match(group, /content: hist\[hist\.length - 1\]\.content \+ gFlashbackTail \+ gTail/);
});

test("叙事准则里也要有这一条，而且带可判定的那一句", () => {
  const runtime = engine.match(/const OFFLINE_NARRATIVE_RUNTIME = `([\s\S]*?)`;/)[1];
  assert.match(runtime, /【别拿身世当填充】/);
  assert.match(runtime, /回忆不是免费的重量/);
  assert.match(runtime, /把这段回忆整段删掉/, "光讲道理不管用，得给一把能自己量的尺子");
});
