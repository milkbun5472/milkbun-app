// 她 2026-11-18：「照影发朋友圈能不能做成卡片」——先打开发朋友圈，卡挂在底下，话自己写
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js"), comp = R("js/components.js"), ts = R("js/theme-studio.js");
test("照影「发朋友圈」打开发朋友圈页、不直接发", () => {
  assert.match(app, /onToMoments: z => \{ if \(!z \|\| !z\.title\) return; setMomCardDraft\(\{ zy: z \}\);/);
  assert.match(app, /cardDraft: momCardDraft, onCardDraftDone/);
  assert.match(comp, /useEffect\(\(\) => \{ if \(cardDraft\) setComposeOpen\(true\); \}, \[cardDraft\]\);/);
});
test("发朋友圈页挂着卡、没写字也能发，卡跟着发出去", () => {
  assert.match(comp, /"data-wk": "momzydraft"/);
  assert.match(comp, /if \(!body && !image && !music && !\(zy && zy\.title\) && !\(tarot && \(tarot\.cards \|\| \[\]\)\.length\)\)/);
  assert.match(comp, /zy: zy && zy\.title \? zy : null/);
  assert.match(ts, /\["momzydraft", /);
});
test("看朋友圈的人知道卡上写了什么", () => {
  assert.match(app, /挂了一张照影小测的结果卡/);
});
test("他做的那套能让他自己发：他的口吻、他的朋友圈、挂同一张卡", () => {
  const zy = R("js/zhaoying.js");
  assert.match(zy, /"data-wk": "zycharmoments"/);
  assert.match(app, /onCharToMoments: \(charId, z\) => \{[^\n]*genMoment\(c, \{ zy: z \}\)/);
  assert.match(app, /const genMoment = async \(char, momOpts\) =>/);
  assert.match(app, /\.\.\.\(_zyPost \? \{ zy: \{/);
  assert.match(ts, /\["zycharmoments", /);
});

test("塔罗也能发朋友圈：同一条路、卡挂在底下、看的人知道抽了什么", () => {
  const tarot = R("js/tarot.js");
  assert.match(tarot, /"data-wk": "tarottomoments", onClick: \(\) => props\.onToMoments\(s\)/);
  assert.match(tarot, /onToMoments: props\.onToMoments/);
  assert.match(app, /setMomCardDraft\(\{ tarot: \{ \.\.\.t, who:/);
  assert.match(comp, /function MomentTarot\(\{ tarot \}\)/);
  assert.match(comp, /tarot: tarot && \(tarot\.cards \|\| \[\]\)\.length \? tarot : null/);
  assert.match(app, /挂了一张塔罗卡：/);
  ["tarottomoments", "momtarot", "momtarotdraft"].forEach(k => assert.match(ts, new RegExp('\\["' + k + '", ')));
});
