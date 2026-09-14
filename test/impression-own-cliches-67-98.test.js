// 她 2026-09-13：禁令那张死名单该换成从册子里现算。
//
// 「光照比喻」「温度计词」是 2026-08 拿四张卡对照抓出来的，硬写在提示词里。
// 可一年后写滥的会是别的族，名单还停在八月——而且按 bans-make-it-dumber.md，
// 名单越长注意力摊得越薄。改成：有账可查就让真账说话，没账才发那张老经验。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "js/impression.js"), "utf8");

function boot() {
  const sent = [];
  const sandbox = {
    React: { useState: () => [null, () => {}], useEffect: () => {}, useRef: () => ({}) },
    h: () => null, console,
    saveJSON: () => true, loadJSON: (k, d) => d,
    localStorage: { getItem: () => null, setItem: () => {} },
    parseJSONLoose: () => ({ title: "守夜人", tags: ["静谧", "疏离", "松弛"], quote: "她是一段慢下来的河。",
      moment: "她把最后一块留着", shift: "还是那样", him: "我提前收工了", silhouette: "侧影，冷色调" }),
    callAI: async (active, sys) => { sent.push(sys); return "{}"; }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: "impression.js" });
  return { M: sandbox.window.Impression, sent };
}
const ROWS = Array.from({ length: 40 }, (_, i) => ({ ts: Date.parse("2026-08-0" + (i % 9 + 1) + "T10:00:00"),
  who: i % 2 ? "沈屿白" : "丽莎", text: "第" + i + "句话，够长了可以当声纹样本。" }));
const CHAR = { id: "c1", name: "沈屿白", persona: "话不多" };
const PROFILE = { name: "丽莎" };

test("跨卡还在用才算口头禅，一张卡里自己repeat不算", () => {
  const { M } = boot();
  // 同一张卡里「晨光」出现三次：那是这一张的事
  const one = M.overusedTerms([{ quote: "晨光。晨光。晨光。" }]);
  assert.equal(one.length, 0);
  // 三张卡里都有「晨光」：这才是册子的口头禅
  const many = M.overusedTerms([{ quote: "像晨光。" }, { title: "晨光收信人" }, { tags: ["晨光偏暖"] }]);
  assert.equal(many[0].word, "晨光");
  assert.equal(many[0].cards, 3);
});

test("虚词不许混进来", () => {
  const { M } = boot();
  const out = M.overusedTerms([{ quote: "她是那样的人。" }, { quote: "她是这样的人。" }]).map(x => x.word);
  ["她是", "的人", "那样"].forEach(w => assert.ok(!out.includes(w), w + " 是虚词，不该被点名"));
});

test("有账可查时发真账，那张 2026-08 的老名单退场", async () => {
  const { M, sent } = boot();
  const book = { c1: [
    { monthKey: "2026-05", title: "晨光收信人", tags: ["清透"], quote: "她是一束晨光。", ts: 1 },
    { monthKey: "2026-06", title: "另一个", tags: ["晨光偏暖"], quote: "她像晨光落在桌上。", ts: 2 }
  ] };
  await M.genText({}, CHAR, PROFILE, "2026-08", ROWS, "", M.genOpts(book, "c1", "2026-08", 0));
  const sys = sent[0];
  assert.match(sys, /【这本册子自己的口头禅 · 这一次绕开】/);
  assert.match(sys, /「晨光」（2 张卡里都有）/);
  assert.match(sys, /这几个不是坏词，是已经被这本册子用出茧子了/);
  // 给出口不给判决：不是"不许写"，是"换别的说法；真要用得落在别的位置上"
  assert.match(sys, /真要用其中一个，它得落在一个和以前完全不同的位置上/);
  assert.ok(!/温度计词/.test(sys), "有真账了就别再发那张会过期的老名单");
});

test("册子还空着时，才发那张老经验兜底", async () => {
  const { M, sent } = boot();
  await M.genText({}, CHAR, PROFILE, "2026-08", ROWS, "", M.genOpts({}, "c1", "2026-08", 0));
  assert.match(sent[0], /温度计词/);
  assert.ok(!/口头禅/.test(sent[0]));
  // 兜底那段也改成了给出口：不再是「整族不许碰」
  assert.match(sent[0], /否则先绕开/);
  assert.ok(!/整族不许碰/.test(src));
});

test("别人的卡和自己刚写完那一版也算进账", async () => {
  const { M, sent } = boot();
  const book = {
    c1: [{ monthKey: "2026-05", quote: "她像一枚硬币。", ts: 1 }],
    c2: [{ monthKey: "2026-05", quote: "她也像一枚硬币。", ts: 2 }]
  };
  await M.genText({}, CHAR, PROFILE, "2026-08", ROWS, "", M.genOpts(book, "c1", "2026-08", 0));
  assert.match(sent[0], /「硬币」（2 张卡里都有）/, "跨角色撞的词才是最该点名的");
});
