// v63.15 小游戏审计批 4：六件小毛病一版修掉。
// ① 25问只有 AI 直猜能赢、真人问中了只得一个「是」——同一动作两套结果；
// ② 守卫某夜空守后，「不能连守」还挂在上一个人身上；
// ③ 阿瓦隆某票对不上名字时掷硬币——谁都解释不了的一票；
// ④ 狼队密谈生成完就被扔掉，谁也没看过一眼；
// ⑤ UNO 你默认永远「已喊」，忘喊罚两张对你从不生效；
// ⑥ 卧底平票随机抓一个出局（狼人杀同局面是无人放逐）——两桌两套天理。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "games.js"), "utf8");
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "锚没了：" + a.slice(0, 40)); return s.slice(i, s.indexOf(b, i + a.length)); };

test("25问：真人直猜也能赢", () => {
  assert.match(src, /runGuessRound\(api, kind, ctx, userQ, aiSpeakers, history, mode, userName\)/, "她的名字没递给主持人，solvedBy 填不了她");
  assert.match(src, /真人玩家.*刚问的那条也算.*别只盯着 AI/, "判胜规则还只盯着 AI 的问题");
  assert.match(src, /runGuessRound\(api, kind, ctx, uq \|\| "", speakers, history, cfg\.mode, me \? me\.name : ""\)/, "调用点没把她的名字传进去");
});

test("守卫：空守一夜后连守限制清零", () => {
  assert.match(src, /guardLastRef\.current = gp \? gp\.name : null;/, "没守人那夜过后，旧限制还挂着");
});

test("阿瓦隆：对不上名字的票不掷硬币", () => {
  const seg = cut(src, "// 票对不上名字不掷硬币", "});");
  assert.ok(seg.indexOf("Math.random") < 0, "还在掷硬币");
  assert.match(seg, /按赞成计/, "兜底票没写明怎么计的");
});

test("狼队密谈：进行中一个字不漏，终局复盘公开一次", () => {
  assert.match(src, /if \(nightInfo\.wolfChat\.length\) wolfChatRef\.current = wolfChatRef\.current\.concat/, "密谈没存起来，还是生成完就扔");
  const rev = cut(src, "// 终局复盘：把狼队各夜的密谈亮出来", "// 结束后评全场 MVP");
  assert.match(rev, /phase !== "result" \|\| chatRevealed\.current/, "复盘没锁在终局，或者会重复公开");
  assert.match(rev, /复盘 · 狼队夜间密谈公开/, "复盘没有分隔标记");
});

test("UNO：喊牌默认关、出完一手复位——忘喊罚两张对她也生效", () => {
  assert.match(src, /\[saidUno, setSaidUno\] = useState\(false\)/, "默认还是永远已喊");
  const act = cut(src, "function userAct(action) {", "\n    }");
  assert.match(act, /if \(action\.kind === "play"\) setSaidUno\(false\);/, "出完一手没复位，喊一次管全场");
  // 牌规核心里罚喊真的在（照写档那头核，不是照 UI 猜）
  const core = fs.readFileSync(path.join(__dirname, "..", "js", "uno-core.js"), "utf8");
  assert.match(core, /忘喊 UNO，罚摸 2 张/, "核心里根本没有罚喊，这开关就没意义");
});

test("卧底：平票无人出局进下一轮，不再随机抓倒霉蛋", () => {
  const seg = cut(src, "const tallyAndEliminate = function (votes)", "const runVote =");
  assert.match(seg, /if \(tied\.length > 1\) \{\n\s*pushLog\(\[\{ type: "info", text: "⚖️ " \+ tied\.join\("、"\) \+ " 平票，本轮无人出局/, "平票没有改成无人出局");
  assert.ok(seg.indexOf("Math.random() * tied.length") < 0, "还在从平票里随机抓人");
});
