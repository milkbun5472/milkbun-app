// 看他玩-想做的-2026-09-10 里她划的两条 ⭐先做（都是零额外调用）：
//   ① 他在等你回消息——他每次拿起手机都不知道你欠他一条，可那是真人刷手机最常见的理由。
//   ② 敲到第三下，他真的给你发一条——现在敲一下只换来一句心里话。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const W = require("../js/phone-watch.js");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const phone = fs.readFileSync(path.join(root, "js/phone.js"), "utf8");

test("他知道隔了多久、谁欠谁一条——但去不去点她由他自己定", () => {
  const s = W.watchInstruction({ char: {}, uName: "她", apps: ["wechat"], phone: {},
    wxWait: "你上一条发出去 3 个多小时了，她还没回。" });
  assert.ok(s.includes("你上一条发出去 3 个多小时了，她还没回。"));
  assert.ok(s.includes("**你是知道这件事的**"));
  // 给出口不给判决：这一句不许写成「你应该去点开她」
  assert.ok(s.includes("还是压根不去碰它"));
  assert.doesNotMatch(s, /你应该点开|必须点开她/);
  // 没这一栏的时候不许凭空冒出来（第一次、或者压根没聊过）
  assert.ok(!W.watchInstruction({ char: {}, uName: "她", apps: ["wechat"], phone: {} }).includes("你是知道这件事的"));
});

test("那句话是从真聊天里算出来的：零额外调用，三种状态各一句", () => {
  // 料在 chatsRef 里，本来就在手上——这一条钉住它没去多打一枪
  assert.match(app, /const rows = \(chatsRef\.current \|\| \{\}\)\[char\.id\] \|\| \[\];/);
  assert.ok(!/watchWaitLine[\s\S]{0,600}runProbe/.test(app), "算这一句居然又打了一枪");
  // 三种状态：刚说完话 / 她发的他没回 / 他发的她没回
  assert.match(app, /if \(mins < 20\) return "你俩 " \+ ago \+ "前刚说完话。";/);
  assert.match(app, /last\.role === "user"\n\s*\? "她 " \+ ago \+ "前给你发了消息，你还没回。"\n\s*: "你上一条发出去 " \+ ago \+ "了，她还没回。"/);
  // 撤回的、ooc、系统消息不算「最后一条」
  assert.match(app, /if \(!m \|\| m\.recalled \|\| !m\.content\) continue;/);
  assert.match(app, /if \(m\.kind === "ooc" \|\| m\.kind === "system" \|\| m\.role === "system" \|\| m\.role === "narration"\) continue;/);
  assert.match(app, /wxWait: watchWaitLine\(char\)/);
});

test("敲到第三下：他可以真发一条，也可以什么都不发", () => {
  // 出口只在第三下给（schemaHint 也只在那一下多一格，别的时候一个字都不多发）
  assert.match(app, /step\.n === 3 \? "第三下了，你早抬头看见她了。/);
  assert.match(app, /schemaHint: step\.n === 3\n\s*\? '\{"say":"你心里那一句","wx":"你这会儿真想发给她的那条微信（不发就留空）","aff":"整数，通常 0"\}'\n\s*: '\{"say":"你心里那一句","aff":"整数，通常 0"\}'/);
  assert.match(app, /不想发就把 wx 留空/, "写成了非发不可");
  // 真发：走 watchSend 那条真聊天路径，不另开一个写入口
  assert.match(app, /const wx = \(step\.n === 3\) \? String\(\(out && out\.wx\) \|\| ""\)\.trim\(\)\.slice\(0, 200\) : "";/);
  assert.match(app, /if \(wx\) watchSend\(char, "wechat", userName\(profile\), wx\);/);
  // 第四下再收到 wx 也不发：连着敲不该变成连着轰炸她手机
  assert.ok(!/out\.wx[\s\S]{0,120}nth >= 3/.test(app));
  // 界面那头：老的一句话照旧认，多带一条时告诉她
  assert.match(phone, /const say = \(got && typeof got === "object"\) \? String\(got\.say \|\| ""\) : got;/);
  assert.match(phone, /if \(sentWx && onWatchToast\) onWatchToast\("他给你发了一条："/);
  // 心声那一段照旧走 knockBeat 退场，没被这一条挤掉
  assert.match(phone, /WK\.knockBeat\(n, say, p\.typing\)/);
});

test("第三下那一档的梯度没动：说什么仍然是他的事", () => {
  assert.equal(W.knockStep(3, 0).n, 3);
  assert.ok(W.knockStep(3, 0).hint.includes("第三下"));
  assert.ok(W.knockStep(1, 0).hint.includes("第一下"));
});
