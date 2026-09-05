// v63.29 小游戏审计批 9：阿瓦隆湖中仙女（7 人起的经典配件）。
// 第 2/3/4 个任务结算后，持牌人查验一人【真实阵营】：真相只给持牌人，
// 当众只有「宣布」——好人照实（信息武器），坏人可以撒谎护同伙；
// 牌传给被验的人，持有过/被验过的不再被验。
// 你持牌：弹框先看真相、再自己选宣布什么。言秋持牌：验谁和宣布都他自己的
// CC 票，票非法/没回来一律「牌留原处」跳过——不代验、更不代嘴。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "games.js"), "utf8");
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "锚没了：" + a.slice(0, 40)); return s.slice(i, s.indexOf(b, i + a.length)); };

test("开关、起手和触发窗口都按经典规则来", () => {
  assert.match(src, /k: "lady", zh: "湖中仙女", d: "7 人起生效/, "配置里没有这个开关");
  assert.match(src, /ladyHolderRef\.current = list\[\(li \+ n - 1\) % n\]\.name;/, "起手牌不在首任队长右手边");
  assert.match(src, /ladyDoneRef\.current = \[ladyHolderRef\.current\];/, "起始持牌人没记进「不再被验」名单");
  assert.match(src, /lady && players\.length >= 7 && newResults\.length >= 2 && newResults\.length <= 4 && ladyHolderRef\.current/, "触发窗口不是第 2/3/4 个任务后");
});

test("真相只给持牌人，桌面上只有宣布", () => {
  const st = cut(src, "const settleLady = function (holder, tp, announce, say, nextQn, nli)", "\n    };");
  assert.ok(st.indexOf("tp.side") < 0, "结算把真实阵营写出去了——真相只该在持牌人手里");
  assert.match(st, /宣布，" \+ tp\.name \+ " 是【" \+ announce/, "桌面上不是宣布");
  assert.match(st, /ladyHolderRef\.current = tp\.name;/, "牌没传给被验的人");
  assert.match(st, /ladyDoneRef\.current = ladyDoneRef\.current\.concat\(\[tp\.name\]\)/, "被验过的还会再被验");
  // 你持牌：先私看真相、再选宣布——两颗宣布键都在
  assert.match(src, /查验结果（只有你知道）/, "你持牌时没有私看真相那一步");
  assert.match(src, /可以照实说，也可以撒谎/, "没告诉她可以撒谎");
});

test("言秋持牌不代验不代嘴；普通 AI 宣布解析不出按阵营本能", () => {
  const rl = cut(src, "const runLady = function (nextQn, nli)", "const settleLady");
  assert.equal((rl.match(/window\.CCSeat\.ask/g) || []).length, 2, "言秋的验谁和宣布该是两张他自己的票");
  assert.match(rl, /&& !isEng2\) tp = shuffle/, "言秋的非法目标也被规则层随机补了——那是代验");
  assert.match(rl, /\|\| !announce\) \{\n\s*pushLog\(\[\{ type: "info", text: holder\.name \+ " 这一轮没有动牌，湖中仙女留在原处/, "票没回来没有按「牌留原处」跳过");
  assert.match(rl, /holder\.side === "evil" \? "好人" : \(tp0\.side === "evil" \? "坏人" : "好人"\)/, "普通 AI 的宣布兜底不是阵营本能");
});
