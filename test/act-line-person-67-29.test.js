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
  const i = engine.indexOf("const ACT_PAIR = ");
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
test("「我们」「她们」「你们」都不动", () => {
  assert.equal(actLineAs("我们坐在沙发上", "他"), "我们坐在沙发上");
  assert.equal(actLineAs("我们坐在沙发上，我把杯子放下", "他"), "我们坐在沙发上，他把杯子放下");
  assert.equal(actLineAs("我们出门，她们在家，你们等着", "他", ["她"]), "我们出门，她们在家，你们等着");
  // 反着那一头也一样：选「她」的时候「你们」不许变成「她们」
  assert.equal(actLineAs("我们出门，你们等着", "他", [], "她"), "我们出门，你们等着");
  // 还原用的哨兵不许漏进正文，三种合称也不许串位
  assert.ok(actLineAs("我们她们你们我她", "他", ["她"]).indexOf("\u0002") < 0);
  assert.equal(actLineAs("我们她们你们我她", "他", ["她"]), "我们她们你们他你");
});

// ── 第二个旋钮：他那一行里【你】叫什么（她 2026-09-12：「他卡里写的她」）──
test("他卡里把你写成「她」，那一行要把你换回「你」", () => {
  assert.equal(actLineAs("我把伞递给她", "他", ["她"]), "他把伞递给你");
  // 名字也算：他卡里直接写名字的时候一样
  assert.equal(actLineAs("我把伞递给 Lisa", "他", ["她", "Lisa"]), "他把伞递给你", "名字前面那个空格也得一起吃掉");
  assert.equal(actLineAs("我把伞递给Lisa", "他", ["她", "Lisa"]), "他把伞递给你");
});

// ⚠️顺序：先把她换成「你」，再把他换成第三人称。
//   反过来的话，他要也是「她」（女角色），刚换出来的那个「她」会被当成她再换成「你」。
test("女角色那一档：他自己的「她」不许被当成你再换一次", () => {
  assert.equal(actLineAs("我把伞递给她", "她", ["她"]), "她把伞递给你");
});

// ⚠️她 2026-09-12：「应该是你/她，因为卡有时候也会写你」——
//   卡里时而写「你」时而写「她」，「照卡来」等于没选，她看到的还是一时一个样。
//   所以第二个旋钮是【两个确定的方向】，两边都得真的转得动。
test("卡里写「你」、她选「她」：也要转得过去", () => {
  assert.equal(actLineAs("我把伞递给你", "他", [], "她"), "他把伞递给她");
  assert.equal(actLineAs("我站在门外，递向你", "他", [], "她"), "他站在门外，递向她");
});

test("四种组合都落在该落的地方", () => {
  assert.equal(actLineAs("我把伞递给她", "他", ["她"], ""), "他把伞递给你", "卡写她·选你");
  assert.equal(actLineAs("我把伞递给你", "他", ["她"], ""), "他把伞递给你", "卡写你·选你");
  assert.equal(actLineAs("我把伞递给你", "他", [], "她"), "他把伞递给她", "卡写你·选她");
  assert.equal(actLineAs("我把伞递给她", "他", [], "她"), "他把伞递给她", "卡写她·选她");
});

test("两个方向都不给的时候，只动他自己那个人称", () => {
  assert.equal(actLineAs("我把伞递给她", "他", [], ""), "他把伞递给她");
  assert.equal(actLineAs("我把伞递给她", "他"), "他把伞递给她", "不传就是不换");
});

test("两个旋钮各管各的，单独开一个也要管用", () => {
  // 只动「你」那一头：他自己照旧是「我」
  assert.equal(actLineAs("我把伞递给她", "", ["她"]), "我把伞递给你");
  assert.equal(actLineAs("我把伞递给你", "", [], "她"), "我把伞递给她");
  // 只动「他」那一头：她照旧是卡里写的
  assert.equal(actLineAs("我把伞递给她", "他", []), "他把伞递给她");
  // 两个都不动就原样
  assert.equal(actLineAs("我把伞递给她", "", []), "我把伞递给她");
});

test("空名字/脏值不许把整行拆烂", () => {
  assert.equal(actLineAs("我把伞递给她", "他", ["她", "", null, "  "]), "他把伞递给你");
});

// ⚠️名字里要是本来就含着那个代词（比如她的名字叫「她她」「小她」），
//   短的先换就会把名字拆掉半截，落出「你她」这种东西。长的先换才对。
test("名字跟代词有重叠时，长的先换", () => {
  assert.equal(actLineAs("我把伞递给小她", "他", ["她", "小她"]), "他把伞递给你");
  assert.equal(actLineAs("我在等小她过来", "他", ["她", "小她"]), "他在等你过来");
});

test("没开这个开关、或者没人称可用时，一个字都不动", () => {
  assert.equal(actLineAs("我站在门外", "我"), "我站在门外", "选「我」就是原样");
  assert.equal(actLineAs("我站在门外", ""), "我站在门外");
  assert.equal(actLineAs("我站在门外", null), "我站在门外");
  assert.equal(actLineAs("", "他"), "");
  assert.equal(actLineAs(null, "他"), "", "null 直接塞进 replace 会当场抛异常");
  assert.equal(actLineAs(undefined, "他"), "");
  assert.equal(actLineAs(0, "他"), "0", "数字也得当字符串收，别原样返回一个 number");
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
  const i = C.indexOf('m.who === "char" && window.ActLine');
  assert.ok(i > 0, "那一行没接上开关");
  const blk = C.slice(i, i + 400);
  assert.match(blk, /window\.PhonePronoun \? window\.PhonePronoun\.ta\(character\) : "他"/,
    "人称得跟着角色性别走——charTa 那张表只有一份，别再各写一遍");
  assert.match(blk, /userPerson === "ta" \? \[\] : \["她", \(profile && profile\.name\) \|\| ""\]/, "「选你」那一头没接上");
  assert.match(blk, /userPerson === "ta" \? "她" : ""/, "「选她」那一头没接上——卡里写「你」时就转不过去了");
  assert.match(blk, /: m\.content\)/, "没开开关时得原样显示");
  // 她自己写的旁白（who 不是 char）一个字都不许动
  assert.match(C, /m\.who === "char" && window\.ActLine/, "没判 who＝把她自己的旁白也转了");
});

test("开关存得下来，而且只认 ta 这一个值", () => {
  assert.match(C, /const \[actPerson, setActPerson\] = useState\(settings\.actPerson === "ta" \? "ta" : "me"\);/);
  // ⚠️别把这三个钉成必须紧挨着：v67.45 在 actDesc 后面插了通话那两项，
  //   一钉死，加一项无关的设置就红一次，而红的不是它要防的那件事。
  //   要证的是【这三个都在保存键里】。
  ["actDesc", "actPerson", "userPerson"].forEach(k =>
    assert.match(C, new RegExp("\\n      " + k + ",\\n"), "保存时没带上 " + k));
  assert.match(C, /const \[userPerson, setUserPerson\] = useState\(settings\.userPerson === "ta" \? "ta" : "you"\);/);
  assert.match(A, /userPerson: s\.userPerson === "ta" \? "ta" : "you",/, "存进来的脏值没归一");
  assert.match(A, /userPerson: \(settingsFor\(activeChar\.id\) \|\| \{\}\)\.userPerson === "ta" \? "ta" : "you",/);
  assert.match(A, /actPerson: s\.actPerson === "ta" \? "ta" : "me",/, "存进来的脏值没归一");
  assert.match(A, /actPerson: \(settingsFor\(activeChar\.id\) \|\| \{\}\)\.actPerson === "ta" \? "ta" : "me",/, "没传进聊天那一屏");
});

test("动描关着的时候不摆这个开关", () => {
  const i = C.indexOf('actDesc ? h("div", { className: "flex items-center justify-between pt-4" }');
  assert.ok(i > 0, "开关没挂在动描底下");
  const blk = C.slice(i, i + 3200);   // 两个开关都在这一段里，窗口得够长
  assert.match(blk, /TA 那一行里，TA 自己叫什么/, "标题得说清是【谁那一行】——她 2026-09-12 就是被这个绊到的");
  assert.match(blk, /TA 那一行里，你叫什么/, "第二个开关没摆出来");
  assert.match(blk, /\[\["you", "你"\], \["ta", "她"\]\]/, "第二个开关得是两个确定的方向，不是「照卡来」");
  // ⚠️她 2026-09-12：「这几个灰字注释太长了给别人看不好，删掉」。
  //   解释搬进代码注释了——那是给改代码的人看的，不占她的屏幕。这条反着钉：别再长回来。
  assert.ok(blk.indexOf("t.fog, marginTop: 2") < 0, "那两段灰字说明又长回来了");
  assert.ok(C.indexOf("只认「她」和你的名字") < 0, "灰字没删干净");
  assert.ok(C.indexOf("你自己写的旁白也是「我」，两个人都说「我」容易看岔") < 0, "灰字没删干净");
  assert.match(blk, /\[\["me", "我"\], \["ta", "他"\]\]/);
  assert.equal((blk.match(/minHeight: 32/g) || []).length, 2, "两个开关的按钮都得点得到，不能只有第一个够大");
  assert.match(blk, /\) : null\)/, "动描关着时该整个不摆");
});
