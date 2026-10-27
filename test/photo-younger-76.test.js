const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
const s = fs.readFileSync("js/engine.js", "utf8");
const f = new Function(s.slice(s.indexOf("const PHOTO_YOUNGER_MARK"), s.indexOf("function buildPhotoPrompt(")) + ";return { photoYoungerOf, PHOTO_YOUNGER_MARK };")();
test("认得出小时候的照片", () => {
  assert.equal(f.photoYoungerOf("老相册里的扫描旧照，大约六七岁的小沈屿白，穿着宽大的工装短袖").age, "大约六七岁");
  assert.ok(f.photoYoungerOf("他小时候在外婆家的院子里"));
  assert.ok(f.photoYoungerOf("三岁时的照片，坐在澡盆里"));
});
test("现在的照片不算", () => {
  for (const x of ["24岁的他在海边", "咖啡店里看书", "十八岁生日那天切蛋糕", "抱着一只三岁的猫"]) assert.equal(f.photoYoungerOf(x), null, x);
});
test("提示词换一套、编辑接口不要求原样保脸", () => {
  assert.match(s, /if \(younger\) parts\.push\(PHOTO_YOUNGER_MARK \+/);
  assert.match(s, /if \(!younger && \(multi \|\| kind === "duo" \|\| char\.refPhoto\)\) parts\.push\("【首要任务：人物身份】/);
  assert.match(s, /if \(!legacyShape && !\(typeof PHOTO_YOUNGER_MARK === "string" && String\(promptText \|\| ""\)\.indexOf\(PHOTO_YOUNGER_MARK\) >= 0\)\) fd\.append\("input_fidelity", "high"\);/);
  assert.match(s, /const isMinor = !!younger \|\|/);
});
test("合照：点了名只画小那一个，笼统写就都画小；有小孩不抽恋人姿势", () => {
  assert.match(s, /const _yNames = multi \? cast\.map/);
  assert.match(s, /younger\.names\.length < _yNames\.length \?/);
  assert.match(s, /PHOTO_DUO_POSES\.filter\(x => !\(opts\.notLover \|\| younger\) \|\| x\.charAt\(0\) !== "♥"\)/);
  const a = s.indexOf("const _yEsc"), line = s.slice(a, s.indexOf("\n", a));
  const _yEsc = eval(line.replace(/^const _yEsc = /, "(").replace(/;$/, ")"));
  const named = (scene, names) => names.filter(n => new RegExp("(?:小时候的|岁的|小)" + _yEsc(n) + "|" + _yEsc(n) + "(?:小时候|童年|还小)").test(scene));
  assert.deepEqual(named("六岁的小沈屿白和现在的Lisa站在一起", ["沈屿白", "Lisa"]), ["沈屿白"]);
  assert.deepEqual(named("两个人小时候在院子里的老照片", ["沈屿白", "Lisa"]), []);
});
