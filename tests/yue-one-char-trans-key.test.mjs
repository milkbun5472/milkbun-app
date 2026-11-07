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
