// 她 2026-09-11：「加笔本来就不应该有魂穿这种东西，那是以前的玩法现在应该删掉了。」
//
// 上一代的加笔（那时候还叫穿书）开局先挑一个模式：魂穿 CP 左位／右位、天降路人、
// 天降随机——然后顶着那个人的壳把他演一遍。v62.50 换掉整个循环之后，这一页玩的
// 已经是【在她写好的文上动笔】，可那套模式还在底下跑着：新局一律硬写 mode:"left"，
// 于是每一局都在说「玩家魂穿成主角阿凛」。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const fic = fs.readFileSync(path.resolve(__dirname, "..", "js/fanfic.js"), "utf8");
// ⚠️病历写在注释里（「魂穿」那几个字还得留着说明这次删了什么），
//   不 strip 的话「已经删干净了」永远断不出来
const code = fic.split("\n").map(l => l.split("//")[0]).join("\n");
const grab = name => {
  const i = fic.indexOf("function " + name + "(");
  assert.ok(i > 0, "找不到 " + name);
  let d = 0, j = fic.indexOf("{", i);
  for (let k = j; k < fic.length; k++) { if (fic[k] === "{") d++; else if (fic[k] === "}") { d--; if (!d) { j = k + 1; break; } } }
  return fic.slice(i, j);
};

test("整套删干净了，不是留着不发", () => {
  // 撤东西要删除，不是在它后面说它是错的
  ["RP_MODES", "rpModeShort", "rpModeLabel", "rpPlayerName", "rpOther", "rpRoleDesc", "genRPIdentity",
   "playerIdentity", "魂穿", "穿进去的方式"].forEach(w =>
    assert.ok(code.indexOf(w) < 0, "「" + w + "」还在代码里：" + w));
  // 开一局也不再往存档里落一个 mode
  const st = code.slice(code.indexOf("function startSession(fic)"), code.indexOf("function charsOf(fic)"));
  assert.ok(st.length > 200, "没切到 startSession");
  assert.ok(st.indexOf("mode:") < 0, "还在往存档里落 mode");
  // 开场前那一枪（定天降身份）也没了：她按次计费，那一枪只为已经删掉的玩法存在
  const start = fic.slice(fic.indexOf("    async function start() {"), fic.indexOf("    // 往下读一段原文"));
  assert.ok(start.length > 200, "没切到 start()");
  assert.equal((start.match(/await window\.Fanfic\.gen/g) || []).length, 1, "开一局不止打一枪");
});

test("玩家＝动笔的那个人本人，原著里谁都不许被套上去", () => {
  const box = {};
  vm.createContext(box);
  vm.runInContext(grab("rpMeName") + grab("rpAnchorLine") + grab("rpWhoLine")
    + "\nthis.M = { rpMeName, rpAnchorLine, rpWhoLine };", box);
  const M = box.M;
  // 名字没填也不许在提示词里留一对空引号
  assert.equal(M.rpMeName("  "), "你");
  assert.equal(M.rpMeName("丽莎"), "丽莎");
  const a = M.rpAnchorLine([{ name: "阿凛" }, { name: "小野" }], "丽莎");
  assert.match(a, /玩家＝「丽莎」本人/);
  assert.match(a, /\*\*一个都不许拿来套在玩家头上\*\*/);
  assert.match(a, /场上的人本来不认识 TA。/);
  assert.ok(a.indexOf("阿凛") < 0 && a.indexOf("小野") < 0, "把原著角色的名字写进锚点＝又在指认玩家是谁");
  // 这篇文里本来就有她：那位就是她，别写成两个人
  const b = M.rpAnchorLine([{ name: "丽莎", isMe: true }, { name: "阿凛" }], "丽莎");
  assert.match(b, /文里那位「丽莎」就是玩家本人/);
  assert.ok(b.indexOf("场上的人本来不认识") < 0);
  // 她是怎么在这儿的：动笔，不是穿进去
  const w = M.rpWhoLine();
  assert.match(w, /\*\*在这篇文上动笔的那个人\*\*/);
  assert.match(w, /读到哪一句伸手，后面就从那儿改道/);
  assert.match(w, /不顶任何人的身份、不替换原著里的谁/);
  assert.match(w, /也不是「作者」或「旁白」/, "不说这一句，它会把玩家写成在旁边看的人");
});

test("引擎规则第 2 条跟着改了：那一条原来整条都在讲魂穿", () => {
  assert.match(code, /2\. 【玩家是谁，全程不变】玩家就是【在这篇文上动笔的那个人】本人/);
  assert.match(code, /原著里的角色一个都不是玩家/);
  assert.ok(code.indexOf("玩家魂穿的是哪一位，就一直是哪一位") < 0);
  // 开宗明义那一句也是定调的：说「穿进去」它就按穿书写
  assert.match(code, /玩家正在一篇已经写好的同人文上动笔/);
  assert.ok(code.indexOf("玩家『穿』进了一篇同人文里") < 0);
});

test("删掉一个玩法，不许动她写过的字", () => {
  // 存档键、那几局的 transcript、原稿进度、作废段落：一个都没碰
  assert.match(code, /const K_RP = "x_fanfic_rp";/);
  const st = code.slice(code.indexOf("function startSession(fic)"), code.indexOf("function charsOf(fic)"));
  ["transcript: \\[\\]", "paraIdx: 0", "voided: \\[\\]", "ficId: fic.id", "cp: fic.cp"].forEach(k =>
    assert.match(st, new RegExp(k), "开一局少了 " + k));
  // 老局存着的 know 照旧一路发到底（那是另一道早就撤掉的选择，链子不许跟着断）
  assert.equal(code.split("buildRPSystem(fic, tab, cpChars, userName, worldbook, session.style, session.know)").length - 1, 3);
  assert.match(grab("rpKnowLine"), /if \(!k \|\| k\.key === "blank"\) return "";/);
  // 老局存着的 landing 也还读得出来（rpStartLine 那一支）
  assert.match(grab("rpStartLine"), /if \(ld && ld\.label\)/);
});

test("那几条顺着模式走的话也跟着改了", () => {
  const kl = grab("rpKnowLine");
  // 「带着现实里的记忆」那一档原来要说「尽管这一场里 TA 顶着谁的身份」
  assert.ok(kl.indexOf("顶着") < 0, "还在说她顶着谁的壳");
  assert.match(kl, /const other = \(cpChars \|\| \[\]\)\.filter\(function \(c\) \{ return c && !c\.isMe; \}\)\[0\] \|\| null;/,
    "「对方」原来是按左右位算的，现在得按【谁不是她】算");
  assert.match(kl, /一边记得、一边不记得/);
  assert.match(kl, /我认识你们，你们不认识我/);
  // 那一版走出来之后的落款，也不再报一个天降身份的名字
  assert.match(code, /const tail = "\\n\\n———\\n这一版由动笔的那个人走出来："/);
  // 存档行和顶栏：没有模式可写了
  assert.match(code, /\[window\.Fanfic\.rpKnowLabel\(s\.know\), "原稿还剩 " \+ window\.Fanfic\.rpLeftPct\(s, paras\) \+ "%"\]/);
});
