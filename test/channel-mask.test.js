// 面具挂在空间这一层，单个频道还能单独换（她 2026-11-20「不同的面具开频道怎么算」）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), cs = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("频道没挑面具就跟空间那张；面具不同的频道在 spaceSibs 里当成不互通", () => {
  const i = ap.indexOf("const groupMaskKey = "), body = ap.slice(i, ap.indexOf("};", i));
  assert.match(body, /if \(_g0 && _g0\.spaceId\) \{ const _sp0 = /);
  const j = ap.indexOf("const spaceSibs = "), sb = ap.slice(j, ap.indexOf("const chMaskSame", j));
  assert.match(sb, /groupMaskKey\(x\.id\) !== om/);
  assert.match(sb, /chSolo: true, chShareMembers: false/);
  assert.match(ap, /spaceChannelBlock\(spaceSibs\(groupId\)\.find/);
  assert.match(ap, /const sibs0 = spaceSibs\(groupId\), tg = chHopPick\(/);
});
test("精华、见面、她的状态也按面具分开；改频道页能单独挑或跟空间一样", () => {
  assert.match(ap, /chMaskSame\(x\.gid, groupId\)/);
  assert.match(ap, /spaceMeetMaskOk\(group\) \? spaceMeetLine/);
  assert.match(ap, /!groupSpectating\(group\) && !groupMaskKey\(groupId\)\)/);
  assert.match(ap, /saveGroupSettingsRaw\(g\.id, \{ maskId: patch\.maskOwn == null \? null : /);
  assert.match(cs, /function MaskChips\(/);
  assert.match(cs, /extra: \{ id: null, name: "跟空间一样" \}/);
});
