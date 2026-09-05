const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const phone = fs.readFileSync(path.join(root, "js", "phone.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js", "components.js"), "utf8");
const gaze = fs.readFileSync(path.join(root, "js", "gaze.js"), "utf8");

test("Ta 眼里复用查手机已经验证过的性别称谓判断", () => {
  assert.match(phone, /window\.PhonePronoun = \{ ta: charTa, replace: phoneTa \}/,
    "查手机的 charTa 没有暴露成共用称谓入口");
  // ⚠️这一条原来把那句取称谓的表达式【逐字】冻死在 GazePage 的 ta: 上。冻的该是行为不是长相：
  //   v59.85 把它提成卡上的一个局部（心声卡自己那几句「他」也要用同一个值），这条就假红了。
  //   改成问真正在意的那件事：称谓是不是从共用入口 charTa 取的、取到的是不是就交给了 Ta 眼里。
  const card = comp.slice(comp.indexOf("function StateCard({"), comp.indexOf("// 线下模式（赴约）"));
  const inline = /ta: window\.PhonePronoun \? window\.PhonePronoun\.ta\(character\)/.test(card);
  const named = (card.match(/const (\w+) = window\.PhonePronoun \? window\.PhonePronoun\.ta\(character\)/) || [])[1];
  assert.ok(inline || named, "状态卡没有从共用入口取当前角色的称谓");
  assert.ok(inline || new RegExp("ta: " + named + "\\b").test(card),
    "状态卡没把当前角色的称谓传给 Ta 眼里");
  assert.match(gaze, /function GazePage\(\{ charId, charName, uName, ta,/,
    "Ta 眼里没有接收角色称谓");
});

test("Ta 眼里的空态、按钮、历史标题都跟着性别走", () => {
  assert.match(gaze, /const say = s => who === "他" \? s : String\(s \|\| ""\)\.replace\(\/他\/g, who\)/);
  ["他还没往这想过。", "他从前是这么想的", "他从前都怎么写的", "他还没写过什么。", "他在想…", "让他写写看"]
    .forEach(s => assert.match(gaze, new RegExp("say\\(\\\"" + s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\\"\\)"), s + " 仍然是写死的称谓"));
  // v62.66 那行英文副题（"SHE, THROUGH HIS EYES"）按 no-english-titles 删掉了：
  // 它上面那行「关于我」已经把话说完了。所以这里不再有 HIS/HER/THEIR 要跟着变——
  // 判词跟着搬到【还在的那几处】：中文称谓一处都不许写死。
  assert.doesNotMatch(gaze, /"SHE, THROUGH "/, "英文副题又回来了");
  assert.doesNotMatch(gaze, /const EN = \{ "me\.person"/, "那张只用来压英文小字的表又回来了");
});
