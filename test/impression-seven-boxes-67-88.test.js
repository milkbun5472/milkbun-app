// 她 2026-09-13 看完月度印象：「整体这种文案格式会不会不够好」。
//
// 病根不是文笔，是【四个格子在说同一句话】：title／tags／quote／silhouette
// 抽象程度完全一样，一张卡读下来信息量只有一格。这一刀改分工：
//   moment＝具体的那一件（quote 原来整张卡都禁具体，钩子被一起扔了）
//   shift ＝比上个月变了哪儿（第一张没有上个月，改问「在这之前你以为她是什么样」）
//   him   ＝这个月她把你改到了哪儿（整张卡唯一一句他在说自己）
// 顺带：往期喂全、上一版单拎一栏（原来被 slice(0,6) 切掉）、两处拷贝合一。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "js/impression.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 真跑这一份：只补它加载时要的那几个全局，callAI 当桩把 sys 接下来
function boot() {
  const sent = [];
  const sandbox = {
    React: { useState: () => [null, () => {}], useEffect: () => {} },
    h: () => null, Svg: null, console,
    saveJSON: () => true, loadJSON: (k, d) => d,
    localStorage: { getItem: () => null, setItem: () => {} },
    parseJSONLoose: () => ({ title: "清冷的守夜人", tags: ["静谧", "疏离", "松弛"], quote: "她是一段慢下来的河。",
      moment: "她把最后一块留着说自己不饿", shift: "还是那样，只是我更确定了", him: "我第一次提前收工",
      silhouette: "侧影，身后一轮月亮，冷色调" }),
    callAI: async (active, sys) => { sent.push(sys); return "{}"; }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: "impression.js" });
  return { M: sandbox.window.Impression, sent };
}
const ROWS = Array.from({ length: 40 }, (_, i) => ({ ts: Date.parse("2026-08-0" + (i % 9 + 1) + "T10:00:00"),
  who: i % 2 ? "沈屿白" : "丽莎", text: "第" + i + "句话，够长了可以当声纹样本用。" }));
const CHAR = { id: "c1", name: "沈屿白", persona: "一个话不多的人" };
const PROFILE = { name: "丽莎" };

test("七个格子都进了提示词，而且 silhouette 还在最后（截断哨兵）", async () => {
  const { M, sent } = boot();
  await M.genText({}, CHAR, PROFILE, "2026-08", ROWS, "", M.genOpts({}, "c1", "2026-08", 0));
  const sys = sent[0];
  ["④ moment", "⑤ shift", "⑥ him", "⑦ silhouette"].forEach(k => assert.ok(sys.includes(k), "少了 " + k));
  assert.match(sys, /\{"title":"","tags":\["","",""\],"quote":"","moment":"","shift":"","him":"","silhouette":""\}/);
  // 哨兵：silhouette 必须是 JSON 里最后一个字段，截断才必定丢
  const j = sys.slice(sys.lastIndexOf('{"title"'));
  assert.ok(j.indexOf("silhouette") > j.indexOf("him"), "silhouette 不在最后了，哨兵失效");
  // 具体的事有了自己的格子，quote 那条禁令改成了指路
  assert.match(sys, /具体的事另有去处/);
});

test("第一张没有「上个月」：改问「在这之前你以为她是什么样」", async () => {
  const { M, sent } = boot();
  const out = await M.genText({}, CHAR, PROFILE, "2026-08", ROWS, "", M.genOpts({}, "c1", "2026-08", 0));
  assert.match(sent[0], /这是你为她写的第一张，还没有「上个月」可比/);
  assert.match(sent[0], /在这个月之前，你以为她是什么样的人/);
  assert.ok(!/上个月你写的是这一张/.test(sent[0]), "没有上一张却还在要她跟上个月比");
  assert.equal(out.firstShift, true);
});

test("有上一张时，把上一张整张摆出来，而且允许他说「没变」", async () => {
  const { M, sent } = boot();
  const book = { c1: [{ monthKey: "2026-07", title: "白日游神", tags: ["轻", "散", "亮"], quote: "她是一阵没打算停的风。", ts: 1 }] };
  const out = await M.genText({}, CHAR, PROFILE, "2026-08", ROWS, "", M.genOpts(book, "c1", "2026-08", 0));
  assert.match(sent[0], /上个月你写的是这一张——白日游神 ｜ 轻／散／亮 ｜ 她是一阵没打算停的风。/);
  assert.match(sent[0], /没变也可以说没变/);          // 不给出口它每个月都得编一个变化
  assert.equal(out.firstShift, false);
});

test("上一个月按【月份序】取，不是按生成顺序（补齐是乱序写的）", () => {
  const { M } = boot();
  // 7 月那张是最后生成的（ts 最大），但 3 月的上一张必须是 2 月
  const book = { c1: [{ monthKey: "2026-07", quote: "七月", ts: 99 }, { monthKey: "2026-02", quote: "二月", ts: 3 }] };
  assert.equal(M.genOpts(book, "c1", "2026-03", 0).prev.quote, "二月");
  assert.equal(M.genOpts(book, "c1", "2026-08", 0).prev.quote, "七月");
  assert.equal(M.genOpts(book, "c1", "2026-01", 0).prev, null);
});

test("「只重写文案」时，自己上一版不会再被 slice 切掉", async () => {
  const { M, sent } = boot();
  const mine = ["01", "02", "03", "04", "05", "06", "07"].map(m => ({ monthKey: "2026-" + m, title: "旧卡" + m, quote: "旧句子" + m, ts: Number(m) }));
  const cur = { monthKey: "2026-08", title: "这一版的名字", quote: "这一版写的那句话。", tags: ["甲", "乙", "丙"] };
  await M.genText({}, CHAR, PROFILE, "2026-08", ROWS, "", M.genOpts({ c1: mine.concat([cur]) }, "c1", "2026-08", 1, cur));
  const sys = sent[0];
  assert.match(sys, /【你刚写完的那一版 · 这次就是要换掉它，最要紧】/);
  assert.ok(sys.includes("这一版写的那句话。"), "上一版又被切掉了（往期满六条时的老毛病）");
  // 往期喂的是整张卡，不再只有 quote——title 的模子才是月月撞的那一个
  assert.ok(sys.includes("旧卡01 ｜ 旧句子01") || sys.includes("旧卡01 ｜  ｜ 旧句子01"), "往期没喂 title");
});

test("骰子不再掷到一个被禁的维度上", () => {
  assert.ok(!/她整个人的气温/.test(src), "「气温」那一面还在，可温度计词整族是禁的");
  assert.match(src, /温度计词/);     // 禁令本身还在
  assert.match(src, /她给人的重量/); // 换上的那一面
});

test("料只有一份：自动出卡那条不再自己拼一遍", () => {
  const seg = app.slice(app.indexOf("const autoImpressionSweep"), app.indexOf("const autoImpressionSweep") + 3000);
  assert.match(seg, /M\.archiveFor\(char\.id, groups,/);
  assert.match(seg, /M\.genOpts\(M\.load\(\), char\.id, monthKey, 0\)/);
  assert.match(seg, /M\.entryOf\(d, monthKey, img, 0\)/);
  assert.ok(!/memoryInterop === false/.test(seg), "互通群那条判据还是它自己那一套");
  // 手动那两条也走同一份
  assert.match(src, /M\.genOpts\(liveBook\(\), charId, monthKey, 0\)/);
  assert.match(src, /M\.genOpts\(liveBook\(\), charId, entry\.monthKey, turn, entry\)/);
  assert.equal(src.split("M.archiveFor(").length - 1, 1);
});

test("新三格空着不算写坏：不为了一格空掉整张卡", async () => {
  const { M } = boot();
  const sandboxed = await M.genText({}, CHAR, PROFILE, "2026-08", ROWS, "", M.genOpts({}, "c1", "2026-08", 0));
  assert.equal(sandboxed.moment, "她把最后一块留着说自己不饿");
  assert.equal(sandboxed.him, "我第一次提前收工");
  // 存的时候三格都在，老卡没有就是空字符串
  const e = M.entryOf({ title: "a", tags: ["x"], quote: "q", silhouette: "s" }, "2026-08", null, 0);
  assert.equal(e.moment, ""); assert.equal(e.shift, ""); assert.equal(e.him, "");
});
