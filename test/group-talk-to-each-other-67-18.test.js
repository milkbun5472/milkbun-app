// 她 2026-09-11：「群里还是我说话他们就不互相接话了，而且有我的群还是一句一个动作」
//
// 两句话一个病根：【记忆互通】那一段里 action 的说法，跟 gActionField 里那一份
// 正好反着——「每次随情境更新、别照抄上一动作」。互通正是「有我的群」的常态，
// 于是每一条都要换一个新动作：代码那道「没变就别刷屏」的闸（比字符串相等）拦不住，
// 一句一个动作；模型还得为每条现编一个动作，索性一人只说一句，就不互相接话了。
// 另一半在于「接彼此的话」这句只长在【她没出声】那条分支上。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js"), engine = R("js/engine.js");
// 注释里的病历不能被断言当成代码
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const A = strip(app), E = strip(engine);

// ── action 那一格的说法只许有一份 ────────────────────────────────
test("action 的说法只有一处，两个字段都从那儿取", () => {
  assert.equal((A.match(/const G_ACTION_SPEC = /g) || []).length, 1, "只许定义一处");
  assert.equal((A.match(/G_ACTION_SPEC/g) || []).length, 3, "一处定义、两处取用");
  assert.match(A, /action 就是" \+ G_ACTION_SPEC \+ "/, "【心声与心情】那一段要从这儿取");
  assert.match(A, /gActionField = ",\\"action\\":\\"" \+ G_ACTION_SPEC/, "JSON 字段也从这儿取");
});

test("反着说的那一句不许再长回来", () => {
  assert.ok(A.indexOf("每次随情境更新") < 0, "「每次随情境更新」是这次的病根，不许再出现");
  assert.ok(A.indexOf("别照抄上一动作") < 0, "「别照抄上一动作」跟「没变就原样填写」正面打架");
  const i = A.indexOf("const G_ACTION_SPEC");
  const spec = A.slice(i, A.indexOf("\n", i));
  // v67.26：定义那半句搬进了 engine.js 的 ACT_MEANING，这一行只剩尾巴
  const _eng = require("fs").readFileSync(require("path").resolve(__dirname, "..", "js/engine.js"), "utf8");
  assert.match(spec, /ACT_MEANING \+ /, "得从那一份取，不许自己再写一份");
  assert.match((_eng.match(/const ACT_MEANING = "([^"]+)";/) || [])[1] || "", /原样填写/, "说的得是「没变就原样填写」");
  assert.match(spec, /不必每条都换/, "连发好几条不必每条都换一个新的");
});

// ── 「接彼此的话」这一层，两条分支都得有 ──────────────────────────
test("她开口的那一轮，也要有人叫他们互相接话", () => {
  assert.match(A, /if \(tail\.length && !gs\.spectate && !asPrivate\) userContent \+=/, "她开口那一条分支上要有这一层");
  const i = A.indexOf("if (tail.length && !gs.spectate && !asPrivate) userContent +=");
  const blk = A.slice(i, i + 900);
  assert.match(blk, /不是点名提问/, "得说清她说一句不等于点名提问");
  assert.match(blk, /不是每个人都得答一句/);
  assert.match(blk, /至少要有一条是说给另一个成员听的/, "这一轮至少有一条是成员对成员");
  assert.match(blk, /客服轮班/, "得把「每人对她表态一轮」那个形状点破");
  assert.match(blk, /G_EACH_OTHER/, "跟她没出声那一轮共用同一句");
});

test("「接彼此的话」这句只许有一份，两条分支都从那儿取", () => {
  assert.equal((A.match(/const G_EACH_OTHER = /g) || []).length, 1, "只许定义一处");
  assert.equal((A.match(/G_EACH_OTHER/g) || []).length, 3, "一处定义、两条分支各取一次");
  const i = A.indexOf("const G_EACH_OTHER");
  const line = A.slice(i, A.indexOf("\n", i));
  assert.match(line, /接彼此的话/);
  assert.ok(A.indexOf('"接彼此的话、动手做下去、互相拌嘴都行"') < 0, "她没出声那一轮里写死的那份要撤掉");
});

test("旁观群和她旁观的两人私聊不发这一段（她本来就不在场）", () => {
  const i = A.indexOf("if (tail.length && !gs.spectate && !asPrivate)");
  assert.ok(i > 0);
  // 这两种里 dir 早就写着别围着她转——她不在场，「她说了话」这个前提不成立
  assert.match(A, /别默认围着用户转、别一开口就聊用户的事/, "她旁观两人私聊那条照旧");
  assert.match(A, /让成员们围绕旁白与彼此的关系自然互动/, "旁观群那条照旧");
});

// ── 那道闸写在代码里，就得真拦得住 ──────────────────────────────
test("「没变就别刷屏」那道闸不再被换个标点骗过去", () => {
  assert.match(E, /function sameActLine\(a, b\)/, "闸抽成了公共的一份");
  assert.equal((A.match(/sameActLine\(/g) || []).length, 2, "单聊和群聊两处都走它");
  assert.ok(A.indexOf("if (_line !== _prevAct)") < 0, "单聊那处的裸比较要撤掉");
  assert.ok(A.indexOf("if (gActionNow !== _gprevAct)") < 0, "群聊那处的裸比较要撤掉");
});

test("sameActLine：换标点换语气字算同一句，真换了事不算", () => {
  const i = engine.indexOf("const ACT_TAIL");
  const seg = engine.slice(i, engine.indexOf("\n}", engine.indexOf("function sameActLine")) + 2);
  const sameActLine = new Function(seg + "\nreturn sameActLine;")();
  assert.equal(sameActLine("靠在窗边", "靠在窗边"), true);
  assert.equal(sameActLine("靠在窗边。", "靠在窗边"), true, "标点不算变");
  assert.equal(sameActLine("靠在窗边了", "靠在窗边"), true, "句尾语气字不算变");
  assert.equal(sameActLine("靠 在 窗 边", "靠在窗边"), true, "空白不算变");
  assert.equal(sameActLine("靠在窗边看雨", "靠在窗边"), false, "真做了别的事就得显示出来");
  assert.equal(sameActLine("在厨房洗碗", "靠在窗边"), false);
  // 空值一律当「不一样」，不然第一条动描永远出不来
  assert.equal(sameActLine("", ""), false);
  assert.equal(sameActLine("靠在窗边", ""), false, "上一条没有动描时，这一条必须显示");
  assert.equal(sameActLine(null, undefined), false);
  assert.equal(sameActLine("。", ""), false, "只剩标点的也当没有");
});
