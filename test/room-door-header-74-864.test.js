// 编辑房间那一页也要有「这扇门带进带出什么」（她 2026-10-05 拿两张图对出来的）
//
// 她问「为啥她的房间这三块和我的不一样」——查下来不是版本差，是两支不同的表：
//   · 建房那一支有这个标题压着三组开关（2026-09-17 她说「不能创建的时候就能设置
//     房间权限吗」之后加的）
//   · 编辑已有房间那一支没有，三排开关光秃秃列着，没人告诉你它们合起来是干嘛的
// 补的是标题和那句说明，开关本身还是同一个 group()，没有第二份。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const comp = fs.readFileSync("js/components.js", "utf8");
const live = comp.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

test("① 两支都有这个标题", () => {
  // 建房那支写死这一句，编辑那支按 draft.main 分两种说法——所以一共两处
  assert.equal((live.match(/"这扇门带进带出什么"/g) || []).length, 2, "两支里有一支没有这个标题");
  assert.match(live, /h\("div", \{ style: \{ fontFamily: F_DISPLAY, fontSize: 14, color: t\.ink \} \}, "这扇门带进带出什么"\)/,
    "建房那支的标题没了");
  assert.match(live, /draft\.main \? "主聊天记得什么、写回什么" : "这扇门带进带出什么"/,
    "编辑那支没补上标题");
});

test("② 主聊天换个说法：它没有门，也没有「带出去」这回事", () => {
  const i = live.indexOf('draft.main ? "主聊天记得什么、写回什么"');
  const seg = live.slice(i, i + 420);
  assert.match(seg, /你平时坐的那间/, "主聊天那支的说明没换，会被当成一间侧房");
  assert.match(seg, /doorLine\(draft\)/, "侧房那句还是走公共的 doorLine，没另写一份");
});

test("③ 开关本身没被复制成第二份", () => {
  // cognition / writeback 两支都在两处各出现一次（建房一次、编辑一次），不许更多
  assert.equal((live.match(/group\("cognition",/g) || []).length, 2, "cognition 这组被抄多了");
  assert.equal((live.match(/group\("writeback",/g) || []).length, 2, "writeback 这组被抄多了");
  assert.equal((live.match(/group\("actions",/g) || []).length, 2, "actions 这组被抄多了");
});

test("④ 只多了一个标题块，开关的闸一个没动", () => {
  assert.match(live, /!draft\.main && group\("actions",/, "主聊天不该有「能张罗什么」这组，闸被动了");
});
