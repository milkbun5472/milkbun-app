// v62.73 顺手清：合格页里那一堆英文小字眉标。
// 它们不走公共 Head，所以 Head 那道闸（有 zh 就不发纯拉丁的 en）管不到——
// 得一处处改（.claude/rules/no-english-titles.md）。
//
// ⚠️换的时候不硬翻：眉标该说的是【这一栏在干嘛】，
//   把英文原样译回来的那种中文，跟英文一样是装饰。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const R = f => fs.readFileSync("js/" + f, "utf8");
const nocom = x => x.split("\n").map(l => l.split("//")[0]).join("\n");

test("一起学：自己那条顶栏也有同一道闸", () => {
  const st = nocom(R("study.js"));
  // 判据看的是【这串字里有没有汉字】，不是它写在哪个字段里——
  // 好几处是拿 en 当 sub 使的，一刀切会把中文副标题也误伤掉。
  assert.match(st, /\(\/\[一-鿿\]\/\.test\(String\(props\.en \|\| ""\)\) \|\| !props\.zh\)/);
  assert.doesNotMatch(st, /"QUIZ CARD · "/);
  assert.doesNotMatch(st, /"COURSE FILE · "/);
  assert.match(st, /"小测 · "/);
  assert.match(st, /"这门课 · "/);
});

test("查手机：外观页那三条栏名、账簿抬头、论坛副题都换成中文", () => {
  const ph = nocom(R("phone.js"));
  ["WALLPAPER", "ICON STYLE", "APP ICONS", "THREE IDENTITIES"].forEach(w =>
    assert.ok(ph.indexOf('"' + w + '"') < 0, w + " 还在"));
  assert.match(ph, /\} \}, "壁纸"\)/);
  assert.match(ph, /\} \}, "图标长什么样"\)/);
  assert.match(ph, /\} \}, "逐个换图标"\)/);
  assert.match(ph, /h\(Head, \{ zh: "账簿"/);
  assert.match(ph, /"同一个人的三副面孔"/);
});

test("账本那五栏上挂的 en 是死字段，删干净不是留着不用", () => {
  const ph = nocom(R("phone.js"));
  const seg = ph.slice(ph.indexOf("const TALLY_TABS = ["), ph.indexOf("];", ph.indexOf("const TALLY_TABS = [")));
  assert.doesNotMatch(seg, /en:/);
  ["OPEN", "COVER", "STAMP", "WORTH"].forEach(w => assert.ok(seg.indexOf(w) < 0));
});

test("文风台也铺一张纸，不再是整页平色", () => {
  const sl = nocom(R("style-lab.js"));
  assert.match(sl, /pageSkin\("paper", t, \{ strength: \.5 \}\)/);
  assert.match(sl, /Object\.assign\(\{ position: "relative", height: "100%", display: "flex", flexDirection: "column" \}, benchPaper\)/);
  // 顶栏和样张那一行不许再自己铺底把纸盖掉（§3.5）
  assert.doesNotMatch(sl, /padding: "0 14px", background: t\.bg/);
});
