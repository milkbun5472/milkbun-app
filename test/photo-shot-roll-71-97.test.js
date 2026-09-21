// 每张照片都是同一个角度（她 2026-09-20：「生图还是太过于偏向锁脸的那个角度，
// 我之前调过的还是走一样的角度」）。
//
// 她 2026-08-25 加过一句「参考图只锁人，不锁镜头」——那是一句【请求】，而有参考照时走的是
// /v1/images/edits + input_fidelity=high，那个接口的本职就是【保住输入】。跟一个专门负责
// 「别改」的接口讲道理，十次有八次不改。所以改成代码掷轴：这一张的机位由代码点名
// （施工规则/bans-make-it-dumber.md：该加约束时掷轴、别掷答案）。
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");

// 照仓里现成的取法把整个 buildPhotoPrompt 抠出来真跑（钉函数名，不钉注释）
function grab(name) {
  const i = eng.indexOf("function " + name);
  assert.ok(i > 0, "engine.js 里抠不出 " + name);
  let d = 0, j = i;
  for (; j < eng.length; j++) {
    if (eng[j] === "{") d++;
    else if (eng[j] === "}") { d--; if (!d) { j++; break; } }
  }
  const stubs = "const freshPhotoWearing=()=>\"\";const freshLiveStateValue=()=>\"\";const charAge=()=>25;";
  return new Function(stubs + eng.slice(i, j) + "\nreturn " + name + ";")();
}
const buildPhotoPrompt = grab("buildPhotoPrompt");
const char = { name: "沈清和", persona: "二十七岁，做建筑的", appearance: "高个子，短发" };
const shotOf = kind => {
  const out = buildPhotoPrompt(char, "在楼下便利店", null, { kind: kind });
  const m = /【这一张的机位·由这次拍摄决定，不许沿用参考图】([^。]+)。/.exec(out);
  assert.ok(m, "拼出来的 prompt 里没有这一张的机位");
  return m[1];
};

// ---- 1. 真的在换，而且连着两张不会一样 ----
const seen = new Set();
let prev = "";
for (let k = 0; k < 40; k++) {
  const line = shotOf("self");
  assert.notStrictEqual(line, prev, "连着两张掷到同一个机位，等于没掷");
  prev = line; seen.add(line);
}
assert.ok(seen.size >= 6, "四十张只掷出 " + seen.size + " 种机位");

// 别人帮拍那一档有自己的一份（自拍的机位放在这儿不成立）
const other = new Set();
for (let k = 0; k < 20; k++) other.add(shotOf("other"));
assert.ok(other.size >= 4, "别人帮拍那一档几乎不换机位");
assert.ok(!/镜子前拍，手机在画面里/.test([...other].join("")), "别人帮拍的照片里不该出现自拍机位");

// ---- 2. 掷出来的那句必须压过参考图 ----
assert.match(buildPhotoPrompt(char, "在楼下便利店", null, { kind: "self" }), /这一条比参考图里的角度优先/, "没说清楚它比参考图优先，等于又变回一句请求");
assert.match(buildPhotoPrompt(char, "在楼下便利店", null, { kind: "self" }), /不许沿用参考图/);

// ---- 3. 掷的是镜头，不是这是谁：锁脸那几条一个字都不许动 ----
assert.match(eng, /五官、脸型、发型发色、瞳色、肤色、体型、标志性配饰，照它来/, "参考图锁人那一条被动了");
assert.match(eng, /【最高优先级·就是这个人】/, "身份锁被动了");

// ---- 4. 自拍那一档不许再写死「正脸对着镜头」，也不许写死「自拍构图」----
// 「脸清楚地对着镜头」和「自拍构图（selfie）」都是【每张都一个样】的来源：
// 前者定死了朝向，后者定死了那个举着手臂的母题，而且它会把机位轮盘抵消掉——
// 轮盘掷到「怼脸特写」「低头只露半张脸」时，模型为了同时满足 selfie 又把手臂塞回来
// （她 2026-09-21：「不需要每次都看出他是在自拍，有时候可以就是近距离的脸」）。
const selfBranch = eng.slice(eng.indexOf("【TA 自己拍自己的一张】画面里只有 TA 一个人，没有别人在替 TA 拍——"), eng.indexOf("【这是别人帮 TA 拍的照片"));
assert.ok(selfBranch.length > 0, "抠不出自拍那一档");
assert.ok(!/脸清楚地对着镜头/.test(selfBranch), "自拍那一档还写死着「脸清楚地对着镜头」");
assert.ok(!/自拍构图/.test(selfBranch), "自拍那一档又写死了「自拍构图」——那正是举手臂的来源");
assert.match(selfBranch, /不必让人一眼看出这是自拍/, "没说明不必看出是自拍");
assert.match(selfBranch, /由上面那一句机位说了算/, "手臂要不要入镜没交给机位决定");
assert.match(selfBranch, /不必正对镜头/, "没说明脸可以不正对镜头");
assert.match(selfBranch, /脸要在画面里/, "脸得在画面里这条丢了——那是自拍的题目");
// ⚠️锚还在：删干净会滑成「别人帮拍」，那就跟 other 那一档混了
assert.match(selfBranch, /没有别人在替 TA 拍/, "没有第三个人在拍这条锚丢了");

// ---- 4.5 合照那一档也不许把「一条手臂入镜」写成默认 ----
const duoBranch = eng.slice(eng.indexOf("【两人合照】"), eng.indexOf("【两人合照】") + 400);
assert.ok(!/一条手臂入镜/.test(duoBranch), "合照那一档还把「一条手臂入镜」写在默认写法里");
assert.match(duoBranch, /手臂和手机要不要入镜由这一张的机位决定/);

// ---- 4.8 最简稿（审核降级那一份）是同一层，别落单 ----
// 同一句话写在两处，改一处另一处永远落单（施工规则/one-public-mechanism.md）
const minimal = eng.slice(eng.indexOf("function buildMinimalPhotoPrompt("), eng.indexOf("function buildPhotoPrompt("));
assert.ok(!/自拍透视|前置摄像头/.test(minimal), "最简稿里还写死着自拍透视");
assert.match(minimal, /不必看出是自拍/);
assert.match(minimal, /没有别人在替 TA 拍/, "最简稿丢了「没有第三个人在拍」那条锚");

// ---- 5. 这句话真的被拼进去了，不是定义完没人用 ----
// （v55.95 那个形状：声明了但从没被引用，比压根没写更坏）
assert.match(eng, /parts\.push\(photoShotLine\(kind, opts\.shotSeed\)\);/, "掷出来的机位没拼进 prompt");

console.log("✓ 生图机位：每张现掷一个、连着两张不重样，锁脸那几条没动");
