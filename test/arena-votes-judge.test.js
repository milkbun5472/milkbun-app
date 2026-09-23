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
  ["friend", "value", "moved", "random"].forEach(w => assert.match(dbt, new RegExp("\\b" + w + ": \""), "来路少了 " + w));
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

test("墙头草：上一轮刚换过票，这一轮不许再换——照上一轮记成「接着投」，不替TA编理由", () => {
  const hist = { 顾朝: ["沈屿白", "周野"], 陆闻: ["周野", "周野"] };   // 顾朝上一轮刚换过
  const out = V.settle([
    { name: "顾朝", for: "沈屿白", why: "moved", reason: "又被说动了" },
    { name: "陆闻", for: "沈屿白", why: "moved", reason: "他那句说到我心里了" }
  ], voters, targets, hist);
  const g = out.find(v => v.name === "顾朝"), l = out.find(v => v.name === "陆闻");
  assert.equal(g.for, "周野", "连着两轮换票＝每轮换，这一票得留在原处");
  assert.equal(g.why, "stay"); assert.equal(g.reason, "", "不许替TA编一句理由");
  assert.equal(l.for, "沈屿白", "一路投同一个人之后，被说动了照样能改");
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
  const i = dbt.indexOf("const histLines = ");
  const vb = dbt.slice(i, dbt.indexOf("const sys = AC()", i));
  assert.ok(i > 0);
  assert.match(vb, /这层关系得是真的/, "交情那一条得拦住临时认亲（脑残粉）");
  assert.match(vb, /reason 里要点出是哪句话的意思/, "被说动得说得出是哪句");
  assert.match(vb, /没有这样一个具体的原因，就接着投原来那位/, "改票得有原因");
  assert.match(vb, /每轮都换人，那是没在看这场/);
  assert.match(vb, /之前依次投给/, "不把TA上几轮投给谁发过去，TA没法判断该不该改");
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
