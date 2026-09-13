// 她 2026-09-12 排的第一条：电台匿名连线——「我打进他的节目、他不知道是我」。
//
// 两条判据是她自己给的：
//   ①「他不知道是我」——他手上只有那张马甲（匿名箱那一张，不另立一个身份）。
//   ②「播出去的就是公开的，没播的等于没发生」——连线不另开一套存法，
//      它就是这条分支上的一个片段，走同一条 reveal/heard 的路；
//      没播的那几句谁也读不到，连他下一章都读不到。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const R = require("../js/radio-timeline.js");
const ui = fs.readFileSync(path.join(root, "js/radio-timeline-ui.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

const mask = { name: "空瓶子", bio: "睡不着" };
const make = () => R.create({ id: "he", name: "广播里那个", persona: "人设" }, "分岔", "边界", "世界书", "b");
const withCall = () => {
  const b = make();
  b.fragments.push(R.acceptCall(
    { title: "", lines: [{ text: "我接了。你说吧。" }], guess: "这声音像我认识的一个人" },
    "past", "call1", mask, "你还记得那年夏天吗？", b.name));
  return b;
};

test("打进去的那通电话：她那句是她自己的，他那头按句拆开，署的是马甲不是她", () => {
  const b = withCall();
  const f = b.fragments[0];
  assert.equal(f.call, true);
  assert.equal(f.era, "past");
  assert.equal(f.title, "连线 · 空瓶子");
  assert.deepEqual(f.lines.map(x => x.kind), [R.CALLER, "character", "character"]);
  assert.equal(f.lines[0].speaker, "空瓶子", "她那一句署的不是马甲名");
  assert.equal(f.lines[0].text, "你还记得那年夏天吗？");
  assert.equal(f.lines[1].speaker, "广播里那个");
  assert.equal(f.guess, "这声音像我认识的一个人");
  // 模型这一枪什么都没回＝这通电话没接上，不许存成一个空片段
  assert.throws(() => R.acceptCall({ lines: [] }, "past", "x", mask, "喂？", "广播里那个"));
  assert.throws(() => R.acceptCall({ lines: [{ text: "嗯" }] }, "past", "x", mask, "  ", "广播里那个"));
});

test("没播的等于没发生：一个字没放出去，他下一章读不到这通电话", () => {
  const b = withCall();
  assert.deepEqual(R.airedCalls(b), []);
  const p = R.storyPrompt(b, "past");
  assert.ok(!p.includes("你还记得那年夏天吗？"), "还没播出去的连线进了下一章的料");
  assert.ok(!p.includes("我接了。"), "还没播出去的连线进了下一章的料");
  // 连线不算「已写片段」：那一栏里只有章节
  assert.ok(p.includes("【本分支已写片段"));
  assert.ok(!p.includes("\"call\":true"));
  // 一通都没播过的时候，「广播那头没有人」照旧成立
  assert.ok(p.includes("广播那头没有人"));
});

test("播出去的就是公开的：放出去那几句才进他下一章，那句话也跟着换", () => {
  let b = withCall();
  b = R.reveal(b, "call1", 0, "");
  b = R.reveal(b, "call1", 1, "");
  const aired = R.airedCalls(b);
  assert.equal(aired.length, 1);
  assert.deepEqual(aired[0].lines.map(x => x.text), ["你还记得那年夏天吗？", "我接了。"]);
  const p = R.storyPrompt(b, "past");
  assert.ok(p.includes("你还记得那年夏天吗？"));
  assert.ok(!p.includes("你说吧。"), "还没放出去的那一句也喂给下一章了");
  // ⚠️有人打进来过之后，「广播那头没有人、没有听众」就是假话了。
  //   这一句是【整句换掉】的，不是在后面挂一句「除非」（施工规则/no-yes-unless.md）。
  assert.ok(!p.includes("广播那头没有人"));
  assert.ok(p.includes("热线上那几通电话是已经播过的事"));
  assert.ok(p.includes("不称呼谁"), "换掉之后，真正要挡的那件事（别写成说给她听的）不见了");
});

test("陪听的人只听得见一起播出去的那几句，连线也照这条走", () => {
  let b = withCall();
  b = R.reveal(b, "call1", 0, "旁边那位");
  const p = R.companionPrompt(b, "旁边那位", "他这是在跟谁说话");
  assert.ok(p.includes("你还记得那年夏天吗？"));
  assert.ok(!p.includes("我接了。"), "没一起听到的那一句也喂给陪听的人了");
});

test("他手上只有那张马甲：连线的提示词里不出现她，也不出现没播的东西", () => {
  const b = withCall();
  const p = R.callPrompt(b, "past", mask, "你怕过吗");
  assert.ok(p.includes("空瓶子") && p.includes("睡不着"));
  assert.ok(p.includes("你不认识这个人"));
  assert.ok(p.includes("这通电话是直播出去的"));
  assert.ok(p.includes("【这条分支上此前没有人打进来过】"), "上一通没播出去，却告诉他有人打进来过");
  assert.ok(!p.includes("我接了。"));
  // 马甲没设也得能打：他那儿就是一个没报名字的人
  assert.ok(R.callPrompt(b, "past", null, "喂").includes("一个没报名字的人"));
  assert.throws(() => R.callPrompt(b, "past", mask, "   "));
});

test("接线：马甲用匿名箱那一个，三层陌生人围栏跟着走，界面把她那句原样交出去", () => {
  // 桩钉在【写的那一头】：这几条断言照 app.js / ui 真正写下的样子写
  //（施工规则/stub-from-the-writer.md）
  assert.match(app, /const strangerBans = \(\) => "\\n\\n" \+ ECHO_QUESTION_BAN \+ "\\n\\n" \+ REGISTER_FOLLOWS_SCENE/);
  assert.match(app, /const anonBans = \(\) => strangerBans\(\)/, "树洞那两条没搬到公共那一层来");
  assert.match(app, /myMask: anonMe/);
  assert.match(app, /onCall: \(branch, era, say, anchor\) => radioAsk\(/);
  assert.match(app, /window\.RadioTimeline\.callPrompt\(branch, era, anonMe, say, anchor\) \+ strangerBans\(\)/);
  assert.match(ui, /R\.acceptCall\(raw, era, uid\(\), p\.myMask, say, b\.name\)/);
  assert.match(ui, /"data-radio-callin"/);
  // 他心里那句猜测：播出去了才给她看
  assert.match(ui, /currentPart\.call && currentPart\.guess && R\.heardLines\(branch, currentPart\.id\)\.length/);
});
