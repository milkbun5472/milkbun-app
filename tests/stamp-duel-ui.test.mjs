import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const ui = readFileSync(new URL("../js/stamp-duel-ui.js", import.meta.url), "utf8");
const st = readFileSync(new URL("../js/stamps.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const ts = readFileSync(new URL("../js/theme-studio.js", import.meta.url), "utf8");
const idx = readFileSync(new URL("../index.html", import.meta.url), "utf8");
test("邮票册右上「对局」进对局页；打完先选再来一把／结束，结束才问记不记", () => {
  assert.match(st, /tab === "duel"\) return !window\.StampDuelPage/);
  assert.match(st, /onRemember: props\.onDuelRemember, closeOf: props\.duelCloseOf/);
  assert.match(app, /onDuelRemember: \(charId, line\) =>/);
  assert.match(app, /duelCloseOf: charId =>/);
  assert.match(ui, /D\(\)\.addGame\(series, st\)/);
  assert.match(ui, /onRemember\(foeId, D\(\)\.memoryLine\(sr, foeName, meName\)\)/);
  assert.match(idx, /data-lazy="stamps" data-src="js\/stamp-duel-ui\.js/);
  for (const k of ["stampgoduel", "duelpage", "duelcell", "duelhand", "duelsend", "duelintent", "duelremember"]) assert.ok(ts.includes('"' + k + '"'), k);
});
test("票上放卡面（走邮票册那份缩略图）、写是谁的卡；有撤回键", () => {
  assert.match(st, /useThumb: useStampThumb \}\);/);
  assert.match(ui, /ownerOf = id => id \? nameOf\(id\) \+ "的卡"/);
  assert.match(ui, /"data-wk": "duelundo", onClick: back1, disabled: !D\(\)\.canUndo\(st\)/);
});
