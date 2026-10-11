// 她 2026-09-29 截图：群里江识开着双语，一条「ん？なに？|……嗯？什么？」落成了五泡——
//   ん？（译）／なに？（译）／|……／嗯？／什么？。竖线落单、中文自己成了两泡。
// 病根：群里先用 splitBubbles 按「？」「……」断句，再劈竖线；单聊一直是先劈竖线再拆泡。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => path.join(__dirname, "..", "js", f);
const engine = fs.readFileSync(R("engine.js"), "utf8");
const app = fs.readFileSync(R("app.js"), "utf8");
const Guard = require("../js/group-identity-guard.js");

const grab = name => {
  const i = engine.indexOf("function " + name + "(");
  assert.ok(i >= 0, name + " 没了");
  return engine.slice(i, engine.indexOf("\n}\n", i) + 3);
};
const E = new Function(grab("splitBilingual") + grab("bilingualKey") + grab("joinBilingualLines") +
  "\nreturn { splitBilingual, bilingualKey, joinBilingualLines };")();

// 照群里那一段的顺序走：按换行切 → 接回竖线打头的行 → 劈竖线（这里不再往下拆泡，只看劈得开没有）
const lines = text => E.joinBilingualLines(String(text).split(/\n+/).map(x => x.trim()).filter(Boolean));

test("旧的那条路就是截图里那五泡（病根复现）", () => {
  assert.deepEqual(Guard.splitBubbles("ん？なに？|……嗯？什么？"), ["ん？", "なに？", "|……", "嗯？", "什么？"]);
});

test("同一行：按换行切之后竖线还在，劈得开", () => {
  const ls = lines("ん？なに？|……嗯？什么？");
  assert.equal(ls.length, 1);
  assert.deepEqual(E.splitBilingual(ls[0]), { text: "ん？なに？", zh: "……嗯？什么？" });
});

test("中译另起一行：接回上一行再劈", () => {
  const ls = lines("ん？なに？\n| 嗯？什么？");
  assert.deepEqual(ls, ["ん？なに？ | 嗯？什么？"]);
  assert.equal(E.splitBilingual(ls[0]).zh, "嗯？什么？");
});

test("上一行自己已经是完整双语的不接", () => {
  assert.deepEqual(E.joinBilingualLines(["はい | 好", "|……"]), ["はい | 好", "|……"]);
});

test("群里：双语开着只按换行切，劈完竖线才拆泡；单聊也接回另起一行的中译", () => {
  assert.match(app, /: \(gBiOn \|\| !window\.GroupIdentityGuard\) \? String\(item\.text \|\| ""\)\.split\(\/\\n\+\/\) : window\.GroupIdentityGuard\.splitBubbles\(item\.text\);/);
  assert.match(app, /const gLines = \(gBiOn \? \(ls => joinBilingualLines\(ls, hanLangOf\(spk\)\)\) : \(x => x\)\)\(/);
  assert.match(app, /if \(_bilingualOn\) words = joinBilingualLines\(words, hanLangOf\(char\)\);/);
});

// 她 2026-10-11 截图：粤语那几句竖线只在其中一行，中译分几行跟在后面，按换行切完错一位
test("粤语：落单的原文和中译按句重新配对，中译被换行劈开的接回去", () => {
  assert.deepEqual(E.joinBilingualLines([
    "聽日開會班老嘢望住我個頭像",
    "我就話係屋企隻貓亂撳換嘅 | 明天开会那帮老头看着我的头像",
    "我就说是家里那只猫乱按换的"
  ], true), [
    "聽日開會班老嘢望住我個頭像 | 明天开会那帮老头看着我的头像",
    "我就話係屋企隻貓亂撳換嘅 | 我就说是家里那只猫乱按换的"
  ]);
  assert.deepEqual(E.joinBilingualLines([
    "食咗藥算你聽話 | 吃了药算你听话",
    "換就換，洗完澡出嚟就見到你喺度委屈巴巴 | 换就换",
    "洗完澡出来就看到你在这委屈巴巴",
    "自己睇吓微信 | 自己看看微信"
  ], true), [
    "食咗藥算你聽話 | 吃了药算你听话",
    "換就換，洗完澡出嚟就見到你喺度委屈巴巴 | 换就换洗完澡出来就看到你在这委屈巴巴",
    "自己睇吓微信 | 自己看看微信"
  ]);
  // 不是粤语那种人不动：后面一句普通中文照样是自己一泡
  assert.deepEqual(E.joinBilingualLines(["はい | 好", "我先走了"]), ["はい | 好", "我先走了"]);
});

// 她 2026-10-11：「档案里用粤语的角色强制出翻译」——漏了竖线的那几泡单聊、群聊都自己补中译，只走免费翻译
test("粤语角色漏了竖线：单聊群聊都补中译，不叫模型", () => {
  assert.match(app, /const _yueFill = _bilingualOn && hanLangOf\(char\)/);
  assert.match(app, /const _gYueFill = gBiOn && hanLangOf\(spk\)/);
  assert.equal((app.match(/translateToZh\(w, lg, \{ noModel: true \}\)/g) || []).length, 2);
});
