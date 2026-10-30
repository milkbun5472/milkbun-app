// 群里 2026-10-23「我跟推演出来的聊天说话接不上，她不回我的话」「日期过了好几天那个时间戳能不能显示出来，换话题」
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), ui = R("phone-ui.js"), ph = R("phone.js");
test("替他发的那句一定在对面读到的记录最后", () => {
  assert.ok(app.includes('"\\n【" + char.name + " 刚发的，你要回的就是这一句】" + char.name + "：" + body'));
});
test("替他发、对面回的都记时间；时间线隔十分钟才画，不是今天的补日子", () => {
  assert.ok(app.includes("...msgs.map(m => ({ ...m, _at: m._at || Date.now() }))"));
  assert.ok(ui.includes("Math.abs(m._at - prevM._at) > 10 * 60000"));
  // 2026-10-30 重锚：虚拟时间巡检（v76.988~992）把「今天」改成照角色那只钟算，
  //   这条测的不是取今天的写法，是上面那个判据本身。
  assert.match(ui, /return d\.toDateString\(\) === new Date\([\s\S]{0,120}?\)\.toDateString\(\) \|\| \/月\|日\|昨\|前天\|周\|星期\/\.test\(lb\) \? lb : md \+ " " \+ lb;/);
});
test("刷新时告诉模型每个会话隔了几天", () => {
  assert.ok(ph.includes("（上次说话是 \" + _days + \" 天前，那件事已经过去了；这回说的是这几天新发生的）"));
});

test("替他发完，列表的日子和先后跟着动（_ts）", () => {
  assert.ok(app.includes('time: tm, _upd: Date.now(), _ts: Date.now() } : c) }'));
});
