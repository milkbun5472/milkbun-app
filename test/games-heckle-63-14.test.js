// v63.14 小游戏审计批 3：观战/出局的插嘴口。
// 观战模式的说明从第一天起就写着「随时能插嘴吐槽、带节奏」，但卧底/狼人杀/
// 猜谜/阿瓦隆连一个输入口都没有（只有大富翁和 UNO 真做了）——承诺是空的。
// 现在四桌共用一套：一句话进日志（斜体细字，不冒充正式发言）→ 1~3 个在场 AI
// 顺口接一句；卧底/狼人/阿瓦隆的投票提示词把最近几句当【观众起哄】附带参考
// ——这才是「带节奏」。猜谜是合作局，没有票可带，只接话不进提示词。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "games.js"), "utf8");
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "锚没了：" + a.slice(0, 40)); return s.slice(i, s.indexOf(b, i + a.length)); };

test("共用件：接话只认在场玩家、至多三句；起哄块写明不是玩家发言、只带最近六句", () => {
  const gen = cut(src, "async function genHeckle(api, pool, gameZh, userName, line, recent)", "\n  }");
  assert.match(gen, /filter\(function \(x\) \{ return x && valid\[x\.name\]/, "没按在场名单过滤，模型编个路人也会上桌");
  assert.match(gen, /\.slice\(0, 3\)/, "接话没封顶");
  assert.match(gen, /不是在场玩家/, "没告诉模型这是场外的人");
  const blk = cut(src, "function heckleBlock(list)", "\n  }");
  assert.match(blk, /不是玩家发言/, "起哄块没写明身份，AI 会把观众当玩家分析");
  assert.match(blk, /slice\(-6\)/, "起哄块没只带最近几句");
  // 四桌共用同一条输入行
  assert.equal((src.match(/heckleRow\(t, heckleText, setHeckleText, sendHeckle, busy\)/g) || []).length, 4, "四桌该各有一条共用输入行");
});

test("四桌的门各按各的开：卧底/狼人是观战或已出局，猜谜/阿瓦隆是观战", () => {
  const gates = [...src.matchAll(/const canHeckle = ([^\n]+);/g)].map(m => m[1]);
  assert.equal(gates.length, 4, "canHeckle 该有四处");
  assert.ok(gates.some(g => /spectate" \|\| \(me && !me\.alive\)\) && \(phase === "reveal" \|\| phase === "describe" \|\| phase === "vote"\)/.test(g)), "卧底的门不对");
  assert.ok(gates.some(g => /spectate" \|\| \(me && !me\.alive\)\) && \(phase === "day" \|\| phase === "dayvote" \|\| phase === "reveal"\)/.test(g)), "狼人杀的门不对");
  assert.ok(gates.some(g => /=== "spectate" && phase === "play"/.test(g)), "猜谜的门不对");
  assert.ok(gates.some(g => /=== "spectate" && \(phase === "propose" \|\| phase === "vote" \|\| phase === "quest"\)/.test(g)), "阿瓦隆的门不对");
});

test("带节奏真通到投票，且只通到投票", () => {
  // 卧底：CC 票和批量票都收到起哄块
  assert.match(src, /async function genVotes\(api, voters, allClues, aliveNames, mode, userName, carveCtx, heckles\)/, "卧底投票没收起哄");
  assert.match(src, /ccPreface\(cc, "投过票了"\) \+ heckleBlock\(heckles\)/, "卧底批量票没带起哄块");
  // 狼人：放逐投票收到
  assert.match(src, /wolfRole, claims, heckles\)/, "狼人放逐投票没收起哄");
  assert.match(src, /claimsRef\.current, hecklesRef\.current\)/, "狼人调用点没把起哄传进去");
  // 阿瓦隆：组队投票收到
  assert.match(src, /qn, hist, heckles\)/, "阿瓦隆组队投票没收起哄");
  assert.match(src, /histText\(\), hecklesRef\.current\)/, "阿瓦隆调用点没把起哄传进去");
  // ⚠️只影响投票，不许漏进牌局事实：狼人 shortLog 不收 chat、阿瓦隆的起哄不进 pushHist
  const sl = cut(src, "const shortLog = function ()", "};");
  assert.ok(sl.indexOf('"chat"') < 0, "台下起哄漏进了狼人的公开局况");
  const avh = cut(src, 'const talks = await genHeckle(api, pool, "阿瓦隆"', "};");
  assert.ok(avh.indexOf("pushHist") < 0, "阿瓦隆的起哄写进了局面台账");
  // 猜谜是合作局：只接话，不往任何提示词里塞起哄块
  const gh = cut(src, 'const talks = await genHeckle(api, aiPlayers, K.zh', "};");
  assert.ok(gh.indexOf("heckleBlock") < 0, "猜谜没有票可带，别塞");
});
