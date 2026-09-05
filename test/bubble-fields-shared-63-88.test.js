// 「气泡这里每个人都可以搞设置里那些」（她 2026-09-05）：
// 单聊里原来只有六颗预设丸子，设置里那一整排细调字段够不着。
// 改法照 BubbleSkinPresets 那次：字段那一排抽成一个组件，一处画、两处用——
// 各写一份的话，加一个新字段就只会加在其中一处（「一层写在两处，第二处没跟上」）。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");

test("字段那一排只画在一处", () => {
  assert.match(comp, /function BubbleSkinFields\(\{ s, set \}\)/, "共用组件没了");
  // 设置那一页不许再自己写一份
  assert.ok(scr.indexOf('row("我的气泡底色（可渐变）"') < 0, "设置里又抄了一份字段——改一处另一处永远落单");
  assert.ok(scr.indexOf("试衣镜：TA 的气泡") < 0, "设置里又抄了一份试衣镜");
  assert.match(scr, /h\(BubbleSkinFields, \{ s: s, set: set \}\)/, "设置那一页没接上共用的那一份");
});

test("每个字段两处都在（就是同一份，所以只数一次）", () => {
  const i = comp.indexOf("function BubbleSkinFields(");
  const body = comp.slice(i, comp.indexOf("\nconst BUBBLE_SKIN_DEFAULTS", i));
  ["myBg", "charBg", "radius", "myText", "myBorder", "mySticker",
   "charText", "charBorder", "charSticker", "shadow", "chatBg", "stickerSize"].forEach(k =>
    assert.ok(body.indexOf('"' + k + '"') > 0, "少了这一栏：" + k));
});

test("单聊那格：预设之外还能一栏栏改，而且退得回去", () => {
  assert.match(comp, /h\(BubbleSkinFields, \{ s: Object\.assign\(\{\}, BUBBLE_SKIN, bubble \|\| \{\}\), set: tuneBubble \}\)/,
    "单聊没接上，或者不是在【当前真在显示的那一套】上改");
  // 改一栏＝把全局那份铺开再盖，别只存孤零零一栏
  assert.match(comp, /const tuneBubble = patch => setBubble\(p => Object\.assign\(\{\}, BUBBLE_SKIN, p \|\| \{\}, patch, \{ _tuned: true \}\)\);/,
    "细调没把全局那份铺开当底");
  assert.match(comp, /onClick: \(\) => setBubble\(null\)[\s\S]{0,320}"清掉，跟随全局"/, "细调之后退不回跟随全局");
});
