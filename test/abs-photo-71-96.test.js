// 腹肌照一直要不到（她 2026-09-20：「要普通照片一下就给了，但是腹肌照一直不给」）。
//
// 三处挡的：
//  ① PART_WORDS 那张表只收了手和背影，躯干那一族一个都没有——「给我看腹肌」于是走
//    【带脸的自拍】那条路，拍出来当然是穿好衣服的一张脸；
//  ② 不露脸那一档明写着只许出现「手、手指、手腕、肩背、背影的一角」；
//  ③ 服装锁三处都写着「每张图都必须完整穿着」，把【掀起衣摆】这种动作也当成换装挡了
//    （她：「腹肌完全是可以在穿好衣服的情况下把衣服掀起来的，我觉得没有冲突」）。
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
// 切片两头钉常量名/函数名，不钉注释（anchor-on-code.md）
const i = src.indexOf("const SCENE_ONLY_WORDS");
const j = src.indexOf("function buildMinimalPhotoPrompt(", i);
assert.ok(i > 0 && j > i, "engine.js 里抠不出 noFaceKindFor 那一段");
const noFaceKindFor = new Function("characterText", src.slice(i, j) + "; return noFaceKindFor;")(() => "");

// ---- ① 躯干那一族要落进 part（有身体、没有脸）----
["给你看看我的腹肌", "撩起衣摆给你看腹肌", "我的人鱼线", "腰腹线条", "掀起衣服"].forEach(s => {
  assert.strictEqual(noFaceKindFor(s, "沈清和"), "part", "「" + s + "」没被认成 part，它会走带脸的自拍");
});
// 手和背影那一族不许回退
assert.strictEqual(noFaceKindFor("拍一张你的右手", "沈清和"), "part");
// 明说了脸／自拍的仍然照旧画人（别把普通自拍误判成不露脸）
["自拍一张，笑着", "侧脸对着窗", "正面照"].forEach(s => {
  assert.notStrictEqual(noFaceKindFor(s, "沈清和"), "part", "「" + s + "」被误判成不露脸了");
});
// 空景仍然是空景
assert.strictEqual(noFaceKindFor("窗外的雪，没有人", "沈清和"), "view");
assert.strictEqual(noFaceKindFor("刚做好的菜", "沈清和"), "");

// ---- ② 不露脸那一档得允许躯干 ----
const bodyRule = src.slice(src.indexOf("【不露脸铁律·最高优先】"), src.indexOf("【无人铁律·最高优先】"));
assert.match(bodyRule, /腰腹、胸膛、躯干/, "不露脸那一档还是只许出现手和背影");
assert.match(bodyRule, /头部在画面之外/, "不露脸这条硬条件丢了");

// ---- ③ 服装锁：锁的是哪一身，不是必须原样穿好 ----
assert.match(src, /const OUTFIT_LOCK_GESTURE = /, "没有那句放行的泄压阀");
assert.match(src, /掀起衣摆/, "掀衣摆没写进服装锁的放行里");
assert.match(src, /只有换成【另一身衣服】才算违反这把锁/, "放行写得不是判据");
// 三处锁都要挂上，缺一处那一处照旧把动作当换装
const locks = src.match(/ \+ OUTFIT_LOCK_GESTURE/g) || [];
assert.strictEqual(locks.length, 3, "只有 " + locks.length + " 处服装锁挂上了放行句");

// ---- ④ 备用稿不许再写死「衣着完整整齐」----
assert.ok(!/衣着完整整齐/.test(src), "审核备用稿里还写死着「衣着完整整齐」");

console.log("✓ 腹肌照：落进不露脸那一档、躯干允许入镜、服装锁不再把掀衣摆当换装");
