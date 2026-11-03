const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("按发送不收键盘：单聊群聊发送键都不抢焦点，刚失焦就把焦点还回去", () => {
  assert.equal((comp.match(/onClick: fire,\n\s*(\/\/[^\n]*\n\s*)?onMouseDown: e => e\.preventDefault\(\)/g) || []).length, 2);
  assert.match(comp, /Date\.now\(\) - blurAt\.current < 600/);
  assert.match(comp, /el\.focus\(\{ preventScroll: true \}\)/);
});

test("打字量高度：样式只在框换了或宽度变了时才抄，不是每个字都 getComputedStyle", () => {
  assert.match(comp, /if \(!c \|\| c\.w !== w\) \{\n\s*const cs = getComputedStyle\(el\);/);
  assert.match(comp, /return m\.scrollHeight \+ c\.extra;/);
});
test("安卓上发完先失焦再聚焦，让输入法重新开一段（安卓 Edge 聊两句就打不上字）", () => {
  const src = require("fs").readFileSync(__dirname + "/../js/components.js", "utf8");
  const a = src.indexOf("function DraftInput("), body = src.slice(a, src.indexOf("function ReplyKey", a));
  assert.match(body, /const ANDROID = typeof navigator !== "undefined" && \/Android\/i\.test/);
  assert.match(body, /const reset = keep && \(ANDROID \|\| composing\.current\);/);
  assert.match(body, /if \(reset\) \{ try \{ el\.blur\(\); \} catch \(e\) \{\} setTimeout\(\(\) => \{ try \{ el\.focus\(\{ preventScroll: true \}\); \} catch \(e\) \{\} \}, 0\); \}/);
  assert.match(body, /onCompositionStart: \(\) => \{ composing\.current = true; \}/);
});
