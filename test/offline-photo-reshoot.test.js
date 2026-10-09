// 她 2026-10-02：「线下的图不能编辑重roll」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js"), comp = R("js/components.js");

test("线下照片卡有重拍和改描述两个按钮", () => {
  const i = comp.indexOf('if (m.kind === "selfie") return h("div", { className: "my-2.5" }', comp.indexOf("function OffCard"));
  const seg = comp.slice(i, comp.indexOf("h(SelfieBubble, { m: m })", i));
  assert.match(seg, /title: "重拍这张"/);
  assert.match(seg, /title: "改画面描述"/);
  assert.match(seg, /照这个重拍/);
});

test("单人线下和群线下都先走就地重拍，拍不了不挂转圈", () => {
  assert.equal((app.match(/reshootOffShot\(\{ scopeKey: activeOfflineScopeKey/g) || []).length, 2);
  assert.equal((app.match(/reshootOffShot\(\{ groupId: offlineGroup\.id/g) || []).length, 2);
  const i = app.indexOf("const reshootOffShot");
  const seg = app.slice(i, app.indexOf("runOfflineShot(", i));
  assert.ok(seg.indexOf("offlinePhotoCan(char)") < seg.indexOf("pending: true"), "先查能不能拍，再挂拍照中");
  assert.match(app, /reuseSid: m\.sid/);
});

test("重拍／改描述：照片卡永远不掉进重写文字那条路；拍坏了旧图放回去；新图换新键（群友 2026-10-09）", () => {
  const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
  const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
  const fn = app.slice(app.indexOf("const reshootOffShot = "), app.indexOf("const groupOfflineShotNow"));
  assert.match(fn, /if \(!m \|\| m\.kind !== "selfie"\) return false;/);
  assert.doesNotMatch(fn, /m\.pending \|\| !m\.sid\) return false/);
  assert.match(fn, /const stuck = m\.pending/);
  assert.doesNotMatch(fn, /imgKey: null, imgUrl: null/, "重拍前不先把旧图清掉");
  assert.match(fn, /keep: \{ imgKey: m\.imgKey/);
  assert.match(app, /const keep = arg && arg\.keep/);
  assert.match(app, /sid \+ \(reuse \? "_" \+ Date\.now\(\)\.toString\(36\) : ""\)/);
});
