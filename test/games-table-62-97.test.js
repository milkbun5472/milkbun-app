// v62.97 她 2026-09-05：「小游戏游戏实际界面都没改还是普通的一排头像对着空背景」。
// 盒面那次（games-shelf-61-27）只修了架子；开局之后的那一屏还是：
// 外壳一个 background 都没有 + 一条 38px 头像横排贴着细线。
// 修法照同一个问题问：这一局现实里发生在哪儿？——一张被灯照着的桌上。
// 桌面（gameTable）：t.bg 打底 + 吊灯 + 四边收暗 + 各自盒面延续下来的两团颜色 + 呢绒织纹；
// 座位（Seat）：立在桌沿的席位牌，出局＝牌翻倒盖章，不是整个人淡出。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "games.js"), "utf8");

test("每一局都有自己的桌面，而且是从盒面延续下来的", () => {
  // 八个游戏一个都不能少（跟 GAMES 对齐；新加游戏忘了配桌面，这条当场红）
  const keys = [...src.matchAll(/\{ key: "([a-z0-9]+)", emoji:/g)].map(m => m[1]);
  assert.ok(keys.length >= 8, "GAMES 找不全了");
  const hueSeg = src.slice(src.indexOf("const TABLE_HUE = {"), src.indexOf("function gameTable("));
  keys.forEach(k => assert.ok(new RegExp("^\\s*" + k + ":", "m").test(hueSeg), "「" + k + "」没有桌面颜色"));
  const tbl = src.slice(src.indexOf("function gameTable("), src.indexOf("function Seat("));
  // 主题色不是六位色号就退回纯色——透明度后缀拼在坏值上会整层静默消失（mobile-ui-layout §3.5）
  assert.match(tbl, /\^\#\[0-9a-fA-F\]\{6\}\$/, "没验主题色，坏主题下整张桌子会静默消失");
  assert.match(tbl, /backgroundColor: t\.bg,/, "桌面不再以 t.bg 打底——深浅主题会有一头读不清字");
  // 吊灯 + 收暗的深浅两套：深主题里 t.ink 是浅的，拿它压边等于给屏幕镶光边
  assert.match(tbl, /dark \? "rgba\(0,0,0,\.4\)" : t\.ink \+ "21"/, "四边收暗没分深浅主题");
  assert.match(tbl, /repeating-linear-gradient\(54deg/, "呢绒织纹没了");
});

test("八个对局外壳全都铺上了桌面，顶栏透明不压带子", () => {
  // 五个共用 Head 的（卧底/狼人/猜谜/真心话/阿瓦隆）：header 旁边先备好 table
  assert.equal((src.match(/const table = gameTable\(/g) || []).length, 5, "五个 header 该各配一张桌");
  // 它们的三种外壳（error / loading / 主画面）全要接
  assert.equal((src.match(/className: "h-full flex flex-col", style: table \}/g) || []).length, 10, "error/loading 外壳有漏");
  assert.equal((src.match(/Object\.assign\(\{ position: "relative" \}, table\)/g) || []).length, 5, "主画面外壳有漏");
  // 大富翁（三处）、UNO、开局配置、占位页
  assert.equal((src.match(/gameTable\("monopoly",t\)/g) || []).length, 3, "大富翁的桌少了");
  assert.match(src, /gameTable\("uno", t\)/, "UNO 没上桌");
  assert.equal((src.match(/gameTable\(game\.key, t\)/g) || []).length, 2, "开局配置/占位页没上桌");
  // 猜谜共用引擎按 kind 分桌（海龟汤和 25 问不是同一副游戏）
  assert.match(src, /gameTable\(kind, t\)/, "猜谜没按 kind 分桌");
  // 桌上的 Head 一律透明（§3.5），压回平色就是那条带子
  // 9 = 架子 1 + 五个共用 header + UNO + 开局配置 + 占位页；3 = 大富翁那三条（压缩写法）
  assert.equal((src.match(/onBack: props\.onBack, bg: "transparent" \}\)/g) || []).length, 9, "有 Head 在桌上压平色带（或多出了没登记的）");
  assert.equal((src.match(/onBack:props\.onBack,bg:"transparent"/g) || []).length, 3, "大富翁的 Head 有漏");
  // 老样子一处都不许剩：贴细线的头像横排
  assert.ok(src.indexOf('padding: "10px 16px", borderBottom: "1px solid " + t.line') < 0, "还有老的头像横排");
});

test("座位是席位牌：出局翻倒盖章，圈人靠牌框不靠淡出", () => {
  const seat = src.slice(src.indexOf("function Seat("), src.indexOf("function seatRow("));
  assert.match(seat, /transform: dead \? "rotate\(5deg\) translateY\(3px\)" : "none"/, "出局的牌没翻倒");
  assert.match(seat, /filter: dead \? "grayscale\(1\)" : "none"/, "出局的牌没褪色");
  assert.match(seat, /"出"\)/, "出局的章没了");
  assert.match(seat, /border: "1px solid " \+ \(props\.ring \? t\.tint/, "圈人的牌框没了");
  // 五条座位横排全走的共用件（各画各的迟早又长回横排）
  assert.equal((src.match(/const roster = seatRow\(/g) || []).length, 5, "有座位条没走共用件");
  assert.equal((src.match(/h\(Seat, \{ key: p\.key/g) || []).length, 5, "有座位没用席位牌");
});

test("UNO 和大富翁：轮到谁，谁的牌抬起来——不靠一个色差认", () => {
  // UNO：席位牌上摊一小叠牌背，轮次＝整张牌抬起（transform+阴影+粗框，三样一起变）
  // ⚠️终点锚要从起点之后找：同一句话在这一屏之前就出现过一次，不带 fromIndex 会切出空段
  const unoAt = src.indexOf('gameTable("uno", t)');
  const uno = src.slice(unoAt, src.indexOf('state.status === "finished"', unoAt));
  assert.match(uno, /transform: on \? "translateY\(-2px\)" : "none"/, "UNO 轮次牌不抬了");
  assert.match(uno, /\[0, 1, 2\]\.map\(function \(j\)/, "UNO 席位牌上那叠牌背没了");
  assert.ok(uno.indexOf('borderRadius: 999, padding: "6px 10px"') < 0, "UNO 又回到药丸了");
  // 大富翁同款抬起
  assert.match(src, /transform:i===turn&&!p\.bankrupt\?"translateY\(-2px\)":"none"/, "大富翁轮次牌不抬了");
});
