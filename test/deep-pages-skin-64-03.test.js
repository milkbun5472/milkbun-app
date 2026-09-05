// 装修工单第二批（她 2026-09-05：「继续吧宝宝。games跑团你也弄，没有禁令了」）。
//
// 撤了禁令之后先去看了 games 和跑团，结论是两边不一样：
//   · games.js **早就做完了**——柜子、开局、每个引擎的对局/加载/出错页，
//     全走 gameTable。工单上那一行是过期的。所以这里改成【钉住】它，别哪天被谁改平。
//   · trpg.js 只有一处漏了：舆图那一层写死 t.bg，桌面那层纹理一开舆图就掉回平色。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const map = R("map.js"), trpg = R("trpg.js"), read = R("read.js"), games = R("games.js");
const strip = s => s.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

test("好友地图那三层子页共用一份底，不是三份", () => {
  const code = strip(map);
  assert.match(code, /function mapSubSkin\(t\) \{/);
  assert.equal((code.match(/style: mapSubSkin\(t\)/g) || []).length, 3,
    "一处地点 / 加个地点 / 开一个世界，三处都得吃到");
  assert.ok(!/zIndex: 140, display: "flex", flexDirection: "column", background: t\.bg \}/.test(code),
    "还有一层留着平色的老写法");
  const fn = code.slice(code.indexOf("function mapSubSkin(t)"), code.indexOf("function mapSubSkin(t)") + 500);
  assert.match(fn, /pageSkin\("grid", t, \{ strength: \.9 \}\)/, "地图的子页该是坐标纸");
  assert.match(fn, /position: "fixed", inset: 0, zIndex: 140/, "定位那几项丢了，页面会塌回文档流");
  assert.match(fn, /: \{ background: t\.bg \}/, "没兜底：pageSkin 没加载就整页透明");
  // 顶栏透上来，底纹才铺得到刘海（mobile-ui-layout §3.5）
  assert.equal((map.match(/bg: "transparent"/g) || []).length, 3, "三层的顶栏都得透明");
});

test("跑团的舆图跟这一桌是同一张桌子", () => {
  const code = strip(trpg);
  assert.match(code, /zIndex: 130, background: deskBg, display: "flex", flexDirection: "column"/,
    "舆图还写死 t.bg——一开舆图，桌面那层纹理就掉回平色");
  assert.ok(!/zIndex: 130, background: t\.bg,/.test(code));
  // ⚠️deskBg 得是同一个闭包里那一份（跟着时辰走），不许另算一遍
  assert.equal((code.match(/const deskBg = trpgDeskBg\(/g) || []).length, 1, "deskBg 又被算了第二份");
  // 顶栏 S.top 是【为了压在桌面上】才做成半透白的：桌面没了它就不成立
  assert.match(code, /background: "rgba\(255,255,255,\.30\)", backdropFilter: "blur\(10px\)"/);
});

test("一起读的讨论页铺纸——不是站在书架前，是就着摊开那一页说话", () => {
  const code = strip(read);
  const i = code.indexOf('zIndex: 45, display: "flex", flexDirection: "column" } }');
  assert.ok(i > 0, "找不到讨论页");
  const seg = code.slice(i, i + 420);
  assert.match(seg, /pageSkin\("paper", t, \{ corner: false, strength: \.9 \}\)/);
  assert.ok(!/flex: 1, minHeight: 0, background: t\.bg, display: "flex"/.test(seg), "还留着平色");
});

test("小游戏那边【已经做完了】——钉住，别哪天被改平", () => {
  // 每一个整页外壳都得带底：柜子那一页用 cab，别的一律 gameTable。
  // ⚠️别在逗号处切：好几处是 Object.assign({ position: "relative" }, table)，
  //   切到逗号就只剩前半截，会误判成「没带底」。往后多取一段再看。
  const shells = games.match(/className: ?"h-full flex flex-col", ?style: ?[\s\S]{0,90}/g) || [];
  assert.ok(shells.length >= 18, "对局页少了？只找到 " + shells.length + " 个外壳");
  shells.forEach(function (s) {
    assert.ok(/gameTable\(|\btable\b|\bcab\b/.test(s), "这一页外壳没带底：" + s.slice(0, 90));
  });
  // 桌布本身那几条前提别被拆了
  assert.match(games, /function gameTable\(k, t\) \{/);
  assert.match(games, /if \(!\/\^#\[0-9a-fA-F\]\{6\}\$\/\.test\(String\(t\.ink \|\| ""\)\)\) return \{ backgroundColor: t\.bg \};/,
    "拼透明度后缀之前那道色号校验没了（深色主题会整块底静默消失）");
  assert.equal((games.match(/h\(Head, ?\{ ?zh: ?"大富翁"[^}]*bg: ?"transparent"/g) || []).length, 3,
    "大富翁那几页顶栏没透明");
});
