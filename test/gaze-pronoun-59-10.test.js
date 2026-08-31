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
  assert.match(comp, /ta: window\.PhonePronoun \? window\.PhonePronoun\.ta\(character\)/,
    "状态卡没把当前角色的称谓传给 Ta 眼里");
  assert.match(gaze, /function GazePage\(\{ charId, charName, uName, ta,/,
    "Ta 眼里没有接收角色称谓");
});

test("Ta 眼里的空态、按钮、历史标题和英文副题都跟着性别走", () => {
  assert.match(gaze, /const say = s => who === "他" \? s : String\(s \|\| ""\)\.replace\(\/他\/g, who\)/);
  ["他还没往这想过。", "他从前是这么想的", "他从前都怎么写的", "他还没写过什么。", "他在想…", "让他写写看"]
    .forEach(s => assert.match(gaze, new RegExp("say\\(\\\"" + s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\\"\\)"), s + " 仍然是写死的称谓"));
  assert.match(gaze, /who === "她" \? "HER" : who === "TA" \? "THEIR" : "HIS"/,
    "英文副题仍然把女生写成 HIS");
});
