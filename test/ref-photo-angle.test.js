const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");

function grab(name) {
  const i = engine.indexOf("function " + name);
  let d = 0, j = i;
  for (; j < engine.length; j++) {
    if (engine[j] === "{") d++;
    else if (engine[j] === "}") { d--; if (!d) { j++; break; } }
  }
  const stubs = "const freshPhotoWearing=()=>\"\";const freshLiveStateValue=()=>\"\";const charAge=()=>25;";
  return new Function(stubs + engine.slice(i, j) + "\nreturn " + name + ";")();
}

// 她 2026-08-25：「为啥生出来的图都是参考图那个角度」——一个角色参考照微微仰头看镜头，
// 出来的永远仰头；另一个低头平视，就永远低头平视。
// 有参考照时走 /v1/images/edits + input_fidelity=high，那个接口的本职就是
// 【保住输入、只改提示词点名要改的地方】。机位/视线属于输入，没人点名要改就原样留着。
// 而「机位必须换新的」这句话之前【只写在连贯参考图那一条里】，人物参考照一个字都没有。

test("有人物参考照时，必须明说机位和视线要重定", () => {
  const build = grab("buildPhotoPrompt");
  const p = build({ name: "沈屿白", refPhoto: "iv_abc", appearance: "黑发" }, "在实验室", {}, { kind: "self" });
  assert.match(p, /参考图只锁人，不锁镜头/);
  assert.match(p, /机位、头的朝向、视线看哪里、表情、姿势、取景范围/);
  assert.match(p, /重新决定/);
  // 点名她说的那两种症状
  assert.match(p, /微微仰头看镜头、低头平视/);
  assert.match(p, /不是这个人天生的姿态/);
  // 该照搬的仍要照搬——别把锁脸一起弄没了
  assert.match(p, /五官、脸型、发型发色、瞳色、肤色、体型、标志性配饰，照它来/);
});

test("没有参考照时不发这一条（没图可锁，说了也白说）", () => {
  const build = grab("buildPhotoPrompt");
  const p = build({ name: "沈屿白", appearance: "黑发" }, "在实验室", {}, { kind: "self" });
  assert.doesNotMatch(p, /参考图只锁人，不锁镜头/);
});

test("合照里只要有一张人物参考照就要发", () => {
  const build = grab("buildPhotoPrompt");
  const p = build({ name: "沈屿白" }, "雨天", {}, { kind: "duo", me: { name: "Lisa", refPhoto: "iv_me" } });
  assert.match(p, /参考图只锁人，不锁镜头/);
});

test("保脸级备用稿也要有——它是主稿被审核挡下时的替补", () => {
  const build = grab("buildMinimalPhotoPrompt");
  const p = build({ name: "沈屿白", appearance: "黑发" }, { kind: "self" });
  assert.match(p, /照搬的只有【长相】/);
  assert.match(p, /别沿用参考图的角度/);
  // 但它必须仍然保持「最小」：这一条只能是一句
  assert.ok(p.length < 700, "备用稿不许被撑胖，它存在的意义就是短");
});

// 这一条以前只写在【连贯参考图】那一支里，人物参考照没有——又是「只写在一处」。
test("连贯参考图那条原样保留，两条要并存", () => {
  const build = grab("buildPhotoPrompt");
  const p = build({ name: "沈屿白", refPhoto: "iv_abc" }, "在实验室", {}, { kind: "self", contRef: true, contRefIndex: 2 });
  assert.match(p, /构图、姿势、机位、表情必须换新的/, "连贯图那条");
  assert.match(p, /参考图只锁人，不锁镜头/, "人物参考照那条");
});

// buildReferencePhotoPrompt 目前还没有调用方（Codex 在做）。先把同款一句放好，
// 接线的那天不该重新掉进同一个坑。
test("还没接线的那份也先放好同款一句", () => {
  const build = grab("buildReferencePhotoPrompt");
  const p = build({ name: "沈屿白", refPhoto: "iv_abc" }, "在实验室", {}, { kind: "self" });
  assert.match(p, /参考图只决定【这是谁】/);
  assert.match(p, /不许沿用参考图里的角度/);
});
