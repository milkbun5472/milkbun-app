// v63.10 小游戏审计批 2：卧底猜词翻盘（她「你说的都对，一个一个来」）。
// 经典规则的后半段戏剧点：被投出的卧底亮明身份后可当众猜平民词，
// 猜中卧底整队立刻获胜。判定是本地纯函数（零调用、不看模型脸色）；
// AI 卧底按水平真猜；言秋座位亲手猜、票没回来按「放弃翻盘」处理、绝不代猜。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "games.js"), "utf8");
const G = require("../js/games.js");
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "锚没了：" + a.slice(0, 40)); return s.slice(i, s.indexOf(b, i + a.length)); };

test("判定真跑：全等中、整句包含中、半个字不中、空不中", () => {
  assert.equal(G.spyGuessHits("苹果", "苹果"), true);
  assert.equal(G.spyGuessHits("是苹果吧", "苹果"), true, "整句包含平民词要算中");
  assert.equal(G.spyGuessHits("苹果！", "苹果"), true, "标点该被洗掉");
  assert.equal(G.spyGuessHits("苹", "苹果"), false, "只猜出半个字不算中");
  assert.equal(G.spyGuessHits("梨", "苹果"), false);
  assert.equal(G.spyGuessHits("", "苹果"), false);
  assert.equal(G.spyGuessHits("苹果", ""), false);
  assert.equal(G.spyGuessHits("Coffee", "coffee"), true, "大小写该被洗掉");
});

test("被投出的卧底才进翻盘，桌上卧底已经赢了的局面不赌这一手", () => {
  const seg = cut(src, "const tallyAndEliminate = function (votes)", "const runVote =");
  assert.match(seg, /if \(out\.role === "spy" && !\(spyLeft > 0 && spyLeft >= civLeft\)\) \{\n\s*spyFinalGuess\(next, out\);\n\s*return;/,
    "翻盘的门变了：只有被投出的是卧底、且桌上卧底没有本来就赢时才进");
  // 老的双份结算尾巴不能留：结算只有 settleAfterOut 一个出口
  assert.match(seg, /settleAfterOut\(next\);/, "非卧底出局那条路没走共同结算");
  assert.ok(seg.indexOf("setTimeout(function () { startRound(next, nr); }") < 0, "老的下一轮尾巴还在，结算写了两处");
});

test("三种卧底三条路：真人输入框、AI 真猜、言秋亲手（票没回来=放弃，不代猜）", () => {
  const fg = cut(src, "const spyFinalGuess = function (list, out)", "\n    };");
  assert.match(fg, /if \(out\.isUser\) \{ setLastGuessText\(""\); setPhase\("lastguess"\); return; \}/, "真人卧底没停在输入框");
  assert.match(fg, /genSpyGuess\(api, out, allClues\.filter/, "AI 卧底没有真猜");
  const gen = cut(src, "async function genSpyGuess(api, out, allClues, mode, turnId)", "\n  }");
  assert.match(gen, /if \(out\.engineer\) \{/, "言秋座位没分出去");
  assert.match(gen, /return \{ guess: "", say: "", missed: true \};/, "票没回来该按放弃翻盘处理，而不是让模型代猜");
  // 判定不问模型：judgeFinalGuess 里只许出现本地 spyGuessHits
  const jd = cut(src, "const judgeFinalGuess = function (list, out, r)", "\n    };");
  assert.match(jd, /spyGuessHits\(guess, civWord\)/, "判定没走本地纯函数");
  assert.ok(jd.indexOf("callRetry") < 0 && jd.indexOf("await") < 0, "判定这一步花钱了或变异步了");
  // 猜中＝卧底整队获胜
  assert.match(jd, /setWinner\("spy"\); setPhase\("result"\)/, "猜中没有直接结算成卧底获胜");
});
