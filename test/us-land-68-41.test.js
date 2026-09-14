// 她 2026-09-14：「情侣空间叫他刻歌然后从聊天点进去是全部已有情侣空间汇总那一页，
// 而不是他自己的情侣空间」。
//
// 病根：聊天里那张唱片卡只做了 setScreen("us")——**没说是谁**，于是落在名册页上。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

test("唱片卡点进去带上【是谁】和【哪一扇门】", () => {
  assert.match(app, /onOpenUs: \(\) => \{ setUsLand\(\{ view: activeChar\.id, sub: "disc" \}\); setScreen\("us"\); \}/);
  // 光 setScreen("us") 那一版不许回来
  assert.doesNotMatch(app, /onOpenUs: \(\) => setScreen\("us"\)/);
  // 落点要真的递进去
  assert.match(app, /land: usLand,\s*\n\s*onLanded: \(\) => setUsLand\(null\),/);
});

test("落点只消费一次——不然她退回名册会被一渲染又送回去", () => {
  const i = scr.indexOf("    if (!land || !land.view) return;");
  assert.ok(i > 0, "Us 没接落点");
  const fn = scr.slice(i - 300, i + 700);
  assert.match(fn, /if \(onLanded\) onLanded\(\);/);
  assert.match(fn, /\}, \[land\]\);/);
});

test("不是恋人就停在名册，别把她扔进一个空房间", () => {
  const i = scr.indexOf("    if (!land || !land.view) return;");
  const fn = scr.slice(i, i + 700);
  assert.match(fn, /status === "together"/);
  assert.match(fn, /if \(ok\) \{ setView\(land\.view\);/);
  // ⚠️落点这一路也得走 openSub（couple-space-62-26 那条：开子页只能走一个出口，
  //   不然那扇门回来会跳顶）——直接 setSub 的第一版当场被那条测试揪出来了
  assert.match(fn, /if \(land\.sub\) openSub\(land\.sub\); else setSub\(null\);/);
  // 就算不成立也要把落点还回去，否则它会一直挂着
  assert.ok(fn.indexOf("if (onLanded) onLanded();") > fn.indexOf("if (ok)"));
});

test("唱片架那扇门的 key 没写错", () => {
  assert.match(scr, /sub === "disc"\) \{[\s\S]{0,120}CoupleDiscShelf/);
});
