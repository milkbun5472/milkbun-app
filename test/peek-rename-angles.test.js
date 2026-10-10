// 她 2026-10-10：「为啥 char 查手机改备注都是一个德行，什么唯一合法的老公」——掷角度不掷答案，挑像自己的，不像就不用
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");

test("每趟抽两个不重样的角度，留出口；不写禁令", () => {
  const i = app.indexOf("  const PEEK_RENAME_ANGLES = ["), j = app.indexOf("  // 她在TA手机的微信通讯录里改备注", i);
  assert.ok(i > 0 && j > i, "抠不出角度表");
  const seg = app.slice(i, j);
  const fn = new Function(seg + "\nreturn { peekRenameAngles, PEEK_RENAME_ANGLES };")();
  for (let k = 0; k < 30; k++) {
    const s = fn.peekRenameAngles();
    const m = s.match(/①(.+?)；②(.+?)。/);
    assert.ok(m && m[1] !== m[2], "两个角度得不一样");
    assert.ok(fn.PEEK_RENAME_ANGLES.includes(m[1]) && fn.PEEK_RENAME_ANGLES.includes(m[2]));
    assert.match(s, /两个都不像你，就照你自己的来，或者不改/);
  }
  assert.doesNotMatch(seg.replace(/\/\/[^\n]*/g, ""), /老公|合法|唯一/, "角度表里不许出现那个梗本身");
  assert.match(app, /不想改就别写。" \+ peekRenameAngles\(\)/);
});
