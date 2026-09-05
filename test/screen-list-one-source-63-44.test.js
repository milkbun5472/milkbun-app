// 秋秋在每一页都要答得上「这一页是干嘛的」，而「能给哪几页写 CSS」也是她问的
// 那半个问题（她 2026-09-05：「实际可更改权限还包括生成 css 皮肤」）。
//
// 病：这两件事各存了一份页名单——
//   主题工作台手写了【十页】，而作用域机制 html[data-lisa-screen="<screen>"]
//   是每一页都自带的，十页是名单的限制不是能力的限制；
//   秋秋那份有【五十页】，还漏了 musiccard、codex 留空。
//   于是「秋秋知道你正开着查手机，却没法给查手机写样式」。
// 治：core.js 一份 SCREEN_ZH，两处都从它派生。这条测试是那道闸。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const R = f => fs.readFileSync(path.join(root, "js", f), "utf8");
const core = R("core.js"), app = R("app.js"), ts = R("theme-studio.js"), asst = R("assistant.js"), manSrc = R("assistant-manual.js");
const grab = (src, head, tail) => {
  const i = src.indexOf(head), j = src.indexOf(tail || "\n};", i);
  assert.ok(i >= 0 && j > i, "切不到：" + head);
  return new Function("return " + src.slice(i + head.length - 1, j + (tail || "\n};").length))();
};
const SCREEN_ZH = grab(core, "const SCREEN_ZH = {");
const SCREEN_NOTE = grab(core, "const SCREEN_NOTE = {");
const SCREEN_MAN = grab(asst, "  const SCREEN_MAN = {", "\n  };");
const MAN = (() => { const g = {}; new Function("window", manSrc)(g); return g.AssistantManual; })();
const routes = [...new Set((app.match(/screen === "[A-Za-z0-9_]+"/g) || []).map(x => x.slice(12, -1)))];

test("页名单跟 app 真有的那些页一一对上，多一个少一个都红", () => {
  assert.ok(routes.length >= 50, "路由抓少了：" + routes.length);
  assert.deepEqual(routes.filter(r => !SCREEN_ZH[r]).sort(), [], "有页没进名单——秋秋在那儿会一个字都说不出");
  assert.deepEqual(Object.keys(SCREEN_ZH).filter(k => !routes.includes(k)).sort(), [], "名单里有 app 里没有的页");
});

test("名字要短、要能直接说出口——范围提示另走一张表", () => {
  Object.entries(SCREEN_ZH).forEach(([k, v]) => {
    assert.ok(v && v.length <= 12, k + " 这个名字太长，秋秋组不成一句话：" + v);
    assert.ok(!/[（(]/.test(v), k + " 的名字里塞了括号说明，那种话该进 SCREEN_NOTE：" + v);
  });
  // 范围跟名字对不上的那几页
  ["thread", "gthread", "messages"].forEach(k => assert.ok(SCREEN_NOTE[k], k + " 的范围提示没了"));
  Object.keys(SCREEN_NOTE).forEach(k => assert.ok(SCREEN_ZH[k], "SCREEN_NOTE 指着一页不存在的：" + k));
});

test("页面 CSS 覆盖到每一页，不再是手写的十页", () => {
  assert.match(ts, /const PAGES = \[\["all", "全 App"\]\]\.concat\(/, "PAGES 又变回手写名单了");
  assert.match(ts, /Object\.keys\(typeof SCREEN_ZH !== "undefined" \? SCREEN_ZH : \{\}\)/);
  // 旧那份十页的手写名单一行都不许留
  assert.ok(!/\["messages","朋友圈"\]/.test(ts), "旧名单还在（而且把 messages 标成了朋友圈）");
  // 下拉里显示的是「名字（范围提示）」
  assert.match(ts, /SCREEN_ZH\[k\] \+ \(note \? "（" \+ note \+ "）" : ""\)/);
  // 作用域是每一页都自带的那个属性——这条断言钉住「能力本来就有」
  assert.match(app, /document\.documentElement\.setAttribute\("data-lisa-screen", screen \|\| "home"\)/);
  assert.match(ts, /html\[data-lisa-screen="/);
  // 编译是照 pageCSS 的键走的，不是照 PAGES 走——所以扩名单不会漏编
  assert.match(ts, /Object\.entries\(p\.pageCSS \|\| \{\}\)\.forEach/);
});

test("每一页都指得到手册里真有的一条", () => {
  assert.deepEqual(routes.filter(r => !SCREEN_MAN[r]).sort(), [], "有页没挂手册词条");
  Object.entries(SCREEN_MAN).forEach(([k, id]) => {
    assert.ok(id, k + " 的手册词条留空了——她在那一页问「这一页怎么玩」会落空");
    assert.ok(MAN.byId(id), k + " 指着一个手册里没有的词条：" + id);
  });
  // 这两处是这次补上的：一个漏登记、一个被留空
  assert.equal(SCREEN_MAN.musiccard, "listen");
  assert.equal(SCREEN_MAN.codex, "codex");
  assert.ok(MAN.byId("codex"), "攻略自己没有手册词条");
});

test("手册把「CSS 能改哪些页、图标皮肤归谁点」说清楚了", () => {
  const theme = MAN.byId("theme");
  assert.ok(theme, "主题工作台那条没了");
  const txt = theme.what + " " + (theme.how || "");
  assert.match(txt, /每一页都能单独写/, "还写着只能给「某一页」，没说是每一页");
  assert.match(txt, /CSS 装修我也能替你写/, "没说清这件事秋秋能代劳");
  assert.match(txt, /图标皮肤得你自己在这儿点/, "没说清图标皮肤它碰不了——不说就会有人以为它能改");
  // 说到做到：秋秋能动手的确实只有这几样，图标不在里面
  const T = asst.slice(asst.indexOf("  const TARGETS = {"), asst.indexOf("\n  };", asst.indexOf("  const TARGETS = {")));
  ["style:", "persona:", "appearance:", "profile:", "theme:", "memory:"].forEach(k =>
    assert.ok(T.includes("\n    " + k), "能改的少了一样：" + k));
  assert.ok(!/\n    icon/.test(T) && !/appIconList/.test(T), "秋秋伸手去动图标皮肤了");
});

test("子页面：查手机里那二十个、情侣空间那些门，问哪个都翻得出来", () => {
  // ⚠️子页面报不上名（page 只报 screen）：她开着查手机的相册时，
  //   秋秋只知道「她在查手机」。所以里面各是什么得写进手册，
  //   她问「这一页怎么玩」时手上才有答案。
  const apps = MAN.byId("phone_apps"), rooms = MAN.byId("couple_rooms");
  assert.ok(apps && rooms, "两条子页面词条少了一条");
  // 二十个 app 一个都不许漏——照 phone.js 里【真的那份名单】核，不是照我记的
  const phone = R("phone.js");
  const seg = phone.slice(phone.indexOf("const PHONE_APPS = ["), phone.indexOf("const PHONE_DESKTOP_PAGES"));
  const names = [...new Set((seg.match(/zh: "[^"]+"/g) || []).map(x => x.slice(5, -1)))];
  assert.ok(names.length >= 20, "查手机的 app 名单抓少了：" + names.length);
  // ⚠️必须落在 what（那句「它是什么」）里，不是「在 kw 里出现过就算」——
  //   只在检索词里有的话，翻是翻得到，翻出来的那段却没说它是干嘛的
  names.forEach(n => assert.ok(apps.what.includes(n),
    "手册里没说查手机的「" + n + "」是干嘛的"));
  assert.ok((apps.kw || []).length >= 20, "检索词太少，她直接说某个 app 的名字会翻不到");
  // 情侣空间那些门同理，照 screens.js 里真的分支核
  const scr = R("screens.js");
  const us = scr.slice(scr.indexOf("function Us({"));
  // ⚠️别写成 /sub === "\w+"/：那会把别处的 `cv.sub === "rec"` 也算成一扇门
  const subs = [...new Set((us.match(/(?<![.\w])sub === "(\w+)"/g) || []).map(x => x.slice(9, -1)))];
  assert.ok(subs.length >= 18, "情侣空间的门抓少了：" + subs.length);
  const ZH = { album: "合照", anniv: "我们的日子", archive: "我们的档案", capsule: "时光胶囊",
    disc: "唱片", drawer: "抽屉", exdiary: "交换日记", firsts: "第一次", gacha: "抽卡",
    garden: "花房", ifroom: "如果馆", letters: "情书", makeup: "和好间", pacts: "说好的",
    qa: "问答小本", recall: "他记得的", studio: "照相馆", timeline: "我们的日子",
    trip: "旅行", wishes: "愿望板" };
  subs.forEach(k => {
    assert.ok(ZH[k], "情侣空间多出一扇门「" + k + "」，手册这条得跟着补");
    assert.ok(rooms.what.includes(ZH[k]), "手册里没说这扇门是干嘛的：" + ZH[k]);
  });
  // 检索得到：她直接说「外卖」「花房」的时候要能翻出来
  assert.ok(MAN.find("外卖这一页怎么玩", 4).some(x => x.id === "phone_apps"));
  assert.ok(MAN.find("花房是干嘛的", 4).some(x => x.id === "couple_rooms"));
});
