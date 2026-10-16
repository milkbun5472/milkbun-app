// 片刻情侣号好玩一点（她 2026-10-15「都做吧」）：CP 粉、偷拍、情侣挑战、抢号、纪念日
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/shua.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("CP 粉：TA发、她发、刷点评论都写成嗑你俩的粉丝；涨粉过整数落消息、TA记一笔", () => {
  assert.match(src, /底下网友评论 comments 多是这个号的 CP 粉/);
  assert.match(src, /多是嗑你俩的 CP 粉——催更、考古/);
  assert.match(src, /v\.cp \? "\\n这是一个情侣号，刷到的多半是这个号的 CP 粉/);
  assert.match(src, /\[1000, 10000, 100000, 1000000\]\.find\(m => was < m && now >= m\)/);
});
test("偷拍她：一半的情侣号视频是背着她拍的；她点赞或点开评论时TA记一笔她看到了（只一次）", () => {
  assert.match(src, /if \(toCp\[c\.id\] && !opts\.anniv && Math\.random\(\) < 0\.5\) candid\[c\.id\] = true;/);
  assert.match(src, /if \(!v \|\| !v\.candid \|\| v\.candidSeen \|\| !v\.charId\) return;/);
});
test("情侣挑战：TA看不见她的答案，答完当成情侣号上的一条发出去", () => {
  assert.match(src, /两个人分开写答案，谁也看不见谁的/);
  assert.match(src, /await postMine\(\{ scene: "情侣挑战「" \+ q/);
});
test("抢号：她改了TA知道；TA发视频时能顺手改，改了消息里告诉她", () => {
  assert.match(src, /lastEdit: \{ by: "me", ts: Date\.now\(\) \}/);
  assert.match(src, /,"cpEdit":\{"handle":"","bio":""\}\}/);
  assert.match(src, /把情侣号" \+ \(ch\.handle \? "的名字改成了/);
});
test("纪念日：整百天、整周年那天进片刻TA自己发一条，一天一回", () => {
  const f = new Function(src.slice(src.indexOf("function annivLabel"), src.indexOf("// ── 情侣挑战（她 2026-10-15")) + "\nreturn annivLabel;")();
  const d0 = new Date(2026, 9, 15); d0.setHours(0, 0, 0, 0);
  assert.equal(f(new Date(2025, 9, 15, 20).getTime(), d0), "在一起 1 周年");
  assert.equal(f(d0.getTime() - 100 * 86400000, d0), "在一起第 100 天");
  assert.equal(f(d0.getTime() - 99 * 86400000, d0), "");
  assert.match(src, /a\.annivDone === key\) return;/);
  assert.match(app, /coupleOf: id => \(couplesRef\.current \|\| \{\}\)\[id\] \|\| null/);
});
test("她发视频：本机掷骰子定有没有人刷到、几个、是谁；没人刷到不花调用", () => {
  assert.match(src, /const anyone = lead \? true : Math\.random\(\) < 0\.4;/);
  assert.match(src, /if \(!pool\.length\) \{ patchV\(v\.id/);
  assert.match(src, /他们平时私聊里怎么跟她说话（下面各自那几句），评论区里还是那个人/);
  assert.match(app, /\.slice\(-10\)\.map\(m => \(m\.role === "user" \? uN : c\.name\)/);
});
