const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), ph = R("phone.js"), scr = R("screens.js");
const L = new Function("T", ph.slice(ph.indexOf("function phoneLastAllLabel(ts) {"), ph.indexOf("function phoneSearch(")) + "\nreturn phoneLastAllLabel;")(x => x);
const DAY = 86400000;

// 她 2026-08-31：「查手机还是看不出来哪些刷了哪些没刷，你把每周自动刷一次那个小字
// 改成上次全部刷新的时间」。原来那行小字说的是【开关状态】，不是【刷没刷】。
test("通讯录那行小字报的是上次全刷，不是开关状态", () => {
  const row = ph.slice(ph.indexOf('weekAt && weekAt.id === c.id ? "正在刷新……"'), ph.indexOf('weekAt && weekAt.id === c.id ? "正在刷新……"') + 200);
  assert.match(row, /phoneLastAllLabel\(\(lastAll \|\| \{\}\)\[c\.id\]\)/, "还是在报开关状态");
  assert.ok(row.indexOf("每周自动刷一次") < 0 && row.indexOf("翻翻 Ta 的手机") < 0, "旧文案还在——那说的是开关，不是刷没刷");
  // 正在刷的那位仍然优先显示「正在刷新……」：活的状态盖过历史
  assert.match(row, /weekAt && weekAt\.id === c\.id \? "正在刷新……"/, "正在刷的那位看不出来了");
  // 开关本身还在（那一行右边的「每周」按钮），只是不再挤在小字里
  assert.match(ph, /aria-label": "每周自动刷新 "/, "把开关一起删掉了");
  assert.match(app, /lastAll: phoneLastAll,/, "没传下去");
});

test("时间怎么说话：今天/昨天/几天前/日期", () => {
  const now = Date.now();
  assert.match(L(now - 3600000), /^今天 \d\d:\d\d 刷过$/);
  assert.match(L(now - 26 * 3600000), /^昨天 \d\d:\d\d 刷过$/);
  assert.equal(L(now - 3 * DAY), "3 天前刷过");
  assert.match(L(now - 40 * DAY), /^\d+月\d+日刷过$/);
});

// 宁可说不知道，也别报一个假的时刻
test("没记录就说没记录，不拿别处的时间戳凑数", () => {
  ["", 0, null, undefined, NaN, "x"].forEach(v => assert.equal(L(v), "还没全刷过", "拿 " + String(v) + " 当成刷过了"));
  const gen = app.slice(app.indexOf("  const genPhoneAll = async (char, weekly) => {"), app.indexOf("  // ---- moments ----"));
  assert.match(gen, /if \(ok\) setPhoneAuto|if \(ok\) setPhoneLastAll/, "没记这一笔");
  assert.match(gen, /if \(ok\) setPhoneLastAll\(p => \{/, "一个 app 都没刷成也记成「刷过了」");
  assert.match(app, /setPhoneLastAll\(loadJSON\("x_phoneLastAll", \{\}\)\);/, "重开 App 就忘了");
});

// 她 2026-08-31：「照片馆生成的照片应该也自动有 description 吧，那我分享回去
// 上下文不也直接有了吗」——对。desc 拍的时候就写好了（场景 + 两身衣服）。
test("照相馆那张发到聊天，描述跟着一起过去", () => {
  const sh = app.slice(app.indexOf("  const shareShotToChat = async (char, shot) => {"), app.indexOf("  // ═══ 他看见的那张照片"));
  assert.match(sh, /const desc = String\(shot\.desc \|\| shot\.scene \|\| ""\)\.trim\(\);/, "没把拍的时候那句带上");
  assert.match(sh, /desc: desc, content: desc \? "\[照片\] " \+ desc : "\[照片\]"/, "desc 没进消息——历史行里就成了一张没来历的图");
  assert.match(sh, /kind: "photo", imageRef: ref, photoMode: "real"/, "不是当真照片发的");
  // 照相馆存 img_ 仓、聊天读 iv_ 图库，是两个仓，得搬一趟
  assert.match(sh, /ref = await imgToVault\(await blobToDataUrl\(blob\)\);/, "没把图搬进聊天读得到的那个仓——发过去会是一张空图");
  assert.match(sh, /if \(!blob\) throw new Error/, "图丢了也照发一条空的");
  assert.match(sh, /setActiveChar\(char\); setScreen\("thread"\);/, "发完不带她过去");
  assert.match(scr, /onShare: shot => onShareShot\(partner, shot\)/, "界面没接上");
  assert.match(scr, /"发给 " \+ \(partner\.remark \|\| partner\.name\)/, "大图上没有那个键");
});
