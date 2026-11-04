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
  const i = comp.indexOf("TA 回你时会往回读这么多条聊天");   // 2026-10-31 改了说明（拉条说了算、最少 80）
  assert.ok(i > 0, "说明文案没了");
  const near = comp.slice(i, i + 400);
  assert.match(near, /max: 1000/, "滑杆封在 300 的话，本机留的一千条有七百条永远进不去");
});

// 原来这儿钉的是「短期窗那块地板也跟着抬到 1000」。2026-11-04 那块地板整个收回了：
// 它不看拉条、自己就能把一轮撑到 1000 条／26 万字（群友一次对话 20 万 token）。
// 本机留一千条是【翻得到】，不是【每轮都发出去】；往回读多远由拉条明码标价。
test("往回读多远只由拉条说了算，没有第二条暗地里撑额度的路", () => {
  assert.ok(!/const FLOOR_MAX/.test(app), "按天那块免检地板又回来了");
  assert.match(app, /const onlineWindow = online\.slice\(-ctxN\);/);
});

test("滑杆底下必须说清它是硬闸，别再让人以为归档会自己进来", () => {
  const i = comp.indexOf("TA 回你时会往回读这么多条聊天");
  const near = comp.slice(i, i + 300);
  assert.match(near, /只在归档里供你翻看/);
});
