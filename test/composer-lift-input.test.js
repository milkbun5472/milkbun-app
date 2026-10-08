// 群里有人报 2026-10-08：「键盘弹上来之后看不到输入框里的文字」「太底下了有时候会点不到」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const rd = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const comp = rd("components.js"), eng = rd("engine.js"), scr = rd("screens.js"), app = rd("app.js");

test("聊天输入框是会长高的多行框，回车发送、Shift+回车换行、输入法选词不发", () => {
  const a = comp.indexOf("function DraftInput("), b = comp.indexOf("function ReplyKey(", a);
  const f = comp.slice(a, b);
  assert.match(f, /h\("textarea"/);
  assert.match(f, /el\.style\.height = Math\.min\(DRAFT_MAX_H, el\.scrollHeight\) \+ "px"/);
  assert.match(f, /e\.key === "Enter" && !e\.shiftKey && !e\.isComposing/);
});

test("输入栏往上抬：一个常量管全 App，开机读、设置里拖", () => {
  assert.match(eng, /const COMPOSER_PAD_BOTTOM = "calc\(env\(safe-area-inset-bottom\) \* 0\.4 \+ var\(--composer-lift, 0px\)\)";/);
  assert.match(app, /setComposerLift\(loadJSON\("x_composerLift", 0\)\)/);
  assert.match(scr, /"输入栏往上抬"/);
  assert.match(scr, /saveJSON\("x_composerLift", lift\)/);
});

test("自动适配底边：开关默认开，只在安卓＋手机报 0 时多抬，跟手动拉条相加", () => {
  assert.match(eng, /if \(!\/Android\/i\.test\(navigator\.userAgent \|\| ""\)\) return false;/);
  assert.match(eng, /return pad === 0;/);
  assert.match(eng, /const n = _composerManual \+ \(_composerAuto && composerNeedsAuto\(\) \? COMPOSER_AUTO_LIFT : 0\);/);
  assert.match(app, /setComposerAuto\(loadJSON\("x_composerAuto", true\) !== false\)/);
  assert.match(scr, /"自动适配底边"/);
});
