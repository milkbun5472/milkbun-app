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

test("E 只有角色 gate 真开且未紧急关闭才显示为已开启", () => {
  assert.match(source, /eGate\.mode === "pilot" && !eGate\.emergencyOff/);
  assert.match(source, /余温 · 已开启/);
  assert.match(source, /不会冒充经历、不会写进记忆/);
});

test("积温说明不冒充普通回复的人格控制器", () => {
  assert.match(source, /积温 · 已开启/);
  assert.match(source, /只影响 TA 什么时候主动来找你/);
  assert.match(source, /不会改普通聊天回复/);
  assert.match(source, /想靠近 .*傲娇 .*心情 /);
});

test("未开闸的 A B C 均写清只观察", () => {
  assert.match(source, /A 情绪立体化：只观察，不影响语气/);
  assert.match(source, /B 关系轴：只观察，不制造伤口或关系转折/);
  assert.match(source, /C 睡眠意识：只计算作息，不拦消息、不代替 TA 发言/);
});
