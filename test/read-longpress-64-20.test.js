// 「一起读长按封面删不了」（她 2026-09-06）。
// 病因：那儿只挂了 onContextMenu。桌面右键会发它，**iOS 长按一个 <button> 不发这个事件**
// ——弹的是系统自己那个选择/预览菜单。于是「长按封面可移除」这行字从上线起就是空话，
// 而且不报任何错（跟 stub-from-the-writer 那一课同一种：没有异常、没有红字）。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const read = fs.readFileSync(__dirname + "/../js/read.js", "utf8");
const components = fs.readFileSync(__dirname + "/../js/components.js", "utf8");

// ⚠️v72.08 起不再有 read.js 自己那一份：全库长按只剩 components.js 的 useLongPressMenu
//   （气泡菜单本来就在用它，而且比这儿原来那套稳——认「手指动了就不算」、滚动能掐掉、
//   还会把抬手那一下的误点吞掉）。开了公共的就把已有的搬过去，不许并存两套。
test("长按走全库那一份，read.js 不留第二套", () => {
  assert.ok(!/function useLongPress\(\)/.test(read), "read.js 里又长出自己那一份了");
  assert.match(components, /function useLongPressMenu\(onFire\) \{/, "公共那一份没了");
  // 三处都接上了：书架封面、正文页上那两张卡、批注册每一行
  // ⚠️v72.56：这一行原来写的是 useLongPressMenu(askDrop) ——裸名字在渲染那一刻就求值，
  //   而 askDrop 是几十行之后才 const 出来的：TDZ 当场抛、整页白屏（读者 2026-09-22 报的
  //   「点开一起读界面是这个」）。必须包一层，跟批注册那一处同形。
  assert.match(read, /const \{ startPress, endPress \} = useLongPressMenu\(function \(b\) \{ askDrop\(b\); \}\);/, "书架没接上");
  assert.match(read, /const pagePressProps = function \(fire\)/, "正文页那两张卡没接上");
  assert.match(read, /useLongPressMenu\(function \(r\) \{ askDropRow\(r\); \}\)/, "批注册那一行没接上");
  // 桌面右键是另一条路：iOS 长按 <button> 压根不发 contextmenu，两条各管各的
  assert.match(read, /onContextMenu: function \(e\) \{ e\.preventDefault\(\); askDrop\(b\); \}/, "桌面右键那条丢了");
  // 550 那个数现在住在公共那一份里，跟梦境/塔罗对齐这件事由它自己守
  assert.match(components, /const LONG_PRESS_MS = \d+;/, "长按时长那个数没了");
});

test("iOS 自己那套长按行为要关掉", () => {
  // 不关的话系统的选择/预览菜单会盖在确认框前面
  assert.match(read, /WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none"/, "系统菜单会抢在前面");
});

test("确认框那句话只写一处", () => {
  assert.match(read, /const askDrop = function \(b\) \{/, "没抽出来");
  assert.equal((read.match(/从书架移除《/g) || []).length, 1, "两条路各写了一份提示——改一处另一处永远落单");
});
