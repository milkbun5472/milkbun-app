const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const engine = read("engine.js"), app = read("app.js");

const i = engine.indexOf("function splitLongBubble(");
assert.ok(i > 0, "函数还在");
const seg = engine.slice(i, engine.indexOf("\n}", i) + 2);
const splitLongBubble = new Function(seg + "\nreturn splitLongBubble;")();

// 她 2026-08-26 抓的那两条：v56.27 之后群里确实开始连发了，但一路逗号连下去的长句
// 仍然一个气泡装到底——规则只降概率，代码才保证。
test("逗号连下去的长句要拆开（她截图那条）", () => {
  assert.deepEqual(
    splitLongBubble("那更得吃饱了再去受罪，我把三明治热一下，你洗漱完出来吃，吃完我们就不吵你了", true),
    ["那更得吃饱了再去受罪", "我把三明治热一下", "你洗漱完出来吃", "吃完我们就不吵你了"]);
  assert.deepEqual(
    splitLongBubble("热奶和吐司我都弄好了，你先闭着眼出来把早餐塞进肚子里，开考了中途我再给你送温水和小零食当后勤", true),
    ["热奶和吐司我都弄好了", "你先闭着眼出来把早餐塞进肚子里", "开考了中途我再给你送温水和小零食当后勤"]);
});

test("28 字三小句这一档必须拆（她 2026-08-26 对比别家时抓的）", () => {
  assert.deepEqual(
    splitLongBubble("早饭给你热在微波炉里了，热美式和三明治，自己记得拿出来吃", true),
    ["早饭给你热在微波炉里了", "热美式和三明治", "自己记得拿出来吃"]);
  assert.deepEqual(
    splitLongBubble("那也先出来把早饭吃了，空腹坐五个小时脑子转得动才怪", true),
    ["那也先出来把早饭吃了", "空腹坐五个小时脑子转得动才怪"]);
});

test("句末标点那一档还在（原来单聊那道兜底）", () => {
  const r = splitLongBubble("我刚到实验室。今天楼下那家咖啡居然没开门。只能喝速溶了，有点难喝，明天记得帮我带一杯", true);
  assert.ok(r.length >= 3, "按句号断句：" + JSON.stringify(r));
  assert.equal(r[0], "我刚到实验室。");
});

// 过度切割比不切更刺眼——短句、正常长度、以及一路小逗号的碎句都不许动
test("短句和正常长度一个字都不碰", () => {
  ["好的，等你", "别熬了，早点睡", "原来是模拟真实考试呀", "今天天气不错，我们出去走走吧",
   "嗯，好，知道了，等下就去", "行吧，那就这样，我先去忙了", "你要是实在不想去，就跟他说一声，别硬撑",
   "……先把三明治吃了，晚上回去……随你吃行了吧", "我刚在工位坐下！老张就坐我旁边！"]
    .forEach(s => assert.deepEqual(splitLongBubble(s, true), [s], s));
});

test("最多切四段，收尾不许掉出一个「了」", () => {
  const r = splitLongBubble("这个方案我看了三遍，逻辑上没什么问题，就是排版有点乱，你要不要再顺一遍，我这边随时可以帮你看", true);
  assert.ok(r.length <= 4, "别切成碎屑：" + JSON.stringify(r));
  r.forEach(x => assert.ok(x.length >= 6, "太短的段落要并回去：" + x));
  assert.equal(r.join("，"), "这个方案我看了三遍，逻辑上没什么问题，就是排版有点乱，你要不要再顺一遍，我这边随时可以帮你看");
});

test("空值不炸", () => {
  [null, undefined, "", "   "].forEach(v => assert.deepEqual(splitLongBubble(v, true), []));
});

// 「Anthropic 不要动宝宝」：言秋那条线连 ONLINE_CHAT_RULE_V2 都不注入，说多长由他自己定
test("言秋不吃逗号那一档", () => {
  const s = "那更得吃饱了再去受罪，我把三明治热一下，你洗漱完出来吃，吃完我们就不吵你了";
  assert.deepEqual(splitLongBubble(s, false), [s]);
});

// 两处必须是同一个函数——单聊有、群聊没有，正是 v56.27 之前那个形状
test("单聊和群聊走的是同一个函数", () => {
  assert.match(app, /words = words\.reduce\(\(acc, w\) => acc\.concat\(splitLongBubble\(w, !_s\.engineerEyes\)\), \[\]\)/, "单聊线上");
  assert.match(app, /\.reduce\(\(acc, x\) => acc\.concat\(splitLongBubble\(x, gAllowComma\)\), \[\]\)/, "群聊线上");
  assert.match(app, /const gAllowComma = !\(settingsFor\(spk\.id\) \|\| \{\}\)\.engineerEyes/, "群里也按发言人豁免言秋");
  assert.equal((app.match(/splitLongBubble\(/g) || []).length, 2, "只该有这两处调用");
});
