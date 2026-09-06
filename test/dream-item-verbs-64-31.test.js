// 梦里带出来的那几件，只剩【带在身上】这一格（她 2026-09-06：「梦里带出来的
// 不应该有这些吧」）。
//
// 剩下那四个动词全都把它当成一件【真东西】处置：用掉记进「用过的」、
// 留在他那儿会让他开口说破、送给谁把它转手给第三个人、收进衣柜等于给它
// 办了张永居——而这一类【唯一的规矩】就是没人提起就会淡掉（core.js dreamStage）。
//
// ⚠️两头都要钉：界面不给按钮只是降概率，处置那四个函数里也得挡住
//   （「规则降概率，代码才保证」）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const scr = R("screens.js"), app = R("app.js");

// 那张半窗里动词的那一段
const menu = scr.slice(scr.indexOf('row(invItem.onMe ? "放下" : "带在身上"') - 2500,
  scr.indexOf('} else if (sheet && sheet.kind === "regift")'));

test("界面：梦里带出来的只留【带在身上】", () => {
  ["用掉", "留在他那儿", "送给谁", "收进衣柜"].forEach(zh => {
    const i = menu.indexOf('row("' + zh + '"');
    assert.ok(i > 0, "找不到「" + zh + "」那一格");
    // 这一格前面必须挂着 dreamy 那道闸
    assert.match(menu.slice(i - 40, i), /dreamy \? null : $/,
      "「" + zh + "」对梦里带出来的那几件也还在给");
  });
  // 带在身上那一格【不许】挂闸：那才是这件事本来的玩法
  const keep = menu.indexOf('row(invItem.onMe ? "放下" : "带在身上"');
  assert.ok(menu.slice(keep - 40, keep).indexOf("dreamy ? null :") < 0,
    "把「带在身上」也挡掉了——那一格正是梦里带出来的东西唯一能做的事");
  // 只剩一格时得说清为什么，不然看着像坏了
  assert.match(menu, /梦里带出来的东西留不住，没人再提起，它自己就淡回梦里去了/,
    "只剩一格，却没交代为什么");
});

test("代码：那四个处置函数各自挡一道", () => {
  assert.match(app, /const dreamBound = it => \{[\s\S]*?it\.source !== "dream"[\s\S]*?\};/,
    "没有那道闸");
  ["const useUpItem = id => {", "const giftInvItem = (id, charId) => {",
   "const closetInvItem = (id, occ) => {", "const leaveAtHis = async (id, charId, placeId, zoneIdx) => {"]
    .forEach(sig => {
      const i = app.indexOf(sig);
      assert.ok(i > 0, "找不到 " + sig);
      assert.ok(app.slice(i, i + 400).indexOf("dreamBound(it)") > 0,
        sig + " 里没挡住梦里带出来的那几件");
    });
});

test("那道闸只认 source==='dream'，买的和他送的一律放行", () => {
  const seg = app.slice(app.indexOf("const dreamBound = it => {"));
  const fn = new Function("toast", seg.slice(0, seg.indexOf("\n  };") + 5) + "\nreturn dreamBound;")(() => {});
  assert.equal(fn({ source: "dream" }), true);
  assert.equal(fn({ source: "shop" }), false);
  assert.equal(fn({ source: "" }), false);
  assert.equal(fn(null), false);
});
