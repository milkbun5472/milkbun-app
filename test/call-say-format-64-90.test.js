// 「还有格式会掉」（她 2026-09-06，视频通话那张截图）：
// 顶上冒出一行孤零零带右括号的字，最后那个气泡里动作描写和台词糊成一句。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");

// 照真函数跑，不照我以为的样子重写一遍（stub-from-the-writer）
const stripName = s => String(s || "").replace(/^\s*[^\s:：]{1,14}[:：]\s*/, "").trim();
const body = app.slice(app.indexOf("const splitSayLine = str => {"), app.indexOf("const pushMsg = line =>"));
const splitSayLine = new Function("stripName", "return " + body.replace(/^const splitSayLine = /, "").replace(/;\s*$/, ""))(stripName);

test("成对括号照旧：括号里是动作，括号外是话", () => {
  assert.deepEqual(splitSayLine("（他抬手抓头发，耳朵上的红晕还没褪下去）你就是故意的。"),
    [{ act: "他抬手抓头发，耳朵上的红晕还没褪下去" }, { speech: "你就是故意的。" }]);
});

test("落单的右括号：前面是动作的尾巴，后面才是话", () => {
  // 她截图顶上那一行就是这么来的——模型把动作断在两个 say 元素里
  assert.deepEqual(splitSayLine("耳朵上的红晕还没褪下去）你就是故意的。"),
    [{ act: "耳朵上的红晕还没褪下去" }, { speech: "你就是故意的。" }]);
  // 界面上绝不许再冒出孤零零的括号字符
  splitSayLine("耳朵上的红晕还没褪下去）你就是故意的。").forEach(x =>
    assert.ok(!/[（()）]/.test(x.act || x.speech), "残渣括号漏出去了"));
});

test("落单的左括号：后面全是动作", () => {
  assert.deepEqual(splitSayLine("（他抬手抓头发，"), [{ act: "他抬手抓头发，" }]);
  assert.deepEqual(splitSayLine("你就是故意的。（他抬手抓头发"),
    [{ speech: "你就是故意的。" }, { act: "他抬手抓头发" }]);
});

test("上限从 60 抬到 120——两个分句就过 60", () => {
  const long = "他把下巴搁在桌面上凑近摄像头，睁大眼睛看着你，嘴角带着笑，整个人像只赖在门口不肯走的大狗，尾巴摇得起劲，眼睛一眨不眨地盯着屏幕，连呼吸都放轻了些，像是怕一出声你就把电话挂了";
  assert.ok(long.length > 60, "样例得真的超过 60 才验得出来");
  assert.deepEqual(splitSayLine("（" + long + "）耍赖是吧？"), [{ act: long }, { speech: "耍赖是吧？" }]);
  assert.match(app, /\[（\(\]\(\[\^（）\(\)\]\{1,120\}\)\[）\)\]/, "上限没抬");
});

test("正常台词一个字都不许被切", () => {
  ["行，看不见是吧，那晚上当面亲。", "我可没同意你过来", "你家里零食还有没有？"].forEach(x =>
    assert.deepEqual(splitSayLine(x), [{ speech: x }], "好好的台词被切了：" + x));
});

test("不打括号那一半只能靠提示词——那句话得说死", () => {
  // 代码认不出「动作和台词糊成一句、一个括号都没有」的那种，所以契约那句必须硬
  assert.match(app, /\*\*say 的每一条都必须是你【能原样念出口的话】\*\*/, "契约那句还是软的");
  assert.match(app, /这一条念出来对方在电话里听得见吗？听不见就不是台词/, "少了可执行的判据");
  // ⚠️不许写成「不要旁白（不过…）」那种形状（no-yes-unless）
  assert.ok(app.indexOf("say 里只放你说出口的话，不要加名字前缀、不要旁白、不要括号") < 0, "老那句还留着");
});
