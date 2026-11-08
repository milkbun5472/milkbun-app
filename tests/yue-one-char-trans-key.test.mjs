import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const cmp = readFileSync(new URL("../js/components.js", import.meta.url), "utf8");
test("粤语补译没成：语种记在消息上，单聊群聊气泡照它出「译」", () => {
  assert.match(app, /_yueFill\[i\] && !_biZh\.get\(bilingualKey\(words\[i\]\)\) && hanLangOf\(char\) && hanLineLang\(words\[i\]\) \? \{ lang: hanLineLang\(words\[i\]\) \}/);
  assert.match(app, /_gYueFill\[j\] && !gBiZh\.get\(bilingualKey\(gBubbles\[j\]\)\) \? \{ lang: hanLineLang\(gBubbles\[j\]\) \}/);
  assert.equal((cmp.match(/zhReady: m\.zh, langHint: m\.lang \|\| /g) || []).length, 2);
  assert.match(cmp, /hanLangHintOf\(character\)/);
  assert.match(cmp, /hanLangHintOf\(memberById\(m\.senderId\)\)/);
});
test("小游戏台词：漏了竖线也走 TransText，带上说话的人（主语言粤语每句都有译）", () => {
  const g = readFileSync(new URL("../js/games.js", import.meta.url), "utf8");
  assert.match(g, /function gameSaid\(text, who\)/);
  assert.match(g, /h\(TransText, \{ text: raw, zhReady: b && b\.zh \? b\.zh : undefined, inline: true, langHint: hint \|\| undefined \}\)/);
  assert.ok(!/gameSaid\(it\.text\)\./.test(g));
});
test("小游戏里 TA 写的字都走翻译：投票理由、发言、MVP、阿瓦隆、灵犀、故事接龙记录、牌桌记录和气泡", () => {
  const g = readFileSync(new URL("../js/games.js", import.meta.url), "utf8");
  assert.match(g, /const saidOf = \(text, who\) =>/);
  assert.ok((g.match(/saidOf\(/g) || []).length >= 16);
  assert.match(g, /saidOf\(mvp\.reason, mvpP\)/);
  assert.match(g, /x\.kind === "chat" \? saidOf\(x\.text,/);
  assert.match(g, /saidOf\(bub, s\)/);
});
