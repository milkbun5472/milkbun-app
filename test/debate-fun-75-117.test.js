// 她 2026-10-09：擂台加抽题、递纸条、临时规矩、当场松口／换边；都只在擂台里，什么都不写回主线。
const assert = require("assert"), fs = require("fs");
const d = fs.readFileSync(__dirname + "/../js/debate.js", "utf8");
const i = d.indexOf("async function genRound("), j = d.indexOf("async function genResult(", i);
assert.ok(i > 0 && j > i, "抠不出 genRound");
const g = d.slice(i, j);
// 抽题
assert.match(d, /async function drawTopics\(active, chars, uName\)/);
assert.match(d, /maxTokens: 8000 \}\);\n    const p = extractJSON\(raw\) \|\| \{\};\n    return \(Array\.isArray\(p\.topics\)/);
assert.match(d, /"data-wk": "debdrawbtn"/);
// 纸条：只有收纸条的那位知道
assert.match(g, /只有「" \+ o\.slip\.to \+ "」看得到的纸条/);
assert.match(g, /别的人都不知道有这张纸条/);
assert.match(d, /if \(slip\) last\.slip = slip;/);
// 临时规矩：代码掷要不要，模型现编内容，只管下一轮
assert.match(d, /const ruleAsk = !\(prior && prior\.rule\) && Math\.random\(\) < 0\.35;/);
assert.match(g, /【这一轮的临时规矩】/);
assert.match(d, /if \(r\.nextRule\) last\.rule = r\.nextRule;/);
// 松口／换边：换了边，立场牌跟着换
assert.match(g, /嘴硬到底也是一种性子/);
assert.match(d, /x \? Object\.assign\(\{\}, pp, \{ stance: x\.newStance \}\) : pp/);
// 主线一个字都不写
assert.ok(!/addMemEntry|saveJSON\("x_chat/.test(d), "擂台不许往主线写东西");
console.log("debate fun ok");
// 裁判人设整张喂（她 2026-10-09：「这裁判还是不对啊 没有自己的角色口吻」——原来只切前 500 字）
assert.ok(!/judge\.persona \|\| ""\)\.replace\(\/\\s\+\/g, " "\)\.slice\(0, 500\)/.test(d), "裁判人设又被切成 500 字");
assert.match(d, /personaFor\(String\(o\.judge\.persona \|\| ""\)\.replace\(\/\\s\+\/g, " "\), chars\.length \+ 1\)/);
assert.match(d, /personaFor\(String\(J\.persona \|\| ""\)\.replace\(\/\\s\+\/g, " "\), chars\.length \+ 1\)/);
console.log("judge persona ok");
assert.match(d, /实录里有你前几轮的判语，那是说过的话/);
// 台下坐谁可以挑；台下人设整张喂（她 2026-10-09：「台下的也都一个样」）
assert.match(d, /benchIds: benchIds\.slice\(\),/);
assert.match(d, /if \(Array\.isArray\(s\.benchIds\) && !s\.benchIds\.some/);
assert.ok(!/String\(c\.persona \|\| ""\)\.replace\(\/\\s\+\/g, " "\)\.slice\(0, 500\)\n?\s*\+ \(c\.injection/.test(d), "台下人设又被切成 500 字");
assert.match(d, /personaFor\(String\(c\.persona \|\| ""\)\.replace\(\/\\s\+\/g, " "\), chars\.length \+ \(o\.bench \|\| \[\]\)\.length\)/);
console.log("bench ok");
