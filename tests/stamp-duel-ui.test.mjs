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
test("明牌摊开对面手牌、标要贴；寄出后照这一回合的记录放特效，放完才能再寄", () => {
  assert.match(ui, /!st\.blind && them\.hand\.length \? h\("div", \{ "data-wk": "duelfoehand"/);
  assert.match(ui, /const evs = st\.log\.slice\(n0\)/);
  assert.match(ui, /"data-wk": "duelsend", onClick: send, disabled: !!fx/);
});
test("没打完退出去留存档：开局页出「接着打／放弃」，打完或放弃才清", () => {
  assert.match(ui, /const SAVE_KEY = "x_stampDuelSave"/);
  assert.match(ui, /if \(x && !x\.over\) saveJSON\(SAVE_KEY/);
  assert.match(ui, /"data-wk": "duelresume"/);
  assert.match(ui, /setSeries\(null\); setSt\(null\); persist\(null\);/);
});
