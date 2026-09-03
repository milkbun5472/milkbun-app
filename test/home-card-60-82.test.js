// 主页名片重做（她 2026-09-03：「我头像那个框太单调了」，附了四张参考图）。
// 钉三样：① 卡有自己的封面；② 底下那排数是【这个 app 才有的】；
// ③ 不许给里面那层写 height:100%（会把卡撑到整屏高，主屏就毁了）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const card = comp.slice(comp.indexOf("function HomeCard("), comp.indexOf("function HomeCardSheet("));

test("卡有自己的封面，没设封面也不是一块白板", () => {
  assert.match(card, /const cover = c\.cover/);
  assert.match(card, /backgroundImage: "linear-gradient\(105deg,rgba\(0,0,0,\.46\)/, "有图时要压暗角，字才读得清");
  assert.match(card, /linear-gradient\(135deg," \+ accent \+ "2e/, "没图时用她头像的颜色调一层光");
  // 有图/没图两套字色，深色主题和照片上都不能只靠一种
  assert.match(card, /const ink = onCover \? "#fff" : t\.ink/);
});

test("底下那排数是这个 app 才有的，不是 Following/Follower/Like", () => {
  assert.match(card, /"认识"/);
  assert.match(card, /"在一起"/);
  assert.match(card, /"第几天"/);
  // 只看真的印出去的字符串（注释里提到 Following 是在解释为什么不能抄）
  assert.doesNotMatch(card, /"(Following|Follower|Like)"/i, "抄成社交数据就又成了任何 app");
  // 没有的那一格不占位置（还没谈恋爱时不该挂两个 0）
  assert.match(card, /together\.length \? \[together\.length, "在一起"\] : null/);
  assert.match(card, /days \? \[days, "第几天"\] : null/);
});

test("绝不许给里面那层写 height:100%——那会把卡撑到整屏高", () => {
  assert.doesNotMatch(card, /height: "100%"/);
  assert.match(card, /display: "flex", flexDirection: "column" \}, skin\)/, "卡自己是 flex 列");
  assert.match(card, /flex: 1, minHeight: 0, padding: "14px 14px 0"/, "里面那层用 flex:1，不是 100%");
  assert.match(card, /marginTop: "auto"/, "被行拉高时那排数贴着底边");
});
