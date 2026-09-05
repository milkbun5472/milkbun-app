// v62.60 审美审计（2026-09-04）里剩下的三处整页白卡：照片详情、微信联系人详情、
// 小红书关注。它们的病跟半窗那七处不一样——不是「没地方放题材元素」，
// 而是【放了通用元素】：白底 + 圆角缩略图 + 灰色圆角卡 + 一排圆角卡列表。
//
// ⚠️查手机这一层的判据跟别处不一样：它仿的是真 app，**仿得像本尊就算合格**。
// 所以这三处的改法不是「设计一套新的」，是【往本尊靠】：
//   · iOS 相册点开一张照片 = 黑底、照片满幅（白底加圆角缩略图恰恰是本尊不会做的）
//   · 微信联系人页 = 分组 cell（几块白，块间空一段灰，行间一道发丝线）
//   · 小红书关注页 = 一整块白纸上一行一个人，右边永远挂一枚「已关注」描边胶囊
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const SRC = fs.readFileSync("js/phone.js", "utf8");
const NOC = SRC.split("\n").map(l => l.split("//")[0]).join("\n");

test("照片详情：黑底满幅，不是白底圆角缩略图 + 灰卡", () => {
  const p = NOC.slice(NOC.indexOf("if (photo) return h("), NOC.indexOf("if (opened)") > 0 ? NOC.indexOf("if (opened)") : NOC.indexOf("const grid = "));
  assert.match(p, /style: \{ background: "#000" \}/);
  assert.match(p, /aspectRatio: "1 \/ 1\.12", overflow: "hidden" \} \}, art\(photo, 0, true\)\)/);
  assert.doesNotMatch(p, /borderRadius: 20, overflow: "hidden", boxShadow/);
  assert.doesNotMatch(p, /borderRadius: 17, background: "#f2f2f7"/);
  // 满幅之后不许再往图上烧那行说明——底下已经有大标题了
  assert.match(NOC, /const art = \(it, radius, bare\) =>/);
  assert.match(NOC, /bare \? null : h\("span"/);
  // ⚠️收藏键必须还在（改版时差点连着灰卡一起删掉，靠测试拦下的）
  assert.match(p, /onClick: \(\) => toggle\(photo\)/);
});

test("微信联系人：分组 cell，不是灰底上一张白圆角卡", () => {
  // ⚠️别拿「另一个分支」当结束位置：!== "contact" 那一支在文件里排在前面，
  //   那样切出来是空串，断言就成了永远绿的空转。
  const st = NOC.indexOf('if (thread && thread.type === "contact") {');
  const w = NOC.slice(st, NOC.indexOf("\n  if (", st + 10));
  assert.ok(w.length > 200, "找不到联系人详情");
  assert.match(w, /background: "#ededed"/, "分组页的底是微信那块灰");
  assert.match(w, /borderTop: last === "first" \? "none" : "1px solid #ededed"/, "行间那道发丝线没了");
  assert.doesNotMatch(w, /borderRadius: 8, padding: "18px"/, "又变回一张白圆角卡了");
  // 按了没反应的按钮比没有按钮更糟：只有真有会话时才给「发消息」
  assert.match(w, /sess \? h\("button"/);
  assert.match(w, /color: "#07c160"/);
});

test("微信内页的返回键有 40px 可点区，箭头是画出来的", () => {
  // 原来是一个 26px 的「‹」字符，可点区就那几个像素（mobile-ui-layout §1）
  const ih = NOC.slice(NOC.indexOf("const innerHead = (title, sub, back)"), NOC.indexOf("const innerHead = (title, sub, back)") + 900);
  assert.match(ih, /width: 40, height: 40/);
  assert.match(ih, /d: "M9 1\.5 2 10l7 8\.5"/);
  assert.doesNotMatch(ih, /fontSize: 26, lineHeight: 1, color: t\.ink \} \}, "‹"\)/);
});

test("小红书关注：一整块白纸 + 已关注胶囊，不是一排圆角卡", () => {
  const f = NOC.slice(NOC.indexOf("const followPage = follows.length"), NOC.indexOf("他谁也没关注"));
  assert.ok(f.length > 200, "找不到关注页");
  assert.match(f, /borderTop: i \? "1px solid #f0f0f2" : "none"/);
  assert.match(f, /"已关注"/, "那枚胶囊就是「这是关注列表」而不是「这是通讯录」的全部区别");
  assert.doesNotMatch(f, /borderRadius: 14, padding: "14px 15px", marginBottom: 10/);
});
