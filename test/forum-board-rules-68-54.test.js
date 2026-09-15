// 她 2026-09-15 问「5 呢宝宝」——那一条是【吧规】。
//
// 我先前说过「六个吧只是筛选器」，那句是我说错了：吧早就有自己的常驻人口、自己的语气、
// 自己那几对熟面孔的交情。真正缺的只有规矩——没有规矩，就没人能拿规矩说事，
// 而「这帖该发求助吧」「楼主这违规了吧」正是吧和吧不一样的地方长出来的那种话。
//
// 这一份钉三件事：
//  ① 规矩只有一份表（screens.js），置顶那块牌子和喂模型的吧规读同一份；
//  ② 吧规落在四条生成线共用的那一块（forumNpcRule），不是只挂在其中一条上；
//  ③ 口吻是【给出口不给判决】：不许写成纪律，否则出来一屋子风纪委员。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");
const screens = fs.readFileSync("js/screens.js", "utf8");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");

const BOARDS = ["吐槽吧", "日常吧", "求助吧", "兴趣吧", "脑洞吧", "匿名吧"];

const rules = (() => {
  const m = screens.match(/const FORUM_BOARD_RULES = \{[\s\S]*?\n\};/);
  assert.ok(m, "FORUM_BOARD_RULES 不在 screens.js —— 它得跟 FORUM_BOARDS 住一块儿");
  return new Function(m[0] + ";return FORUM_BOARD_RULES;")();
})();

test("六个吧都有规矩，一条都不空", () => {
  assert.deepEqual(Object.keys(rules).sort(), BOARDS.slice().sort());
  for (const b of BOARDS) {
    assert.ok(rules[b].length >= 3, b + " 的规矩不足三条，撑不起「拿规矩说事」");
    for (const r of rules[b]) assert.ok(String(r).trim().length >= 6, b + " 里有一条是占位的空话");
  }
  // 规矩要带着这个吧的脾气；六个吧同一个腔调等于没写
  const all = BOARDS.flatMap(b => rules[b]);
  assert.equal(new Set(all).size, all.length, "有两个吧抄了同一条规矩");
});

test("规矩只有一份：app.js 不许再抄一张表", () => {
  assert.ok(strip(app).indexOf("FORUM_BOARD_RULES = {") < 0,
    "app.js 里又出现了第二张吧规表——一层写在两处，第二处永远跟不上");
  assert.match(app, /const rules = FORUM_BOARD_RULES\[b\];/);
});

test("吧规挂在四条生成线共用的那一块上", () => {
  // forumNpcRule 是发主帖/首轮刷楼/继续盖楼/回她那条都要过的一块；只挂在其中一条上就是漏
  assert.match(app, /return forumBoardRuleLines\(board\)\n\s*\+ "\\n【论坛人口】/,
    "吧规没接在 forumNpcRule 开头——那样只有部分生成线看得见规矩");
  assert.equal((strip(app).match(/forumBoardRuleLines\(/g) || []).length, 1,
    "吧规该只有共用那一处调用；多出来的那处说明有人把规矩又抄去了某一条生成线");
});

test("不认识的吧不硬编规矩，返回空串", () => {
  const m = app.match(/const forumBoardRuleLines = b => \{[\s\S]*?\n  \};/);
  assert.ok(m);
  const fn = new Function("FORUM_BOARD_RULES", m[0].replace(/^\s*const /, "const ") + ";return forumBoardRuleLines;")(rules);
  assert.equal(fn("匿名信箱"), "");
  assert.equal(fn(""), "");
  for (const b of BOARDS) {
    const out = fn(b);
    assert.ok(out.indexOf(rules[b][0]) > 0 && out.indexOf("3. ") > 0, b + " 的规矩没进提示词");
  }
});

test("口吻是给出口不给判决，不是纪律", () => {
  const m = app.match(/const forumBoardRuleLines = b => \{[\s\S]*?\n  \};/)[0];
  assert.match(m, /不是每层楼都要执行的纪律/);
  assert.match(m, /多数人根本不提/, "不说「多数人不提」就会每层楼都有人在管人");
  assert.match(m, /认真的、也可以是拿它抬杠、还可以是嫌它多余/, "三个出口少一个，规矩就只剩一种用法");
  assert.match(m, /说完照样接着聊，不是把人赶走/);
});

test("吧规那一行永远只有一行高，点开是垂下来的小纸条、不是半窗", () => {
  // 她 2026-09-15：「吧规叠着太占地方了嘤」「我们不要半窗」。
  const i = screens.indexOf('(!inSub && nav === "home" && FORUM_BOARD_RULES[tab])');
  assert.ok(i > 0, "版块页顶上没有吧规——规矩只喂给模型、她自己看不见，等于没挂出来");
  const bar = screens.slice(i, i + 1800);
  assert.match(bar, /height: 26/, "那一行得是钉死的高度，不然展开时又会把帖子顶下去");
  assert.match(bar, /position: "absolute", top: "100%"/,
    "三条得浮在帖子上面；一旦回到文档流里，展开就又把帖子往下推了");
  assert.ok(bar.indexOf("h(Sheet") < 0,
    "吧规又被改成半窗了——三条规矩糊掉半个屏幕（施工规则/no-half-sheet.md，她也当场说过不要）");
  assert.match(bar, /FORUM_BOARD_RULES\[tab\]\[0\]/, "横杠上该只露第一条");
  assert.match(bar, /forumBoardSkin\(tab\)/, "不跟着吧换识别色，六个吧看起来是同一条");
  // 纸条上只有规矩本身；「常年挂在置顶/多数人根本不提」那两句是写给模型看的，不是给她看的
  const note = bar.slice(bar.indexOf('top: "100%"'));
  assert.ok(note.indexOf("多数人根本不提") < 0 && note.indexOf("常年挂在置顶") < 0,
    "她 2026-09-15：「这条也不用给我看」——那两句是提示词里的口吻说明，不该端到她眼前");
  assert.match(screens, /const \[rulesOpen, setRulesOpen\] = useState\(false\);/, "默认该是收起的——她不是来读规矩的");
});
