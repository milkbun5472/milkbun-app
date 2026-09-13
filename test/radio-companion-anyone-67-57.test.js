// 她 2026-09-12 排的第一条：陪听的人可以换成别人。
//
// 原来「陪听」是个 boolean，陪你听的写死成【广播里那个人自己】——
// 于是「暂停，和他说一句」等于当着当事人的面问当事人：他什么都知道，一点张力都没有。
// 而隔离那一套代码从第一版起就是按 companionId 分账的（reveal 记 companionId、
// companionContext 按它筛、companionPrompt 本来就收 companionId），
// **能力一直在，只是界面把它焊死了**——跟情侣唱片那次一模一样。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const R = require("../js/radio-timeline.js");
const ui = fs.readFileSync(path.join(root, "js/radio-timeline-ui.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

const make = () => R.create({ id: "he", name: "广播里那个", persona: "人设" }, "分岔", "边界", "世界书", "b");
const withFrag = () => {
  const b = make();
  b.fragments.push(R.accept({ title: "章", lines: [{ kind: "character", speaker: "广播里那个", text: "第一句。第二句。第三句。" }] }, "past", "f"));
  return b;
};

test("换个人来陪听：他只听得见你切给他之后的那几句", () => {
  let b = withFrag();
  b = R.reveal(b, "f", 0, "he");        // 先是他本人陪着听了第一句
  b = R.reveal(b, "f", 1, "other");     // 换了人，新来的从第二句开始
  assert.deepEqual(R.companionContext(b, "he").heard.map(x => x.index), [0]);
  assert.deepEqual(R.companionContext(b, "other").heard.map(x => x.index), [1], "换人之后旧陪听者的见闻跟着串过去了");
  // 喂给新来那位的原文里，不许有他没在场的那一句
  const p = R.companionPrompt(b, "other", "你听见了吗");
  assert.ok(p.includes("第二句。"));
  assert.ok(!p.includes("第一句。"), "他没在场的那一句也喂给他了");
  // 一个字都没听过的人不许问（界面那头按 heard 判，这儿把依据钉住）
  assert.throws(() => R.companionPrompt(b, "谁也不是", "?"));
});

test("陪听的人换了，陪听对话也各归各的", () => {
  let b = withFrag();
  b = R.reveal(b, "f", 0, "he");
  b = R.reveal(b, "f", 0, "other");
  b.talks.push({ companionId: "he", question: "问他", answer: "他答" });
  b.talks.push({ companionId: "other", question: "问旁边那位", answer: "旁边那位答" });
  assert.deepEqual(R.companionContext(b, "he").talks.map(x => x.answer), ["他答"]);
  assert.deepEqual(R.companionContext(b, "other").talks.map(x => x.answer), ["旁边那位答"]);
  assert.ok(!R.companionPrompt(b, "other", "?").includes("他答"), "别人跟他的对话串到这一位名下了");
});

test("广播里那个人自己来陪听：那一句不能再说「你不是广播中的人物」", () => {
  let b = withFrag();
  b = R.reveal(b, "f", 0, "he");
  b = R.reveal(b, "f", 0, "other");
  const self = R.companionPrompt(b, "he", "你怎么看");
  const other = R.companionPrompt(b, "other", "你怎么看");
  // ⚠️那一句原来是写死的，陪听的人就是广播里那个的时候它是假话。
  //   按人分两种写法，不是在后面挂一句「除非」。
  assert.match(self, /广播里那个人是另一条时间线上的你/);
  assert.match(self, /\*\*你没经历过那些事\*\*/, "不说破的话他会把那段当成自己的记忆");
  assert.ok(!self.includes("你是坐在用户身边的陪听者，不是广播中的人物"), "自相矛盾的那句还在");
  assert.match(other, /你是坐在用户身边的陪听者，不是广播中的人物/);
  assert.ok(!other.includes("另一条时间线上的你"));
  // 两种都还是同一套边界
  [self, other].forEach(p => {
    assert.match(p, /你对故事的了解仅限下面实际一起听到的原文/);
    assert.match(p, /可以不认同故事中的选择/);
  });
});

test("界面：陪听从一个勾变成挑人，谁陪听就记在谁名下", () => {
  assert.match(ui, /const \[companionId, setCompanion\] = useState\(""\);/);
  assert.ok(!/setTogether|\btogether\b/.test(ui), "那个写死的勾还在");
  // v67.71 换脸之后它不再是表单里的一格，是机器下沿那一排铜键里的一片牌子；
  // 要钉的还是同一件事：**它是个挑人的 select**，不是一个开关。
  assert.match(ui, /h\("select", \{ "aria-label": "谁陪你一起听"/);
  assert.match(ui, /h\("option", \{ value: "" \}, "没有人，我自己听"\)/, "没有「我自己听」那一档＝退不回原来的独听");
  assert.match(ui, /c\.id === branch\.charId \? c\.name \+ "（广播里的就是他）" : c\.name/);
  // 听闻和对话都按当前这位落库
  assert.match(ui, /R\.reveal\(x, row\.fragmentId, row\.index, companionId\)/);
  assert.match(ui, /talks: x\.talks\.concat\(\{ companionId: companionId, question: q, answer: raw\.say\.trim\(\) \}\)/);
  assert.match(ui, /p\.onCompanion\(b, q, companionId, keepPlaying\)/);
  // 界面上只列当前这位的对话、按当前这位判能不能问
  assert.match(ui, /const mine = R\.companionContext\(branch, companion\.id\), latest = mine\.talks\.at\(-1\);/);
  assert.match(ui, /R\.companionContext\(branch, companion\.id\)\.talks\.map/, "把别人跟他的对话也列出来了");
  assert.match(ui, /btn\("问问他", ask, !question\.trim\(\) \|\| !mine\.heard\.length, true\)/);
  // 换一条线就把陪听的人清掉：上一条线挑的人不该跟过来
  assert.match(ui, /resetPlayback\(\); setCompanion\(""\); select\(id\);/);
});

test("App 那头别再把 charId 填回去", () => {
  assert.match(app, /onCompanion: \(branch, question, companionId, keepPlaying\) => \{/);
  assert.match(app, /liveChars\.find\(x => x\.id === String\(companionId \|\| branch\.charId\)\)/,
    "没接界面传来的那个人＝界面挑了也没用");
  // 陪听走的还是这位【陪听者自己】的上下文，不是广播里那位的
  assert.match(app, /radioAsk\(buildBundle\(ctxFor\(c\)\) \+ "\\n\\n" \+ window\.RadioTimeline\.companionPrompt\(branch, c\.id, question, keepPlaying\)/);
});
