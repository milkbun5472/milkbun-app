// 她开的吧跟自带的六个吧平起平坐（她 2026-10-25）：不劝退（「对得上才去」），也不硬掷（「不应该为了让他写在我的吧而强迫改原本要写的吧」）
const test = require("node:test"), assert = require("node:assert/strict");
const app = require("node:fs").readFileSync(require("node:path").join(__dirname, "../js/app.js"), "utf8");
test("她开的吧列在同一排里，写什么去哪儿由他挑", () => {
  assert.match(app, /发在哪个吧：吐槽\/日常\/求助\/兴趣\/脑洞\/匿名" \+ myBoardsForPost\.map\(b => "\/" \+ b\.name\)\.join\(""\) \+ "，你这条写的是什么就去哪儿/);
  assert.match(app, /【这几个吧各聊什么】/);
  assert.doesNotMatch(app, /只有你这条内容本来就属于那个吧才去/);
  assert.doesNotMatch(app, /fixedBoard = myBoardsForPost\[Math\.floor/);
});
