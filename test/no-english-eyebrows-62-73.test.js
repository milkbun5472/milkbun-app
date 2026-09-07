// v62.73 顺手清：合格页里那一堆英文小字眉标。
// 它们不走公共 Head，所以 Head 那道闸（有 zh 就不发纯拉丁的 en）管不到——
// 得一处处改（施工规则/no-english-titles.md）。
//
// ⚠️换的时候不硬翻：眉标该说的是【这一栏在干嘛】，
//   把英文原样译回来的那种中文，跟英文一样是装饰。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const R = f => fs.readFileSync("js/" + f, "utf8");
const nocom = x => x.split("\n").map(l => l.split("//")[0]).join("\n");

test("一起学：顶栏走共用 Head，那道闸也就跟着共用了", () => {
  const st = nocom(R("study.js"));
  // ⚠️原来这一页自己手写顶栏，于是「有中文标题就不发纯拉丁的 en」那道闸也自己抄了一份。
  //   v65.14 换成共用 Head 之后，闸只剩 Head 里那一处——这儿改成钉「真的走了 Head」，
  //   闸本身由 no-english-titles 那份测试盯着（一层规则只该住在一个地方）。
  assert.match(st, /return h\(Head, \{/, "一起学又自己写了一条顶栏");
  assert.match(st, /en: props\.en \|\| skin\.label/, "英文副题那一档没交给 Head 判");
  assert.ok(!/\[一-鿿\]/.test(st), "study.js 里又抄了一份那道闸");
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
