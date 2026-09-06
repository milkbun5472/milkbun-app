// 放歌不许自己花钱（她 2026-09-06：「一起听这一句不会在偷偷调用吧，能不能不要了」）。
//
// 那一句是真的在偷偷调用：autoComment 开着的时候，触发条件是
// 「歌变了 + 她正好在那个人的私聊里」——而歌会【自动连播】，
// 于是一晚上放二十首＝二十次 proactive 回复，全程没有任何一处要她点头，
// 而她按次计费。整套（开关 + 那段 effect + 存档字段）一起撤掉。
//
// ⚠️他仍然知道你俩在听什么：buildBundle 里那一行照旧发，那是白送的、不花钱，
//   她问起来他接得住——撤掉的只是「他自己开口」这件事。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
// 注释里留着来龙去脉是对的，断言不能被注释喂饱（audit 那几次的教训）
const code = s => s.split("\n").filter(l => l.trim().indexOf("//") !== 0).join("\n");

test("撤得干净：开关、存档字段、那段 effect 一处不留", () => {
  [["js/app.js", code(app)], ["js/screens.js", code(scr)]].forEach(([f, c]) => {
    assert.equal(c.indexOf("autoComment"), -1, f + " 里还留着 autoComment");
  });
  assert.equal(code(app).indexOf("setListenAutoComment"), -1, "开关的写入口还在");
  assert.equal(code(app).indexOf("lastAutoSongRef"), -1, "那段 effect 的游标还在");
  assert.equal(code(scr).indexOf("onSetAutoComment"), -1, "prop 还挂在那儿");
  assert.equal(code(scr).indexOf("在聊天里聊这首歌"), -1, "界面上那一行还在");
});

test("换歌这件事不许再挂着任何一次模型调用", () => {
  // player.songId 变化不许再驱动 replyNow
  const hits = code(app).split("\n").filter(l => /player\.songId/.test(l) && /replyNow|proactive/.test(l));
  assert.deepEqual(hits, [], "换歌还连着一次调用：" + hits.join(" / "));
  // 盯着 songId 的 effect 还有一个（唱片针位），但它必须是纯本机的：
  // 里面出现 replyNow / runTurn / callAI 任何一个，换歌就又开始花钱了
  const c = code(app);
  let at = 0;
  while ((at = c.indexOf("}, [player.songId]);", at)) >= 0) {
    const body = c.slice(Math.max(0, at - 1400), at);
    const start = body.lastIndexOf("useEffect(() => {");
    const eff = start >= 0 ? body.slice(start) : body;
    ["replyNow", "proactive", "callAI", "runProbe"].forEach(bad =>
      assert.equal(eff.indexOf(bad), -1, "盯着换歌的 effect 里又挂上了 " + bad));
    at += 5;
  }
});

test("他还是知道你俩在听什么（那一层不花钱，不许一起撤掉）", () => {
  assert.match(app, /【你正和 " \+ uName \+ " 一起听】/, "连「正在听什么」这一层也撤了");
  assert.match(app, /如果 " \+ uName \+ " 问起你在听什么\/这首歌，你清楚就是这首/,
    "被动那一支没留住——他会装不知道");
  // 那一行不许再分岔：只剩一种说法，没有「开了就主动聊」那一支
  const line = app.split("\n").find(l => l.indexOf("【你正和 ") >= 0);
  assert.ok(line.indexOf("或想换首歌") < 0, "主动那一支的文案还在，模型照样会自己起头");
});
