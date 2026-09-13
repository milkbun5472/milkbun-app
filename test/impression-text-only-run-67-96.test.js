// 她 2026-09-13：「生成能不能搞个本次带不带图生成的选项」。
// 补齐十二个月就是十二张图，贵且慢；而字才是主体，剪影随时能在每张卡上单独补。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const imp = fs.readFileSync(path.join(__dirname, "..", "js/impression.js"), "utf8");

test("开关只管这一趟，不写进设置", () => {
  assert.match(imp, /const \[withArt, setWithArt\] = useState\(true\);/, "默认还是带剪影");
  assert.ok(!/x_impressionArt|saveJSON\("x_[a-zA-Z]*[Aa]rt/.test(imp), "这是「这一趟」的选择，不该存起来");
});

test("补齐是个长循环，出不出图得用 ref 读", () => {
  // 闭包里那份 state 在循环跑起来之后不会再变——和 liveBook 同一个道理
  assert.match(imp, /const artRef = React\.useRef\(withArt\); artRef\.current = withArt;/);
  assert.match(imp, /if \(artRef\.current && typeof imgApiReady === "function" && imgApiReady\(\)\)/);
});

test("开关摆在生成的那一页，而且顺手说清这一趟是什么样", () => {
  // 跟「补齐」并排：所有生成都是从这一页起的
  assert.match(imp, /onClick: \(\) => setWithArt\(v => !v\), style: S\.btn\(withArt\)/);
  assert.match(imp, /withArt \? "带剪影" : "只写字"/);
  // 空相角位那一格
  assert.match(imp, /\+ \(withArt \? "" : "（只写字）"\)/);
  // 补齐的确认框里也要说清，别点下去才发现出了十二张图
  assert.match(imp, /artRef\.current \? "每个月连剪影一起出（慢，也费图额）。" : "这一趟只写字，不出剪影；剪影以后在每张卡上单独补。"/);
});

test("不出图不影响别的：单独补剪影那条路一个字没动", () => {
  const seg = imp.slice(imp.indexOf("async function redrawArt"), imp.indexOf("// 只重写文案"));
  assert.match(seg, /const img = await M\.genArt\(entry\.silhouette, props\.profile/);
  assert.ok(!/artRef/.test(seg), "手动点「补一张剪影」就是要图，别再看这一趟的开关");
  assert.match(imp, /e\.img \? "只重出剪影" : "补一张剪影"/);
});
