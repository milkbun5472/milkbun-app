// v63.22 小游戏审计批 7：猜谜连坐——海龟汤 / 25 问一场三题、记分、出头名。
// 原来单局一题，猜完就散。现在一题完了可以「下一题」（同一桌人接着来，
// 只出题不重摆桌——NPC 和能力小传沿用，一小笔调用）；每题记谁破的，
// 三题满亮【本场头名】。存档带比分，标签写到第几题。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "games.js"), "utf8");
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "锚没了：" + a.slice(0, 40)); return s.slice(i, s.indexOf(b, i + a.length)); };

test("下一题只出题不重摆桌，而且带着已出过的答案防重复", () => {
  const g = cut(src, "async function genGuessNext(api, kind, prevAnswers)", "\n  }");
  assert.match(g, /本场已出过的（别重复、也别出近似的）/, "没带旧答案，三题里会出重的");
  assert.ok(g.indexOf("npc") < 0 && g.indexOf("skill") < 0, "下一题还在重生成 NPC/小传——桌被重摆了");
  const n = cut(src, "const nextPuzzle = async function ()", "\n    };");
  assert.match(n, /setHistory\(\[\]\); setQCount\(0\); setWon\(false\); setReveal\(""\)/, "换题没把上一题的状态清干净");
  assert.match(n, /scores\.map\(function \(x\) \{ return x\.ans; \}\)/, "防重复的答案没传给出题");
});

test("四个终局点各记一笔：AI 破题、真人猜中、看答案、25 问用尽", () => {
  // 定义是「recordScore = function」，不含左括号——这里数的正好就是四个调用点
  assert.equal((src.match(/recordScore\(/g) || []).length, 4, "终局记分点该是恰好 4 处");
  assert.match(src, /recordScore\(solver \? solver\.name : String\(r\.solvedBy\), !!\(solver && solver\.isUser\)\);/, "AI 破题没记分");
  assert.match(src, /recordScore\(me\.name, true\); setPhase\("result"\)/, "真人猜中没记分");
  assert.match(src, /recordScore\(null, false\); setPhase\("result"\); \};/, "看答案没记「无人」");
  assert.match(src, /recordScore\(null, false\);\n          setPhase\("result"\);/, "25 问用尽没记「无人」");
});

test("三题满出头名；没满给下一题；存档带比分", () => {
  assert.match(src, /本 场 头 名/, "头名卡没了");
  assert.match(src, /这场谁也没赢，题赢了/, "三题全空那档没有说法");
  assert.match(src, /下一题（第 " \+ Math\.min\(3, scores\.length \+ 1\) \+ " \/ 3 题）/, "下一题的键没了");
  assert.match(src, /scores: scores, ts: Date\.now\(\), label: "第 " \+ \(scores\.length \+ 1\) \+ "\/3 题/, "存档没带比分或标签没写到第几题");
  assert.match(src, /useState\(sv \? \(sv\.scores \|\| \[\]\) : \[\]\)/, "续局没水合比分");
});
