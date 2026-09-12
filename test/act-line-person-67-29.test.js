// 她 2026-09-12 发来一张截图，说「这就是我们的！」——是我们自己的 app。
// 上面发生的事是：
//   用户 OOC 提「动作描写用第三人称指代角色」
//   系统回执〔已记为长期准则：…统一使用第三人称指代自己…〕
//   紧接着那一行还是「我站在门外，将拎着冷饮的手微微抬高递向你」
//
// **说记下了，代码把它碾掉了。**碾它的有两处：
//   ① engine.js 的 ACT_MEANING 写着「必须用第一人称『我』写」
//   ② thought-voice-guard 的 normalizeAction 把开头的 他/她/角色名 一律改写回「我」
// 回执是个承诺，做不到就不该说「已记为长期准则」。
//
// 她选的修法是 A：**存的那一份不动**（状态卡里第一人称才对，那是角色自己的卡），
// 只改【聊天里那一行怎么显示】，而且做成设置开关。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const engine = R("js/engine.js"), app = R("js/app.js"), comp = R("js/components.js");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const A = strip(app), C = strip(comp), E = strip(engine);

const actLineAs = (() => {
  const i = engine.indexOf("const ACT_ME = ");
  assert.ok(i > 0, "抠不出转人称那一份");
  return new Function(engine.slice(i, engine.indexOf("\nfunction splitLongBubble")) + "\nreturn actLineAs;")();
})();

test("她截图里那一行，换成第三人称", () => {
  assert.equal(actLineAs("我站在门外，将拎着冷饮的手微微抬高递向你", "他"),
    "他站在门外，将拎着冷饮的手微微抬高递向你");
});

test("跟着角色性别走，不是写死一个「他」", () => {
  assert.equal(actLineAs("我在厨房煮汤", "她"), "她在厨房煮汤");
  assert.equal(actLineAs("我在厨房煮汤", "TA"), "TA在厨房煮汤");
});

test("句子中间的「我」也要换——一行里不止出现一次", () => {
  assert.equal(actLineAs("我把杯子放下，又看了我自己一眼", "他"), "他把杯子放下，又看了他自己一眼");
});

test("「你」是她，一个字都不许动", () => {
  assert.equal(actLineAs("我把伞递给你", "他"), "他把伞递给你");
});

// ⚠️「我们」是他和她两个人：换成第三人称到底该是「他们」还是「你们」说不清。
//   说不清的就别改——改错比不改难看。
test("「我们」不动", () => {
  assert.equal(actLineAs("我们坐在沙发上", "他"), "我们坐在沙发上");
  assert.equal(actLineAs("我们坐在沙发上，我把杯子放下", "他"), "我们坐在沙发上，他把杯子放下");
  // 还原用的哨兵不许漏进正文
  assert.ok(actLineAs("我们我们我我", "他").indexOf("\u0002") < 0);
  assert.equal(actLineAs("我们我们我我", "他"), "我们我们他他");
});

test("没开这个开关、或者没人称可用时，一个字都不动", () => {
  assert.equal(actLineAs("我站在门外", "我"), "我站在门外", "选「我」就是原样");
  assert.equal(actLineAs("我站在门外", ""), "我站在门外");
  assert.equal(actLineAs("我站在门外", null), "我站在门外");
  assert.equal(actLineAs("", "他"), "");
  assert.equal(actLineAs(null, "他"), "");
  assert.equal(actLineAs(undefined, "他"), "");
});

test("本来就没有「我」的那一行，转不转都一样", () => {
  assert.equal(actLineAs("靠在窗边", "他"), "靠在窗边");
});

// ── 接上去了没有 ──────────────────────────────────────────────
test("转人称只有一份，在 engine 里", () => {
  assert.equal((E.match(/function actLineAs\(/g) || []).length, 1, "只许定义一处");
  assert.match(E, /window\.ActLine = \{ as: actLineAs \};/, "没导出去，components 取不到");
});

test("只改显示，不碰存进去的那一份", () => {
  // 状态卡那一格照旧第一人称：ACT_MEANING 那句一个字都不该动
  // ⚠️钉在 ACT_MEANING 那一句上：engine.js 里「必须用第一人称」有两处，
  //   照整份搜的话，改坏其中一处照样绿（写这条时当场撞见）。
  const meaning = (engine.match(/const ACT_MEANING = "([^"]+)";/) || [])[1] || "";
  assert.match(meaning, /必须用第一人称「我」写/, "存的那一份改了＝她选的不是这条路");
  // normalizeAction 也照旧：模型写「他」照样收成「我」存起来
  assert.match(R("js/thought-voice-guard.js"), /function normalizeAction\(value, characterName\)/);
  // 转人称只出现在渲染那一处，不许混进落库那几行
  assert.ok(A.indexOf("actLineAs") < 0, "app 那头不该自己转——转的是显示，不是存的东西");
});

test("单聊那一行按开关显示", () => {
  const i = C.indexOf('m.who === "char" && actPerson === "ta" && window.ActLine');
  assert.ok(i > 0, "那一行没接上开关");
  const blk = C.slice(i, i + 400);
  assert.match(blk, /window\.ActLine\.as\(m\.content, window\.PhonePronoun \? window\.PhonePronoun\.ta\(character\) : "他"\)/,
    "人称得跟着角色性别走——charTa 那张表只有一份，别再各写一遍");
  assert.match(blk, /: m\.content\)/, "没开开关时得原样显示");
  // 她自己写的旁白（who 不是 char）一个字都不许动
  assert.match(C, /m\.who === "char" && actPerson === "ta"/, "没判 who＝把她自己的旁白也转了");
});

test("开关存得下来，而且只认 ta 这一个值", () => {
  assert.match(C, /const \[actPerson, setActPerson\] = useState\(settings\.actPerson === "ta" \? "ta" : "me"\);/);
  assert.match(C, /\n      actDesc,\n      actPerson,\n/, "保存时没带上");
  assert.match(A, /actPerson: s\.actPerson === "ta" \? "ta" : "me",/, "存进来的脏值没归一");
  assert.match(A, /actPerson: \(settingsFor\(activeChar\.id\) \|\| \{\}\)\.actPerson === "ta" \? "ta" : "me",/, "没传进聊天那一屏");
});

test("动描关着的时候不摆这个开关", () => {
  const i = C.indexOf('actDesc ? h("div", { className: "flex items-center justify-between pt-4" }');
  assert.ok(i > 0, "开关没挂在动描底下");
  const blk = C.slice(i, i + 1400);
  assert.match(blk, /那一行用第几人称/);
  assert.match(blk, /两个人都说「我」容易看岔/, "得说清为什么会想换——她自己的旁白也是「我」");
  assert.match(blk, /只改显示，状态卡里那一格不动/, "得说清它不碰存的那一份");
  assert.match(blk, /\[\["me", "我"\], \["ta", "他"\]\]/);
  assert.match(blk, /minHeight: 32/, "指头点得到");
  assert.match(blk, /\) : null\)/, "动描关着时该整个不摆");
});
