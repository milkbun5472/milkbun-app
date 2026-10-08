// 她 2026-10-07：「他刷我亲属卡没带头像！又没跟上公共形状！而且也不能长按出菜单」→「全部小卡类都接上去」
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
const pressKinds = () => { const a = src.indexOf("const CARD_PRESS_KINDS = ["); return src.slice(a, src.indexOf("];", a)); };

test("长按只有 cardPressRow 一处：cardRow 只管位置和头像，不再自己挂（不然多选点一下选两次）", () => {
  const a = src.indexOf("const cardRow = (i, m, card) =>"), b = src.indexOf("};", a);
  const row = src.slice(a, b);
  assert.doesNotMatch(row, /startPress|toggleSel/);
  assert.match(row, /!isU && h\(Avatar, \{ character: character/);
  assert.match(row, /isU && dsp\.myAvatar && h\(Avatar, \{ character: meAv/);
});

test("所有小卡都在长按名单里", () => {
  const list = pressKinds();
  for (const k of ["mykin", "mykinbill", "mykindaily", "mykinedit", "kinship", "kinbill", "kinraise", "kinunbind", "datememory", "callinvite",
    "ficinvite", "ficdone", "studyinvite", "gameinvite", "readinvite", "tarotinvite", "geo", "gift", "takeout", "loveletter", "askphone", "paylater"]) assert.match(list, new RegExp('"' + k + '"'), k);
});

test("没头像的那几张（亲属卡八张、情书、要手机、代付、记账分享）交给 cardRow 挂头像", () => {
  assert.match(src, /if \(KIN_CARDS\[m\.kind\]\) return cardRow\(i, m, h\(KIN_CARDS\[m\.kind\], \{ m: m, character: character, inRow: true \}\)\);/);
  assert.match(src, /if \(m\.kind === "loveletter"\) return cardRow\(i, m, h\(LoveLetterCard/);
  assert.match(src, /if \(m\.kind === "askphone"\) return cardRow\(i, m, h\(PhoneAskCard/);
  assert.match(src, /if \(m\.kind === "paylater"\) return cardRow\(i, m, h\(PayLaterCard/);
  assert.match(src, /if \(m\.kind === "ledgershare"\) return cardRow\(i, m,/);
});
