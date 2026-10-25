const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
test("情侣空间唱片能关掉「进空间自动放」，每张唱片各管各的（2026-10-26）", () => {
  assert.match(app, /const has = discSongsOf\(cid\)\.length && discAutoOf\(cid\);/);
  assert.match(app, /const discAutoOf = cid => !\(\(coupleDiscRef\.current \|\| \{\}\)\[cid\] \|\| \{\}\)\.noAuto;/);
  assert.match(app, /onDiscAuto: \(cid, on\) => saveCoupleDisc\(p => \(\{ \.\.\.p, \[cid\]: \{ \.\.\.\(\(p \|\| \{\}\)\[cid\] \|\| \{\}\), noAuto: !on \} \}\)\)/);
  assert.match(scr, /"data-wk": "discauto"/);
  assert.match(scr, /onAuto: onDiscAuto \? on => onDiscAuto\(partner\.id, on\) : null/);
  assert.match(fs.readFileSync(__dirname + "/../js/theme-studio.js", "utf8"), /"discauto"/);
});
