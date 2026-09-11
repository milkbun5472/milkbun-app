const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");

const i = engine.indexOf("function splitLongBubble(");
assert.ok(i > 0, "函数还在");
const seg = engine.slice(i, engine.indexOf("\n}", i) + 2);
const helpers = engine.slice(engine.indexOf("const BUBBLE_NUMSEP"), i);
const splitLongBubble = new Function(helpers + seg + "\nreturn splitLongBubble;")();

// 她 2026-09-11 截图：一句话里带着一段引文，结果引文被从中间切开——
// 「还是教你'两个人影坐得近」 +「几乎叠成一块'该怎么在纸上写得更隐晦点？」，
// 半个引号吊在上一个气泡屁股上、另半个吊在下一个气泡脑门上。
test("引号里的逗号不是句子边界（她 2026-09-11 截图那条）", () => {
  const s = "还是教你'两个人影坐得近，几乎叠成一块'该怎么在纸上写得更隐晦点？";
  assert.deepEqual(splitLongBubble(s, true), [s]);
});

test("六种成对引号都护得住", () => {
  [["「", "」"], ["『", "』"], ["“", "”"], ["‘", "’"], ["'", "'"], ['"', '"']]
    .forEach(([a, b]) => {
      const s = "他昨天说了句" + a + "我明天就走，你别送了" + b + "就再也没消息了";
      assert.deepEqual(splitLongBubble(s, true), [s], a + b);
    });
});

test("引号里的句末标点也不是句子边界", () => {
  const s = "他喊了一声「站住！你给我站住」然后整条街的人都回头看过来了";
  assert.deepEqual(splitLongBubble(s, true), [s]);
  // engineerEyes 那一路（不拆逗号）同样不许在引号里断句
  const t = "他说「走吧。别等了」我就跟着走了一路上谁也没说话";
  assert.deepEqual(splitLongBubble(t, false), [t]);
});

// 引号是不想被【切断】，不是不想被切：外面裸露的标点照拆
test("引号外面的标点照拆，引文整块留在一个气泡里", () => {
  assert.deepEqual(
    splitLongBubble("他说「我明天就走，你别送了」，然后就挂了电话没再回头", true),
    ["他说「我明天就走，你别送了」", "然后就挂了电话没再回头"]);
  assert.deepEqual(
    splitLongBubble("他喊了一声『站住！别跑』，我吓得手里的东西都掉了", true),
    ["他喊了一声『站住！别跑』", "我吓得手里的东西都掉了"]);
});

// 英文直引号没有左右之分，don't / it's 里的撇号不能被当成开引号
// ——否则从 don 那个撇号一路圈到 it 那个撇号，中间那个真逗号就被吞掉了
test("英文撇号不是引号", () => {
  assert.deepEqual(
    splitLongBubble("I don't know, it's fine, 你自己看着办吧别问我了", true),
    ["I don't know", "it's fine", "你自己看着办吧别问我了"]);
});

// 前后两道守卫各管一头，少哪一道都会被词里的撇号骗过去：
// 前面那道管【开引号前面不是字母数字】——don't 的撇号配上 boys' 的撇号，
// 后一个正好落在词尾、后面是空格，只靠后面那道守卫拦不住。
test("撇号开头这一道守卫：don't 配 boys' 不算一对引号", () => {
  assert.deepEqual(
    splitLongBubble("I don't know, the boys' 说法很怪，你自己看着办吧别问我了", true),
    ["I don't know", "the boys' 说法很怪", "你自己看着办吧别问我了"]);
});

// 后面那道管【收引号后面不是字母数字】——一个真的开引号配上 it's 里的撇号，
// 开引号前面是空格，只靠前面那道守卫拦不住。
test("撇号结尾这一道守卫：真开引号配 it's 不算一对引号", () => {
  assert.deepEqual(
    splitLongBubble("他说 '别去了，真的，it's fine 你听我的就行了", true),
    ["他说 '别去了", "真的，it's fine 你听我的就行了"]);
});

// 落单的引号不许把后面整段都圈进去
test("只有半边的引号圈不住后面整段话", () => {
  const s = "他说「你要是真不想去就别去了，我一个人过去也一样没关系，你在家好好睡一觉比什么都强";
  const r = splitLongBubble(s, true);
  assert.ok(r.length > 1, "一个落单的开引号不该让整段话都不拆：" + JSON.stringify(r));
});

// 真有超长引文时还是让它照常拆，否则会甩出一个巨大的气泡。
// 六种引号每一种都得有这个上限——少给哪一种加，那一种就能圈住整段话。
test("超过 60 字的引文不再当引文护着（六种都要有上限）", () => {
  const long = "你要是真不想去就别去了，我一个人过去也一样没关系，反正那边也没什么熟人在，" +
    "我自己坐一会儿就回来，你在家好好睡一觉比什么都强，真的别硬撑着陪我了行不行";
  const fit = "你要是真不想去就别去了，我一个人过去也一样没关系，你在家睡一觉比什么都强";
  assert.ok(long.length > 60 && fit.length <= 60, "两个样本得分别在上限两边");
  [["「", "」"], ["『", "』"], ["“", "”"], ["‘", "’"], ["'", "'"], ['"', '"']]
    .forEach(([a, b]) => {
      const r = splitLongBubble("他说 " + a + long + b, true);
      assert.ok(r.length > 1, a + b + "：超长引文该照常拆，别甩出一个巨大的气泡：" + JSON.stringify(r));
      // 刚好在上限之内的那一档还是要护住
      const s2 = "他说 " + a + fit + b;
      assert.deepEqual(splitLongBubble(s2, true), [s2], a + b + "：60 字之内还得护住");
    });
});

test("哨兵一个都不许漏进正文", () => {
  const bad = /[\u0001\ue000-\ue00f]/;
  ["还是教你'两个人影坐得近，几乎叠成一块'该怎么在纸上写得更隐晦点？",
    "他说「我明天就走，你别送了」，然后就挂了电话没再回头",
    "现在现值是 150,000 乘以 0.312，也就是 46,800",
    "他喊了一声『站住！你给我站住』然后整条街的人都回头看过来了",
    "I don't know, it's fine, 你自己看着办吧别问我了",
    "没有引号也没有数字的一句话"].forEach(s => {
      [true, false].forEach(ac => splitLongBubble(s, ac).forEach(y =>
        assert.ok(!bad.test(y), "哨兵漏进正文了：" + JSON.stringify(y))));
    });
});

// 还原的是【原来那个字符】，不像千分位那样一律还原成半角逗号
test("引号里的标点原样还原，全角不许变半角", () => {
  assert.equal(
    splitLongBubble("他说「我明天就走，你别送了」，然后就挂了电话没再回头", true).join(""),
    "他说「我明天就走，你别送了」然后就挂了电话没再回头");
  assert.equal(
    splitLongBubble("他喊了一声『站住！别跑』，我吓得手里的东西都掉了", true)[0],
    "他喊了一声『站住！别跑』");
  // 半角的那几个也得还是半角
  const s = "他说「真的?我不信!别骗我」，我当时就站在旁边一个字都没漏";
  assert.equal(splitLongBubble(s, true)[0], "他说「真的?我不信!别骗我」");
});

// 「一层写在两处」：护引号这一道必须在 splitLongBubble 入口上，
// 不能只在某一条调用线上补——单聊群聊走的是同一个函数
test("护引号写在函数入口，两个出口都还原", () => {
  assert.match(seg, /bubbleProtectQuote\(bubbleProtectNum\(/, "入口上先护数字再护引号");
  assert.equal((seg.match(/\.map\(bubbleRestore\)/g) || []).length, 2, "两个出口都要还原");
});
