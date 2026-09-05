// v63.02 小游戏玩法审计修复批 1：三个逻辑 bug（她 2026-09-05「你说的都对，一个一个来」）。
// ① 狼人杀：AI 狼分歧时协商出的最终刀口存在 nightAI 里，但「你是预言家」「你是守卫」
//    两个出口落刀只调 tallyKill(协商前的分歧票)——平票→null→假平安夜，
//    不平票→落的也不是狼队真正谈妥的那刀；协商出的「空刀」同样被无视。
// ② 开局配置：观战只要求 ≥2 人，绕过各游戏 min——阿瓦隆 2 人观战 AV_EVIL[2] 不存在、
//    avalonBoard(2) 发 3 张身份牌给 2 个人，可能整局没有梅林。
// ③ 卧底：AI 描述生成失败只 toast，界面退回输入框——你那句已入账，重新提交双份入账；
//    观战/已出局时更是连重试的口都没有，永远停在「…」。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "games.js"), "utf8");
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "锚没了：" + a.slice(0, 40)); return s.slice(i, s.indexOf(b, i + a.length)); };

test("狼人杀夜里三个出口共用同一个刀口算法，协商结果不再被丢", () => {
  // 算法只有一份：先看协商空刀，再看协商刀口，最后才落回分歧票多数决
  const fn = cut(src, "const aiKillOf = function (info)", "};");
  assert.match(fn, /info\.consensusSkip \? null : \(info\.consensusTarget \|\| tallyKill\(info\.wolfVotes, info\.list\)\)/,
    "aiKillOf 的次序变了：必须协商空刀 > 协商刀口 > 分歧票多数决");
  // 三个出口全走它：无夜身份直落 / 你是守卫 / 你是预言家
  assert.match(src, /else finishNight\(nightList, aiKillOf\(nightInfo\), seerInfo/, "无夜身份那条路没走 aiKillOf");
  const guard = cut(src, "const submitGuardProtect = function (name)", "};");
  assert.match(guard, /finishNight\(info\.list, aiKillOf\(info\),/, "守卫出口没走 aiKillOf");
  const seer = cut(src, "const seerDone = function ()", "};");
  assert.match(seer, /finishNight\(info\.list, aiKillOf\(info\),/, "预言家出口没走 aiKillOf");
  // 旧写法（各自 tallyKill）一处都不许剩在这两个出口里
  assert.ok(guard.indexOf("tallyKill(") < 0 && seer.indexOf("tallyKill(") < 0, "出口里还留着各算各的 tallyKill");
  // 用户狼那条路照旧由真人拍板，不许被顺手改成也走 aiKillOf
  const uw = cut(src, "const submitWolfKill = function (name)", "};");
  assert.match(uw, /validWolfTarget\(name, info\.list\)/, "真人狼拍板那条路被动了");
});

test("观战也按各游戏自己的最低人数来，不再放行 2 人怪局", () => {
  const seg = cut(src, "const tooFew =", ";");
  assert.match(seg, /\(spectate \? picked\.length \+ needNpc : total\) < game\.min/, "观战又绕开 game.min 了");
  assert.ok(seg.indexOf("< 2") < 0, "还留着那个写死的 2");
  // 提示语也要跟着说实话
  assert.match(src, /观战也要凑满 " \+ game\.min \+ " 个角色下场/, "人数不够时观战的提示还在说 2 个");
});

test("卧底：描述失败停在重试，不再退回输入框双份入账", () => {
  // 进场先记参数、清失败位；失败只竖旗，已入账的发言不回滚
  const gen = cut(src, "const aiDescribeWith = async function (plist, prior, rnd, waitUser)", "\n    };");
  assert.match(gen, /descArgs\.current = \{ plist: plist, prior: prior, rnd: rnd, waitUser: waitUser \};/, "参数没记，失败后没法原样重跑");
  assert.match(gen, /catch \(e\) \{ setDescFail\(true\);/, "失败没竖旗");
  const retry = cut(src, "const retryDescribe = function ()", "};");
  assert.match(retry, /aiDescribeWith\(a\.plist, a\.prior, a\.rnd, a\.waitUser\)/, "重试没有原样重跑");
  // ⚠️重试分支必须排在输入框分支【前面】：失败态还露输入框，她重新提交就是双份入账
  const act = cut(src, 'phase === "describe") {', 'phase === "vote"');
  const iFail = act.search(/else if \(descFail\) action/), iInput = act.indexOf("submitUserClue");
  assert.ok(iFail >= 0 && iInput >= 0 && iFail < iInput, "重试分支没有排在输入框前面（或被短路关掉了）");
  assert.match(act, /重试这一轮/, "没有重试按钮");
  assert.match(act, /你已说的话都还算数/, "没告诉她已说的不用重说");
});
