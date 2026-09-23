// 她 2026-09-23：「我总觉得擂台是不是还是差点啥意思，有点无聊」。
// 查下来：擂台跟群里吵架唯一能不一样的，是【比分、裁判】——群里没人计分、没人判。
// 原来这两样全挤在「收台」那一下，中间几轮不知道谁占上风，所以中间是平的。
//
// 她定的规矩（原话）：
//   「这个投票可以按台下观众来投票决定他们觉得谁说得好，但是不能毫无根据。理由可以是因为
//    某位是朋友无条件支持，还有理念相同所以支持，或者说的点对他这个人有触动支持，或者没有
//    偏好随便选。然后立场也是可以改的……但是度要把控好，不要无厘头脑残粉支持，也不要墙头草每轮换」
//   赌注那一条她不要：「有些我就特意不要留记忆的」——所以这里什么都不写回记忆。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const dbt = fs.readFileSync(path.join(__dirname, "..", "js", "debate.js"), "utf8");
const fn = name => { const i = dbt.indexOf("function " + name + "("); assert.ok(i > 0, "抠不出 " + name); return dbt.slice(i, dbt.indexOf("\n  }\n", i) + 4); };

const V = (() => {
  const i = dbt.indexOf("const VOTE_WHY = ");
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(dbt.slice(i, dbt.indexOf("\n", i)) + "\n" + ["voteHistory", "voteTally", "settleVotes"].map(fn).join("\n")
    + "\nthis.settle = settleVotes; this.hist = voteHistory; this.tally = voteTally;", ctx);
  return ctx;
})();
const voters = ["顾朝", "陆闻", "阿檀"], targets = ["沈屿白", "周野", "Lisa"];

test("理由只认她点名的那四种来路，没理由的票不算", () => {
  const out = V.settle([
    { name: "顾朝", for: "沈屿白", why: "friend", reason: "他是我兄弟" },
    { name: "陆闻", for: "周野", why: "value", reason: "" },            // 空理由＝毫无根据
    { name: "阿檀", for: "周野", why: "觉得帅", reason: "就是帅" }        // 不在四种来路里
  ], voters, targets, {});
  assert.deepEqual(JSON.parse(JSON.stringify(out)), [{ name: "顾朝", for: "沈屿白", why: "friend", reason: "他是我兄弟" }]);
  ["round", "friend", "moved", "random"].forEach(w => assert.match(dbt, new RegExp("\\b" + w + ": \""), "来路少了 " + w));
});

test("只认场边名单里的人、只能投台上的人；一人一票", () => {
  const out = V.settle([
    { name: "路人甲", for: "周野", why: "random", reason: "随便" },         // 凭空多出来的人
    { name: "顾朝", for: "裁判", why: "random", reason: "随便" },           // 投给不在台上的人
    { name: "「陆闻」", for: "Lisa", why: "moved", reason: "她那句戳到我了" }, // 书名号要认得
    { name: "陆闻", for: "周野", why: "random", reason: "再投一次" }         // 一人两票
  ], voters, targets, {});
  assert.equal(out.length, 1);
  assert.equal(out[0].name, "陆闻"); assert.equal(out[0].for, "Lisa");
});

// v73.312 起票＝「这一轮谁说得好」（她 2026-09-23：「刚开始票数不一样然后就永远一样平票了，也不会立场改观」）：
//   每轮投不同的人是正常的，原来「刚换过就强制投回去」那条撤了。
test("票跟着这一轮走：刚换过的人这一轮照样能投给别人；谁都没说服就不投", () => {
  const hist = { 顾朝: ["沈屿白", "周野"], 陆闻: ["周野", "周野"] };
  const out = V.settle([
    { name: "顾朝", for: "沈屿白", why: "moved", reason: "这一轮他那句接得漂亮" },
    { name: "陆闻", for: "", why: "value", reason: "都没说服我" }
  ], voters, targets, hist);
  assert.equal(out.length, 1, "for 留空＝弃权，不算票");
  assert.equal(out[0].for, "沈屿白"); assert.equal(out[0].why, "moved");
});

test("整场记分：谁一共几票", () => {
  const s = { rounds: [
    { votes: [{ name: "顾朝", for: "沈屿白" }, { name: "陆闻", for: "周野" }] },
    { votes: [{ name: "顾朝", for: "沈屿白" }, { name: "陆闻", for: "沈屿白" }] }
  ] };
  assert.deepEqual(JSON.parse(JSON.stringify(V.tally(s))), { 沈屿白: 3, 周野: 1 });
  assert.deepEqual(JSON.parse(JSON.stringify(V.hist(s))), { 顾朝: ["沈屿白", "沈屿白"], 陆闻: ["周野", "沈屿白"] });
});

test("提示词里给的是来路和改票的判据，不是例句", () => {
  const i = dbt.indexOf("const voteBlock = benchBlock");
  const vb = dbt.slice(i, dbt.indexOf("const sys = AC()", i));
  assert.ok(i > 0);
  assert.match(vb, /这层关系得是真的/, "交情那一条得拦住临时认亲（脑残粉）");
  assert.match(vb, /reason 里点出是哪句话的意思/, "被说动得说得出是哪句");
  assert.match(vb, /【这一轮的票】和【TA心里站哪边】是两件事/, "票和立场分开");
  assert.match(vb, /这一轮谁都没说服TA，就不投/, "可以弃权");
  assert.match(vb, /【立场改观】/, "立场可以慢慢变");
  // v73.317 起不再把「之前依次投给」喂回去（那是抄写信号），改成先定 edge 再投
  assert.doesNotMatch(vb.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n"), /之前依次投给/, "别再把上几轮的票喂回去，模型会照抄");
  assert.match(vb, /先定这一轮的高下，再投票/);
});

test("裁判是个活人：没上台的人里挑、TA不投票、每轮说一句、收台由TA判", () => {
  assert.match(dbt, /const \[judgeId, setJudgeId\] = useState\(""\)/);
  assert.match(dbt, /"谁来当裁判"/);
  assert.match(dbt, /\{ id: "", name: "不请人" \}/, "得能不请人");
  assert.match(dbt, /&& !\(s\.judge && String\(s\.judge\.id\) === String\(c\.id\)\)/, "裁判又在场边投票了");
  assert.match(dbt, /有TA自己的偏心和私心，不用装公正/);
  assert.match(dbt, /觉得TA偏心，可以直接冲TA去/);
  assert.match(dbt, /const call = o\.judge \? String\(p\.call \|\| ""\)\.trim\(\) : "";/);
  // 收台
  const i = dbt.indexOf("async function genResult(");
  const gr = dbt.slice(i, dbt.indexOf("function Debate(", i));
  assert.match(gr, /下面全部由TA来判：用TA自己的口气写判词/);
  assert.match(gr, /判词必须说到台上真说过的话，不能空口站队/);
  assert.match(gr, /不跟就在判词里说出为什么/, "票数给了裁判，但裁判可以不跟");
});

test("票和裁判那一句都进实录：下一轮台上的人知道台下怎么投的", () => {
  assert.equal((dbt.match(/roundVerdictLines\(r, session\.judge && session\.judge\.name\)/g) || []).length, 2,
    "prevTranscript 和 fullTranscript 都得带上");
});

test("什么都不写回记忆（她不要赌注那一条）", () => {
  assert.ok(!/memAdd|addMemory|saveMemory|x_memLib/.test(dbt), "擂台开始往记忆里写东西了");
});

// v73.2x 她 2026-09-23：「为啥不能拉几个路人上场当观众，给他们个立场。
// 还有角色的 npc 也可以当台下，当他们的联系角色上场的时候」
test("路人谁也不认识：TA投「交情」那一票是凭空认亲，不算", () => {
  const out = V.settle([
    { name: "卖豆腐的老陈", for: "沈屿白", why: "friend", reason: "看着顺眼" },
    { name: "卖豆腐的老陈2", for: "周野", why: "moved", reason: "那句算账说得实在" }
  ], ["卖豆腐的老陈", "卖豆腐的老陈2"], targets, {}, ["卖豆腐的老陈", "卖豆腐的老陈2"]);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, "卖豆腐的老陈2");
  // 她自己的人照旧可以投交情
  assert.equal(V.settle([{ name: "顾朝", for: "沈屿白", why: "friend", reason: "兄弟" }], voters, targets, {}, ["路人"]).length, 1);
});

test("路人在开场那一次捏好：有名有身份有偏向，不跟台上的人撞名", () => {
  const i = dbt.indexOf("async function assignStances(");
  const ctx = { JSON, String, Array, Object, Math,
    AC: () => "", CB: () => "", WORLD_WORDS: "", personaFor: p => p, TOK: { stance: 8000 },
    extractJSON: x => JSON.parse(x),
    callAI: async () => JSON.stringify({ stances: [{ name: "沈屿白", stance: "该" }], myOptions: ["该"],
      crowd: [{ name: "沈屿白", who: "撞名的", lean: "该" }, { name: "老陈", who: "卖豆腐的", lean: "" },
              { name: "", who: "没名字", lean: "该" }, { name: "阿梅", who: "茶馆跑堂", lean: "不该" }, { name: "多的", who: "超额", lean: "该" }] }) };
  vm.createContext(ctx);
  vm.runInContext(dbt.slice(i, dbt.indexOf("\n  }\n", i) + 4) + "\nthis.go = assignStances;", ctx);
  return ctx.go({}, "", "题", [{ name: "沈屿白", persona: "" }], false, 2).then(r => {
    assert.deepEqual(r.crowd.map(x => x.name), ["老陈", "阿梅"], "撞名的、没名字的、超额的都不要");
    assert.equal(r.crowd[0].lean, "中立", "没写偏向就当中立");
    assert.ok(r.crowd.every(x => /^passer_/.test(x.id)));
  });
});

test("台下的配角：只在TA身边那位上台时出现，而且写清认不认识她", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  const i = app.indexOf("npcFor: stageIds =>");
  assert.ok(i > 0, "配角没接上擂台");
  const seg = app.slice(i, app.indexOf("})),", i));
  assert.match(seg, /stageIds\.flatMap\(hostId => npcsOf\(hostId\)/, "走公共那份 npcsOf，别自己再遍历全量");
  assert.match(seg, /c\.knowsUser \? "也认识 " \+ userName\(profile\) : "不认识 "/, "认不认识她得写清");
  assert.match(dbt, /props\.npcFor \? props\.npcFor\(orderedChars\.map/, "台下没吃到配角");
  assert.match(dbt, /\.slice\(0, 3\)\.map\(function \(c\) \{\n\s*return \{ id: c\.id, name: c\.name, persona: c\.persona, kind: "npc"/, "配角至多三个");
});
