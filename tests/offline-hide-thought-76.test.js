// 线下「显示心声」开关（2026-10-30 群里许愿）：关了每一拍底下那行心声不画；只管显示
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
test("设置里有开关，存成 hideThought", () => {
  assert.match(src, /const \[sShowTh, setSShowTh\] = useState\(os\.hideThought !== true\)/);
  assert.match(src, /onSaveSettings\(\{ hideThought: !sShowTh, noAutoShot: sNoShot,/);
});
test("OffCard 关着就不画心声那一行", () => {
  assert.match(src, /castPick && !hideThought \? h\("div", \{ "data-wk": "offthought"/);
  assert.match(src, /\(!isUser && m\.thought && !hideThought\) && h\("div", \{ "data-wk": "offthought"/);
  assert.match(src, /hideThought: !!\(settings && settings\.hideThought\)/);
});
test("群见面也有开关，传进群的 OffCard", () => {
  assert.match(src, /onSaveSettings && onSaveSettings\(\{ hideThought: !sShowTh, noAutoShot: sNoShot,/);
  assert.match(src, /gShow\("scene", "thought", "显示心声",/);
  assert.match(src, /clockId: group && group\.id \? "g:" \+ group\.id : undefined, hideThought: !!\(settings && settings\.hideThought\),/);
});
