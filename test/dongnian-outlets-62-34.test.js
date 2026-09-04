// 动念的出口：会不会 follow through，以及怎么保底（她 2026-09-04 问的）
//
// 她原话：「我们给了那么多动念可以做的事模型真的会 follow through 吗
//          还是我们也设个硬保底给每一种」。
//
// 查下来分两层，性质完全不同：
//   ① 出口选哪个（动一拍 / 钉愿望 / 留东西 / 发消息）——**代码选的**，模型没机会不 follow。
//   ② 出口【里面】那几档（thing/word/draw/timeline/qa）——模型选的，**而且已经塌过一次**：
//      她 2026-09-03 报「另外仨咋触发啊」，拾/半/画 几乎永远轮不上。
//
// 结论不是硬配额（那会造出「为了填格子而生的内容」，正是打卡式问候 v54.77 下线的原因），
// 是三样：出口层代码选 / 档位层饥饿加权（建议，不是指定）/ 最要紧的是【看得见】。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

test("⚠️泄压排在出口【落地之后】——空返回不许把这一次白白花掉", () => {
  // 原来是先泄 0.28 再选出口，而「留东西」那一路模型返回空就 return false：
  // 一次空返回＝花掉一次调用 + 思念被清掉 + 25 分钟闸也占了 + 什么都没留下，
  // 下一次想再来得再攒六七个小时。这才是「没 follow through」的真实代价。
  const i = app.indexOf("const _drain = () =>");
  assert.ok(i > 0, "没有把泄压收成一个只在落地时才调的口子");
  const seg = app.slice(i - 900, i + 1900);
  assert.match(seg, /const _settle = ok => \{ if \(ok\) _drain\(\); else _giveBack\(\); \};/, "没落地时不还闸");
  assert.match(seg, /const _giveBack = \(\) => \{ dongnianFiredRef\.current\[cid\] = 0; \};/, "25 分钟闸没还回去");
  assert.match(seg, /pinWishAsChar\(c, jwStyle\)\.then\(_settle\)/, "钉愿望那一路没结算");
  assert.match(seg, /leaveInCoupleSpace\(c, jwStyle\)\.then\(_settle\)/, "留东西那一路没结算");
  // 取语气那一句里【不许】再顺手泄压
  assert.match(app, /if \(eng && jw\) jwStyle = \(eng\.getStyleGuidance\(\)/, "取语气那一句又顺手泄压了");
  assert.doesNotMatch(app, /jwStyle = \([\s\S]{0,90}eng\.applyDelta\(\{ connection: -0\.28 \}\); \}/, "又退回先泄后发了");
});

test("愿望是【出口层】的一档，不是塞进「留东西」那个多选里", () => {
  // 那个多选正是塌陷风险最高的地方；再加第六档，大概率跟拾/半/画 一个下场。
  const i = app.indexOf("else if (_cpNow && !charHasOpenWish(cid)");
  assert.ok(i > 0, "钉愿望没排进出口那条 if/else 链");
  assert.match(app, /const CHAR_WISH_P = 0\.\d+;/, "概率没有一个能改的常量");
  // 闸是【有没有】，不是纯概率：板上已经有他钉着没了结的那条就不再钉第二条
  assert.match(app, /const charHasOpenWish = charId => \{[\s\S]{0,240}w\.byCharacter && w\.status !== "done" && w\.status !== "shelved"/,
    "没有「他已经钉过一条还没了结」这道闸——会一直往板上堆");
  // 提示词里不许给内容示范（prompt-no-content-samples.md）
  // ⚠️只切这一个函数：切宽了会漏进隔壁 leaveInCoupleSpace，那边也有一次 runProbe，
  //   于是「多开了一次调用」那条会被隔壁喂饱（变异验证时抓到过）。
  const _pi = app.indexOf("  const pinWishAsChar = async (char, styleHint, manual) => {");
  assert.ok(_pi > 0, "pinWishAsChar 没了");
  const pw = app.slice(_pi, app.indexOf("\n  };", _pi) + 4);
  assert.match(pw, /换一对情侣照样会写的，就不是你想的那件/, "没立那条判据");
  assert.match(pw, /byCharacter: true/, "钉进去认不出是他钉的");
  assert.ok((pw.match(/runProbe\(/g) || []).length === 1, "多开了一次调用");
});

test("档位层是【饥饿加权】不是配额：只建议，模型仍可以拒绝", () => {
  const i = app.indexOf("const _hungry = outletHungry(char.id)");
  assert.ok(i > 0, "没有饥饿加权那一步");
  const seg = app.slice(i, i + 800);
  assert.match(seg, /不合适就照常按你此刻真的想做的那样选，别为了凑而凑/, "写成硬指定了——那会造出为了填格子而生的内容");
  assert.match(seg, /Date\.now\(\) - x\.a > 7 \* 86400000/, "没有「很久没走过」那道门槛，天天都在提示");
  // 每一档落地都要记账，少记一档它就永远显得「很饿」
  ["thing", "word", "draw", "timeline", "qa"].forEach(k => {
    const re = k === "thing" || k === "draw"
      ? /outletNote\(char\.id, kind, !!manual\);/       // thing/draw 走 kind 那一路
      : new RegExp('outletNote\\(char\\.id, "' + k + '", !!manual\\);');
    assert.match(app, re, k + " 这一档落地没记账");
  });
});

test("⚠️她按按钮叫出来的那次单独算，不进保底", () => {
  // 她原话：「不占写过没有的保底，我调用的就是单独自己算的」。
  // 混在一起的话，她按几下就能把某一档「喂饱」，那一档从此再也不会自己出现。
  const i = app.indexOf("const outletNote = (charId, kind, manual)");
  assert.ok(i > 0, "没有出口账");
  const seg = app.slice(i, i + 600);
  assert.match(seg, /if \(manual\) \{ cur\.m = Date\.now\(\); cur\.mn = \(Number\(cur\.mn\) \|\| 0\) \+ 1; \}/, "手动那次没单独记");
  assert.match(seg, /else \{ cur\.a = Date\.now\(\); cur\.an = \(Number\(cur\.an\) \|\| 0\) \+ 1; \}/, "自发那次没单独记");
  // 饥饿加权只许看 a（自发），看了 m 就被她按的那几下喂饱了
  const hz = app.slice(app.indexOf("const outletHungry = charId =>"), app.indexOf("const outletHungry = charId =>") + 420);
  assert.match(hz, /a: Number\(\(mine\[k\] \|\| \{\}\)\.a\) \|\| 0/, "饥饿加权没看自发那一列");
  assert.ok(hz.indexOf(".m)") < 0 && hz.indexOf(".mn") < 0, "饥饿加权把她手动叫的那几次也算进去了");
  // 手动那一路：单独计数，而且不动思念
  assert.match(app, /const ok = await pinWishAsChar\(ch, "", true\);/, "手动按钮没标 manual");
  assert.ok(app.indexOf("onGenWish: async ch =>") > 0);
  assert.doesNotMatch(app.slice(app.indexOf("onGenWish: async ch =>"), app.indexOf("onGenWish: async ch =>") + 520),
    /applyDelta/, "她按一下也替他泄思念——那不是他自己想起来的");
});

test("看得见：每一档上次是什么时候，「从来没有过」要写出来", () => {
  // 这才是真正防复发的：「从来没出现过」和「本来就少」在界面上长得一模一样。
  assert.match(scr, /"他自己走过的那几档 · 上次"/, "抽屉页没有这一栏");
  assert.match(scr, /"还没有过"/, "没出现过的那几档不说话，等于还是看不见");
  assert.match(scr, /mn \? "（你叫过 " \+ mn \+ " 次）" : ""/, "她手动叫的次数没分开显示");
  assert.match(scr, /function CoupleDrawer\(\{ partner, items, onOpen, ledger, kinds, onBack \}\)/, "账没传进抽屉页");
  assert.match(app, /outletLedger: \(typeof outletLog === "function" \? outletLog\(\) : \{\}\)/, "账没往界面传");
});

test("让 TA 也钉一条：按钮在愿望板上，长得是板上的一张纸", () => {
  const i = scr.indexOf('"让 " + partner.name + " 也钉一条"');
  assert.ok(i > 0, "按钮没了");
  const seg = scr.slice(i - 900, i + 500);
  assert.match(seg, /onClick: \(\) => !wishGen && onGenWish\(partner\)/, "按下去不叫他");
  assert.match(seg, /disabled: wishGen/, "生成中还能再按——会连开两次调用");
  assert.match(seg, /border: "1px dashed rgba\(120,90,45,\.5\)"/, "不是「这儿还空着」那张纸，又是一颗按钮");
  assert.match(seg, /pin\("r"\)/, "没钉在板上");
});
