// 「一起读长按封面删不了」（她 2026-09-06）。
// 病因：那儿只挂了 onContextMenu。桌面右键会发它，**iOS 长按一个 <button> 不发这个事件**
// ——弹的是系统自己那个选择/预览菜单。于是「长按封面可移除」这行字从上线起就是空话，
// 而且不报任何错（跟 stub-from-the-writer 那一课同一种：没有异常、没有红字）。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const read = fs.readFileSync(__dirname + "/../js/read.js", "utf8");
const dream = fs.readFileSync(__dirname + "/../js/dream.js", "utf8");

// ⚠️v72.01 起这一套是【公共的】：批注也要长按删，形状出现第二处就抽出来，
//   书架那份也搬了过去（施工规则/one-public-mechanism.md）。所以这儿改钉公共那一份。
test("自己计时判长按，别只靠 contextmenu", () => {
  const i = read.indexOf("function useLongPress()");
  assert.ok(i > 0, "公共那一份没了——长按这套又被各写一遍了");
  const lp = read.slice(i, read.indexOf("\n  }", i));
  assert.match(lp, /const timer = useRef\(null\), fired = useRef\(false\);/, "没有那两个 ref");
  assert.match(lp, /onTouchStart: function \(\) \{ start\(fire\); \}, onTouchEnd: cancel, onTouchMove: cancel, onTouchCancel: cancel,/,
    "手指那条链没接全——移开/被打断了还会照删");
  assert.match(lp, /timer\.current = setTimeout\(function \(\) \{ fired\.current = true; fire\(\); \}, 550\);/, "计时没了");
  // 桌面右键那条留着，两条各管各的
  assert.match(lp, /onContextMenu: function \(e\) \{ e\.preventDefault\(\); fire\(\); \}/, "桌面右键那条丢了");
  // 550 跟梦境/塔罗那两处一样：同一个手势在这个 app 里手感必须一致
  assert.ok(dream.indexOf("}, 550);") > 0, "参照的那一处变了，这儿也该跟着对一遍");
  // ⚠️列表里每行各调一次 hook＝hook 数量跟着条数变，React 会炸；所以是 bind 那一行的动作
  assert.match(lp, /bind: function \(fire\)/, "改回按行调 hook 的话，翻一页就白屏");
});

test("长按之后松手别把书打开", () => {
  assert.match(read, /tap: function \(onTap\) \{ return function \(\) \{ if \(fired\.current\) \{ fired\.current = false; return; \} onTap && onTap\(\); \}; \}/,
    "弹完确认框松手那一下又把书点开了");
  assert.match(read, /onClick: lp\.tap\(function \(\) \{ setOpenId\(b\.id\); \}\)/, "书架没走公共那一份");
});

test("iOS 自己那套长按行为要关掉", () => {
  // 不关的话系统的选择/预览菜单会盖在确认框前面
  assert.match(read, /WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none"/, "系统菜单会抢在前面");
});

test("确认框那句话只写一处", () => {
  assert.match(read, /const askDrop = function \(b\) \{/, "没抽出来");
  assert.equal((read.match(/从书架移除《/g) || []).length, 1, "两条路各写了一份提示——改一处另一处永远落单");
});
