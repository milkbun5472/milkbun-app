// 一个王爷看得懂英文（她 2026-09-05：「我记得我加过他人设不知道的东西不能装知道的
// 指令，那为什么一个王爷看得懂我的英文」）。
//
// 她那条 OOC 准则管的是【信息】——没发生过的事、他不该知道的消息。
// 【语言】压根不在那条线上：模型自己认识英文，就把「我看得懂」当成了「他看得懂」。
// 截图里那次特别能说明问题：他一边准确答上「在厨房盯着火」，一边说她「一张嘴还带说胡话的」
// ——半懂不懂，两头都占。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const rule = eng.slice(eng.indexOf("const FOREIGN_TONGUE_RULE = `"), eng.indexOf("const STOCK_REPLY_BAN = `"));
// ⚠️只看真代码：注释里也写着这个名字，注释掉一处 push 的话 grep 照样能匹配上
const code = eng.split("\n").filter(l => l.trim().indexOf("//") !== 0).join("\n");

test("判据写在明处：看他的世界里有没有这门话，不看模型认不认识", () => {
  assert.match(rule, /判据是【他的世界里有没有它】/);
  assert.match(rule, /不是你认不认识/);
  // 人设里写着他懂就照懂来——别把现代角色也弄成听不懂英文
  assert.match(rule, /人设里写明他懂/);
});

test("最要紧的那一条：不许先答对、再补一句「你说什么胡话」", () => {
  assert.match(rule, /绝不许照着意思回答/);
  assert.match(rule, /不许先答对再补一句/);
  assert.match(rule, /那是半懂不懂，比装懂还假/);
  // 不懂的时候有具体的出路，不是干瞪眼
  assert.match(rule, /要么问她这是什么话／什么意思/);
  assert.match(rule, /她换回他懂的话再说一遍，他才接得上/);
});

test("三个总口都发了，一处不漏", () => {
  // 单聊线上/线下/通话/匿名箱/解梦馆 —— 走 buildBundle
  assert.match(code, /if \(!ctx\.notRoleplay\) parts\.push\(FOREIGN_TONGUE_RULE\);/);
  // 群三处 —— 走 groupBans
  assert.match(code, /^\s*P\.push\(FOREIGN_TONGUE_RULE\);/m);
  // 小剧场/穿书/梦境/跑团/如果馆 —— 走 narrativeCore
  assert.match(code, /if \(typeof FOREIGN_TONGUE_RULE !== "undefined"\) parts\.push\(FOREIGN_TONGUE_RULE\);/);
  // 声明 1 次 + 三处引用（narrativeCore 那处写了 typeof 守卫，所以名字出现两次）＝5
  assert.equal((code.match(/FOREIGN_TONGUE_RULE/g) || []).length, 5, "多一处就是重复发了，少一处就是漏了");
  assert.equal((code.match(/parts\.push\(FOREIGN_TONGUE_RULE\)|P\.push\(FOREIGN_TONGUE_RULE\)/g) || []).length, 3, "真正 push 的地方不是三处");
});

test("言秋不发：他不是被扮演的角色，本来就跟她同一个世界", () => {
  const i = eng.indexOf("if (!ctx.notRoleplay) parts.push(FOREIGN_TONGUE_RULE);");
  assert.ok(i > 0);
  assert.match(eng.slice(i - 200, i), /言秋（notRoleplay）不发/);
});

test("不许挂在别人身上搭便车", () => {
  // v55.90 那条：能独立成立的规则就让它独立成立——挂在可选块里，那个块不发它就跟着没
  assert.match(eng, /^const FOREIGN_TONGUE_RULE = `/m);
  const cb = eng.slice(eng.indexOf("ContentBoundaries.prompt"), eng.indexOf("ContentBoundaries.prompt") + 400);
  assert.doesNotMatch(cb, /FOREIGN_TONGUE_RULE.*\+/, "被拼进别的常量了");
});
