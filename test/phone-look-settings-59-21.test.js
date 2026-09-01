const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const phone = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");

test("查手机外观按角色分桶，图片进入金库而不是 5MB 文字仓", () => {
  assert.match(phone, /loadJSON\("x_phoneLooks", \{\}\)/);
  assert.match(phone, /\[char\.id\]: \{ \.\.\.\(prev\[char\.id\] \|\| \{\}\), \.\.\.patch \}/);
  assert.match(phone, /await imgToVault\(ref\)/);
  assert.match(phone, /saveJSON\("x_phoneLooks", next\)/);
});

test("锁屏、主页与每个 App 图标都能单独换", () => {
  assert.match(phone, /uploadCard\("lockWallpaper", "锁屏"/);
  assert.match(phone, /uploadCard\("homeWallpaper", "主页"/);
  assert.match(phone, /look\.icons && look\.icons\[a\.key\]/);
  assert.match(phone, /onPatch\(\{ icons: \{ \.\.\.\(look\.icons \|\| \{\}\), \[a\.key\]: v \} \}\)/);
  assert.match(phone, /aria-label": "手机外观设置"/);
});

test("查手机沿用主界面的纸面与图标色，并保留四种有区别的图标预设", () => {
  assert.match(phone, /typeof appTone === "function"/);
  assert.match(phone, /typeof HOME_PAPER_BG !== "undefined"/);
  ["main", "soft", "mono", "glass"].forEach(key => {
    assert.match(phone, new RegExp('key: "' + key + '"'));
  });
  assert.match(phone, /preset === "soft"/);
  assert.match(phone, /preset === "mono"/);
  assert.match(phone, /preset === "glass"/);
});

test("外观设置是完整可滚动子页面，顶底安全区沿用移动端铁律", () => {
  const start = phone.indexOf("function PhoneLookSettings(");
  const end = phone.indexOf("function LockScreen(", start);
  assert.ok(start >= 0 && end > start, "找不到 PhoneLookSettings");
  const view = phone.slice(start, end);
  assert.match(view, /paddingTop: safeTop\(10\)/);
  assert.match(view, /flex-1 min-h-0 overflow-y-auto/);
  assert.match(view, /paddingBottom: COMPOSER_PAD_BOTTOM/);
});
