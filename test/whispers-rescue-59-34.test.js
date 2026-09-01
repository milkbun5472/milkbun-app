const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const bare = x => x.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

// 她 2026-09-01：「悄悄话和便签墙不是一个东西吗」——是同一个东西。
// 悄悄话是那张纸条，便签墙是它贴的那面墙，搬家链早就铺好了：
//   x_whispers ──(x_whispersMigrated)──▶ x_coupleNotes ──(x_notesToDrawer)──▶ 抽屉
// 但第一段的代码在 v59.23 跟着墙一起被删了，卡在第一段的人从此没人接。
test("断掉的那一节接上：x_whispers 直接进抽屉", () => {
  const i = app.indexOf('const _oldW = loadJSON("x_whispers", [])');
  assert.ok(i > 0, "没有把 x_whispers 接回来");
  const mig = bare(app.slice(i, app.indexOf("setCoupleQA(loadJSON", i)));
  assert.match(mig, /kind: "whisper"/, "没按悄悄话的样子放进抽屉");
  assert.match(mig, /saveJSON\("x_coupleDrawer"/, "没真的写进抽屉");
  // 沿用【同一个闸】：走完过第一段的人这里必须什么都不发生
  assert.match(mig, /!loadJSON\("x_whispersMigrated", false\)/, "没沿用原来那个闸，会把已经搬过的再搬一遍");
  assert.match(mig, /saveJSON\("x_whispersMigrated", true\)/, "跑完没置位，每次开机都再捞一遍");
  // 这些她一张都没见过（原来存在无处显示的地方），所以留成没拆的
  assert.match(mig, /openedTs: null/, "标成已拆了，她就永远打不开这些");
  // 同一条不许进两遍
  assert.match(mig, /!_have0\.has\(x\.id\)/, "重复开机会把同一条堆两遍");
});

// ⚠️顺序：先捞悄悄话再搬便签墙。反过来的话，便签墙那段读到的是【还没写进去】的抽屉，
// 它一 save 就把刚捞回来的盖掉了。
test("先捞悄悄话，再搬便签墙", () => {
  const a = app.indexOf('const _oldW = loadJSON("x_whispers", [])');
  const b = app.indexOf('const _cnotes = loadJSON("x_coupleNotes", [])');
  const c = app.indexOf('setCoupleDrawer(loadJSON("x_coupleDrawer", []))');
  assert.ok(a > 0 && b > a, "便签墙那段跑在前面，会把捞回来的盖掉");
  assert.ok(c > b, "抽屉的状态在两段搬家之前就读了，界面上看不到搬回来的东西");
});

// 界面上再没有任何一处读 whispers 了（悄悄话 v59.2x 起全走抽屉）
test("没人读的那份状态删掉，不留着骗下一个人", () => {
  assert.ok(app.indexOf("const [whispers, setWhispers] = useState") < 0, "那份没人读的状态还留着");
  assert.ok(app.indexOf("setWhispers(") < 0, "还在往没人读的地方写");
});
