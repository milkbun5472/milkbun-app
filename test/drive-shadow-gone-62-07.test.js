// 退休九维（heart-drive-shadow）整个删掉（Lisa 2026-09-04 选的「整个删掉（连数据）」）
//
// 它 v49.35 上线时是【对账用的影子】：九个维度在本机连续推演，跟 A 线和动念比曲线。
// 对账早就做完了，baseline 也永久冻结了，但那套东西【每一轮回复都还在跑】——
// observe() 写一次 state、追一行 audit，然后 getAll() 把最多 500 行审计整个读出来做修剪，
// 全部只为了喂「心上」页面底下那个默认折起来、她从来没展开过的灰条。
//
// 「撤掉东西要删除而不是在它后面说 xxx 是错的应该 yyyy」——所以不是留着不调，是连库一起清。
// 这份数据从来不在导出和云备份里（它在独立 IndexedDB，不是 x_ 键），删掉就是真没了。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");
// 注释里提这个名字是墓碑，不算残留；判的是真代码
const code = s => s.split("\n").filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

test("模块、挂点、面板、审计口一处不剩", () => {
  assert.ok(!fs.existsSync(path.join(root, "js/heart-drive-shadow.js")), "模块文件还在");
  assert.doesNotMatch(read("index.html"), /heart-drive-shadow/, "index.html 还在加载它");
  const files = fs.readdirSync(path.join(root, "js")).filter(f => f.endsWith(".js"));
  files.forEach(f => assert.doesNotMatch(code(read("js/" + f)), /DesireDriveShadow/,
    "js/" + f + " 还在调退休九维"));
  // 每一轮回复的那个挂点是这次要拔掉的正主，单独钉一遍
  assert.doesNotMatch(read("js/app.js"), /\.observe\(charId/, "回复链上还挂着 observe");
  assert.doesNotMatch(code(read("js/heart.js")), /driveShadow/, "心上页还留着那块灰条");
});

test("评审包里那一栏改成墓碑，不是还在报数", () => {
  const src = read("js/shadow-review.js");
  assert.match(src, /mode: "deleted"/, "评审包还写着 retired_shadow，等于说它还在");
  assert.doesNotMatch(code(src), /legacyNineDrives:/, "还在往导出里塞旧读数");
  // drives 那个数组连声明都不该留着（留着就是下一个人以为还有数据可填）
  assert.doesNotMatch(src, /drives = \[\]/, "drives 数组还在");
});

test("那个独立 IndexedDB 库开机清一次，而且只清一次", () => {
  const app = read("js/app.js");
  const i = app.indexOf("purgeRetiredDriveShadow");
  assert.ok(i > 0, "没有开机清库这一段——模块删了、库会在每台设备上一直躺着");
  const seg = app.slice(i, i + 900);
  assert.match(seg, /indexedDB\.deleteDatabase\("lisa_desire_drive_shadow_v1"\)/, "清的不是那个库名");
  // 只清一次：不带 x_ 前缀，所以不进存档、不上云（x_ 的会被同步链接管）
  assert.match(seg, /localStorage\.getItem\("driveShadowPurged"\)/, "没有闸，每次开机都空跑一遍");
  assert.match(seg, /localStorage\.setItem\("driveShadowPurged", "1"\)/, "闸没落下来，等于没有闸");
  assert.doesNotMatch(seg, /"x_driveShadowPurged"/, "这把钥匙不许带 x_——它会被塞进存档和云备份");
  // 坏了不许挡开机
  assert.match(seg, /catch \(e\)/, "没兜底，indexedDB 一抛就把开机链带下去");
});
