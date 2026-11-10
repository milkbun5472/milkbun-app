import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../js/components.js", import.meta.url), "utf8");
test("匿名箱的回答走 TransText，外语也有译文", () => {
  assert.match(src, /h\(TransText, \{ text: r\.a, zhReady: r\.zh, ink: A\.sub \}\)/);
});
test("没答时留的那句反应也带译文", () => {
  assert.match(src, /transShow\("（" \+ r\.note \+ "）", r\.noteZh\)/);
});
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
test("双语说法只有 probeBiLine 一份：runProbe 的 voice 那一路自动加，callAI 传 biFor 就加", () => {
  const eng = readFileSync(new URL("../js/engine.js", import.meta.url), "utf8");
  assert.match(eng, /function probeBiLine\(char, probe\)/);
  assert.match(eng, /probe\.instruction \+ probeBiLine\(ctx\.char, probe\)/);
  assert.match(eng, /if \(opts && opts\.biFor && typeof system === "string"/);
  assert.doesNotMatch(app, /anonBiOn|anonBiSpec/, "匿名箱又自己写了一份");
  const r = f => readFileSync(new URL("../js/" + f, import.meta.url), "utf8");
  for (const f of ["read.js", "dreamjournal.js", "tarot.js", "memo.js", "ledger.js", "listen-talk.js", "watch.js", "debate.js"]) assert.match(r(f), /biFor: /, f + " 没接");
});
