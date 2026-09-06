// 她 2026-09-06 两件：
// ①「情侣空间的『另一个我们』为什么生图不出脸」——那张是【纯空景背景板】，
//   没有人是对的；缺的是【一张真合照】那个动作。
// ②「照相馆能不能多选衣服……有时候衣服和鞋子都被拆成单件了」。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");

test("衣服能挑好几件——衣柜里外套和鞋本来就分开挂", () => {
  const i = scr.indexOf("function StudioPicker(");
  const body = scr.slice(i, scr.indexOf("\n}", scr.indexOf("衣柜里还没有", i)));
  assert.match(body, /const picked = Array\.isArray\(value\) \? value : \(value \? \[value\] : \[\]\);/, "老存档那种字符串会当场崩");
  assert.match(body, /const toggle = n => onPick\(on\(n\) \? picked\.filter\(x => x !== n\) : picked\.concat\(\[n\]\)\);/, "再点一下拿不掉");
  assert.match(body, /onPick\(\[\]\)/, "「不指定」清不干净");
  assert.match(body, /"挑了 " \+ picked\.length \+ " 件"/, "挑了几件看不出来");
  // 两边的 state 得跟着变成数组，不然点一下就报错
  assert.match(scr, /const \[mine, setMine\] = useState\(\[\]\);/, "我这边还是单件");
  assert.match(scr, /const \[theirs, setTheirs\] = useState\(\[\]\);/, "他那边还是单件");
  // 递到出图那头仍是一句话：那一层不用跟着改
  assert.match(scr, /onShoot\(\{ scene, mine: mine\.join\("、"\), theirs: theirs\.join\("、"\) \}\)/, "多件没拼成一句话递过去");
});

test("空景那张不许再冒充合照", () => {
  // 它走的是 buildScenePrompt——第一句就是「一个人都没有」。所以没有脸是【对的】
  assert.match(eng, /生成一张【纯空景图】：画面里【一个人都没有】。/, "空景那条路变了");
  assert.match(app, /const scene = line\.bgPrompt \|\| line\.premise \|\| line\.title;/, "背景图那条路被改成画人了");
  // 但它挂上合照墙时要说清自己是什么，不然看着就像脸没画出来
  assert.match(app, /desc: "《" \+ line\.title \+ "》那个世界的一角"/, "墙上还是看不出这是空景");
});

test("要脸的那张走照相馆现成的真 duo 路，不另拼一份提示词", () => {
  const i = app.indexOf("const ifShot = async lineId =>");
  assert.ok(i > 0, "没有这个动作");
  const body = app.slice(i, app.indexOf("// 收线。三个去处", i));
  assert.match(body, /return await studioShoot\(char, \{ scene: scene, ifTitle: line\.title \}\);/, "在如果馆这儿又拼了一份出图提示词");
  assert.ok(body.indexOf("buildPhotoPrompt") < 0 && body.indexOf("generateSelfieImage") < 0, "绕过了照相馆那条链");
  // 两张参考照的门槛由 studioShoot 统一兜（说清楚缺什么，不是默默画个陌生人）
  assert.match(app, /if \(!\(char\.refPhoto && profile && profile\.refPhoto\)\) \{ toast\("合照要你俩都设了参考照/, "锁脸那道闸没了");
  // 界面上两颗按钮各是各的
  assert.match(scr, /shotBusy \? "拍着…" : "拍张我俩"/, "如果馆里没有这颗按钮");
  assert.match(scr, /shotBusy: studioBusy, onShot: onIfShot,/, "没接上");
});

test("取素材照着【写这份存档的那段】抄字段名", () => {
  // 一拍是 { role, boxes:[{who,text}] }。写成 b.text 一条都取不到，而且不报错——
  // 只是这张照片永远只按开头那句设定拍（stub-from-the-writer 那一课）
  assert.match(app, /beats: \[\{ id: "b_" \+ Date\.now\(\), role: "char", boxes: boxes, ts: Date\.now\(\) \}\]/, "写入方变了，这条得重看");
  const i = app.indexOf("const ifShot = async lineId =>");
  const body = app.slice(i, app.indexOf("// 收线。三个去处", i));
  assert.match(body, /\.flatMap\(b => \(\(b && b\.boxes\) \|\| \[\]\)\.map\(x => String\(\(x && x\.text\) \|\| ""\)\.trim\(\)\)\)/, "又照着自己以为的样子取了");
});

test("从如果馆拍的那张，墙上认得出是哪条线", () => {
  assert.match(app, /scene: \(opt && opt\.ifTitle \? "《" \+ opt\.ifTitle \+ "》里的我们 · " : ""\) \+ scene,/, "跟日常合照混在一起了");
});
