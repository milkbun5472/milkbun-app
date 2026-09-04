// v61.79 她连报三轮「还是没有喂归档的」。前三轮我都在修【本机手上有没有】那一层
// （记忆行、x_chatArch 计数簿、把归档尾巴铺回本地），一层比一层深，但都不是病根。
//
// 真正的闸是 ctxN ——【AI 回复时能记住多少条】。它是硬闸：
//   const ctxN = Math.max(0, Number(settingsFor(char.id).ctxN ?? 50));
//   online.slice(-ctxN)
// 本机存着一千条也好、云端归档着一万条也好，超出这个数的一句都不会进上下文。
// 她那台是默认的 50，所以我铺回去多少条都白搭。
//
// 教训：**「他收不到」有两层，先问是哪一层**——手上没有，还是手上有但闸只开了 50。
// 我一路修的是第一层，而她三次说的都是第二层。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");

const app = fs.readFileSync("js/app.js", "utf8");
const comp = fs.readFileSync("js/components.js", "utf8");

test("ctxN 的上限跟本机保留线对齐，不然多留的那些够不着", () => {
  assert.match(app, /const CHAT_KEEP_LOCAL = 1000;/);
  // 单聊那根滑杆
  const i = comp.indexOf("AI 回复时真正读到的就是这些条");
  assert.ok(i > 0, "说明文案没了——那句话得挑明它是硬闸");
  const near = comp.slice(i, i + 400);
  assert.match(near, /max: 1000/, "滑杆封在 300 的话，本机留的一千条有七百条永远进不去");
});

test("短期窗那块地板也跟着抬，不然拉条到不了它说的天数", () => {
  assert.match(app, /const FLOOR_MAX = 1000;/);
});

test("滑杆底下必须说清它是硬闸，别再让人以为归档会自己进来", () => {
  const i = comp.indexOf("AI 回复时真正读到的就是这些条");
  const near = comp.slice(i, i + 300);
  assert.match(near, /归档只供你翻看/);
});
