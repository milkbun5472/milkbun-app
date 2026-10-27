// 她 2026-09-16：「我们给角色是不是有一套抓衣服的，能不能给我自己也搞这个，
// 这样传了脸也有提示词兜底衣服」。
//
// 对照下来：角色那条链有四级 —— photoOutfit（手动锁死）＞ 此刻真穿着 ＞ 衣柜 ＞ 人设。
// 她自己只有【外貌】一级：`me` 对象四处各自手搓，只带 name/appearance/refPhoto。
// 更冤的是「我的衣柜」（x_myCloset）早就存在、也早就有 myClosetText()，
// **从来没接到生图那头**——衣柜里挂着好几身，出图一身都用不上。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");
const engine = fs.readFileSync("js/engine.js", "utf8");
const components = fs.readFileSync("js/components.js", "utf8");
const live = app.split("\n").map(l => l.split("//")[0]).join("\n");

test("出图时的「我」只有一份，四处都读它", () => {
  // v75.685：「我」照这个角色认的那张面具取，photoMe 多了第二个参数 who
  assert.match(app, /const photoMe = \(fallbackName, who\) => \{ const P = meOf\(who\); return \{/);
  const fn = app.match(/  const photoMe = \(fallbackName, who\) => \{[\s\S]*?\n  \}; \};/)[0];
  for (const k of ["name", "appearance", "refPhoto", "outfit", "closet"])
    assert.match(fn, new RegExp("\\b" + k + ":"), "photoMe 少了 " + k);
  assert.match(fn, /outfit: \(P && P\.photoOutfit\) \|\| "",/);
  assert.match(fn, /closet: myClosetText\(who\)/, "衣柜没接上——那正是这一刀要修的东西");
  // 原来那三处手搓的对象删干净了才算「只剩一处」
  assert.ok(live.indexOf('appearance: profile && profile.appearance, refPhoto: profile && profile.refPhoto }') < 0,
    "还有地方自己手搓 me，衣柜和固定锁一定会漏掉那一处");
  assert.equal((live.match(/photoMe\(/g) || []).length, 9,
    "九处出图都要读同一份：聊天 / 群聊 / 线下 / 照相馆 / TA 相册里拍她那张（2026-10-03）/ 片刻合拍那张（2026-10-07）/ TA 帮她拍的 meSubject（2026-10-11）/ 邮票册满级「你们俩」那面（drawDuo，2026-10-25）/ 邮票册番外插图（2026-10-27）");
});

test("照相馆那一处【不】塞衣柜——她刚挑的那身不能被顶掉", () => {
  const at = app.indexOf('const me = { ...photoMe("我", char.id), closet: "" };');
  const seg = app.slice(at - 260, at + 80);
  assert.match(seg, /照相馆是她自己挑的衣服/);
  assert.match(seg, /const me = \{ \.\.\.photoMe\("我", char\.id\), closet: "" \};/);
});

test("群合照名单里的「我」也带着自己的衣柜和固定锁", () => {
  // v75.685：群里的「我」照这个群挑的那张面具（gMe / _gm），衣柜和固定锁照旧要带上
  assert.equal((live.match(/id: "__me", name: (?:gMe|_gm)\.name \|\| "我", appearance: (?:gMe|_gm)\.appearance, refPhoto: (?:gMe|_gm)\.refPhoto, outfit: sceneMeOutfit\(\{ groupId[^}]*\}\), closet: myClosetText\("g:" \+ (?:groupId|group\.id)\)/g) || []).length, 2,
    "两处合照名单都要带上——漏一处就是「有时候有、有时候没有」");
  // sceneMeOutfit＝这一场她在「穿什么」里挑的那身，没挑就是资料里那把固定锁（她 2026-10-02）
  assert.match(live, /const sceneMeOutfit = scope => \(\(sceneSessOf\(scope\) \|\| \{\}\)\.meOutfit\) \|\| \(profile && profile\.photoOutfit\) \|\| "";/);
});

test("提示词那头按 固定锁 ＞ 衣柜 ＞ 自由搭 三级落", () => {
  assert.match(engine, /const meOutfit = String\(\(me && me\.outfit\) \|\| ""\)\.trim\(\);/);
  assert.match(engine, /const meCloset = meOutfit \? "" : String\(\(me && me\.closet\) \|\| ""\)\.trim\(\);/,
    "有固定锁时不该再把衣柜也塞进去——两套衣服打架");
  const duo = engine.slice(engine.indexOf("parts.push(meOutfit"), engine.indexOf("parts.push(meOutfit") + 1100);
  // ⚠️她 2026-09-16 补的判据：服设也算锚点。所以【她直接填的那一段】跟身份锁同级，
  //   而且不许再叫模型「别照搬参考照里的衣服」——参考照里那身多半正是这一段写的那身。
  assert.match(duo, /的服装设定·与脸同级的锚点/);
  assert.match(duo, /这身装束不是今天挑的衣服，是设定的一部分/);
  // 参考照要有个明确裁决，不能含糊
  assert.match(duo, /参考照里若正好是这身，照着画；若不是，以这段文字为准/);
  // ⚠️小剧场的 IF 行头也走这一行，「同一场戏始终不变」那句不能丢
  assert.match(duo, /同一场戏里这身衣服始终不变/);
  const anchorLine = duo.slice(0, duo.indexOf("meCloset"));
  assert.ok(anchorLine.indexOf("别照搬") < 0 && anchorLine.indexOf("不得照搬参考照里的衣服") < 0,
    "填了服设还叫模型别照搬参考照，等于把她的设定撕掉一半");
  assert.match(duo, /从 TA 自己衣柜里【真有的】这几身里挑一套/);
  assert.match(duo, /挑一套穿全，别把几套拼在一起，也别另编衣柜里没有的东西/,
    "不写这句，模型会把三套拼成一套、或者自己编一件衣柜里没有的");
  assert.match(duo, /按当前场景\/天气\/氛围给 TA 自然搭配/, "两样都没有时的兜底不能丢");
});

test("多人合影里的「我」也吃得到自己的衣柜", () => {
  assert.match(engine, /const cl = of \? "" : String\(x\.closet \|\| \(x\.id === "__me" \? meCloset : ""\)\)\.trim\(\);/);
});

test("我的面具里能填「出图常服」，而且说清了参考照要什么样", () => {
  assert.match(components, /const \[photoOutfit, setPhotoOutfit\] = useState\(profile\.photoOutfit \|\| ""\);/);
  assert.match(components, /photoOutfit: photoOutfit\.trim\(\)/, "填了不存等于没填");
  // 她 2026-10-12：这一栏搬去「我的衣柜」里点「钉住」（screens.js MyCloset），面具里不再摆输入框，存的时候照样带着
  assert.match(components, /出图常服这一栏搬去「我的衣柜」了/);
  // ⚠️有人传了全身立绘，脸只剩几十个像素，压完模型拿不到五官——那一栏以前根本没说要什么样的照片
  assert.match(components, /要能看清脸的半身或大头照，别用全身立绘（脸太小，压完就没五官了）/);
});
