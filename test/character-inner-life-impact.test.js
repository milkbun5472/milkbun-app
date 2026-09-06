const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

test("角色设置把 live 影响和 shadow 观察明确分开", () => {
  assert.match(source, /正在影响 TA · /);
  assert.match(source, /仍在观察 · 不影响 TA/);
  assert.match(source, /这里只列真正接上行为的模块/);
});

// v62.37：A/E 全开、不留授权，所以这里不再看 mode，只看急停。
test("A 和 E 常开；按过急停才退回只观察", () => {
  assert.match(source, /const _innerOff = aGate\.emergencyOff \|\| eGate\.emergencyOff;/);
  assert.match(source, /余温 · 已开启/);
  assert.match(source, /立体情绪 · 已开启/, "A 接上了却没在这一栏里说");
  assert.match(source, /A 情绪 \/ E 余温：你按过急停，两层都退回只观察/, "急停之后不说话，等于看不出停没停");
  assert.ok(source.indexOf('aGate.mode === "pilot"') < 0, "还在按授权报状态——授权已经没了");
  assert.match(source, /不会冒充经历、不会写进记忆/);
});

test("动念说明不冒充普通回复的人格控制器", () => {
  assert.match(source, /动念 · 已开启/);
  assert.match(source, /只影响 TA 什么时候主动来找你/);
  assert.match(source, /不会改普通聊天回复/);
  assert.match(source, /详细进度就在下方/);
  assert.match(source, /renderDongnianGauge\(\)/);
});

test("仍在观察那几层写清了只观察", () => {
  assert.match(source, /B 关系轴：只观察，不制造伤口或关系转折/);
  // v64.65：C 那一行加了后半句。它自己照旧什么都不拦，但【他做的梦靠它算作息】——
  // 不写这一句，下一个人还是会把它当死代码删掉，然后连 D 一起停（v64.34 就是这么出的事）。
  assert.match(source, /C 睡眠意识：只算 TA 几点睡几点醒，不拦消息、不代替 TA 发言/);
  assert.match(source, /他做的梦」靠它才知道该在哪一夜做/);
});
