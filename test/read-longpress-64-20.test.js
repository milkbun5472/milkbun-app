// 「一起读长按封面删不了」（她 2026-09-06）。
// 病因：那儿只挂了 onContextMenu。桌面右键会发它，**iOS 长按一个 <button> 不发这个事件**
// ——弹的是系统自己那个选择/预览菜单。于是「长按封面可移除」这行字从上线起就是空话，
// 而且不报任何错（跟 stub-from-the-writer 那一课同一种：没有异常、没有红字）。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const read = fs.readFileSync(__dirname + "/../js/read.js", "utf8");
const dream = fs.readFileSync(__dirname + "/../js/dream.js", "utf8");

test("自己计时判长按，别只靠 contextmenu", () => {
  assert.match(read, /const lpTimer = useRef\(null\), lpFired = useRef\(false\);/, "没有那两个 ref");
  assert.match(read, /onTouchStart: function \(\) \{ startLP\(b\); \}, onTouchEnd: cancelLP, onTouchMove: cancelLP, onTouchCancel: cancelLP,/,
    "手指那条链没接全——移开/被打断了还会照删");
  assert.match(read, /lpTimer\.current = setTimeout\(function \(\) \{ lpFired\.current = true; askDrop\(b\); \}, 550\);/, "计时没了");
  // 桌面右键那条留着，两条各管各的
  assert.match(read, /onContextMenu: function \(e\) \{ e\.preventDefault\(\); askDrop\(b\); \}/, "桌面右键那条丢了");
  // 550 跟梦境/塔罗那两处一样：同一个手势在这个 app 里手感必须一致
  assert.ok(dream.indexOf("}, 550);") > 0, "参照的那一处变了，这儿也该跟着对一遍");
});

test("长按之后松手别把书打开", () => {
  assert.match(read, /onClick: function \(\) \{ if \(lpFired\.current\) \{ lpFired\.current = false; return; \} setOpenId\(b\.id\); \}/,
    "弹完确认框松手那一下又把书点开了");
});

test("iOS 自己那套长按行为要关掉", () => {
  // 不关的话系统的选择/预览菜单会盖在确认框前面
  assert.match(read, /WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none"/, "系统菜单会抢在前面");
});

test("确认框那句话只写一处", () => {
  assert.match(read, /const askDrop = function \(b\) \{/, "没抽出来");
  assert.equal((read.match(/从书架移除《/g) || []).length, 1, "两条路各写了一份提示——改一处另一处永远落单");
});
