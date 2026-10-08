// 线下设置照着线上那一套重做（她 2026-10-03）
//
// 她原话：「线下的设置界面也好乱，做跟线上一样好几个 dropdown，群线下也要」
//        「线下的你看看线上那条咋做的直接搬过来」。
//
// 原来两边各是【一个半窗里从头堆到尾十来块】：背景图、三根拉条、长度模式、
//   最低字数、人称、描写开关、本场口味、文风预设、自定义文风、好吃片段库，
//   单人那边最上面还压着一块英文诊断。乱的不是哪一块，是十来块平铺在半屏里。
//
// 搬过来的是线上现成的两件：SettingCatalog（一行一类、右边写着现在什么状态）
//   + SettingSection（折叠小节）。目录原来只长在 ChatSettings 里，这一轮提成
//   公共件，线上一起搬过去（one-public-mechanism：新开公共的，已有的也要搬）。
// 顺带把这两层从半窗改成整页（施工规则/no-half-sheet）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const comp = fs.readFileSync("js/components.js", "utf8");
const live = comp.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
const slice = (a, b) => { const i = live.indexOf(a); const j = live.indexOf(b, i); assert.ok(i >= 0 && j > i, "抠不出 " + a); return live.slice(i, j); };
const SINGLE = slice("const offSetPages = [", "const scroller = useRef(null);");
const GROUP = slice("const gSetPages = [", "const directorNotes = h(DirectorNotesPanel");

test("① 两边都是整页，不是半窗了", () => {
  [["单人线下", SINGLE], ["群线下", GROUP]].forEach(([zh, src]) => {
    assert.ok(!/h\(Sheet, \{ onClose: \(\) => setSetOpen\(false\)/.test(src), zh + "还掀着半窗");
    assert.match(src, /absolute inset-0 z-30 flex flex-col/, zh + "不是整页外壳");
    // 顶栏走公共 Head、底纹铺外壳（施工规则/mobile-ui-layout 3.5：顶栏透上来）
    assert.match(src, /h\(Head, \{/, zh + "自己写了顶栏，没用公共 Head");
    assert.match(src, /style: offlineSubSkin\(t, true\)/, zh + "没铺线下那层公共底");
    assert.match(src, /bg: "transparent"/, zh + "顶栏不透，底纹会在顶上断一条带子");
    // 正文一个主滚动容器
    assert.match(src, /className: "flex-1 min-h-0 overflow-y-auto"/, zh + "正文不是那套滚动层级");
  });
});

test("② 目录是公共件，两边都用它，线上也搬过来了", () => {
  assert.match(live, /function SettingCatalog\(\{ pages, onOpen, note \}\)/, "公共件不见了");
  assert.equal((live.match(/h\(SettingCatalog, \{/g) || []).length, 3,
    "应该正好三处用它：聊天设置 + 单人线下 + 群线下；少一处就是又有人手抄了");
  assert.match(SINGLE, /h\(SettingCatalog, \{ pages: offSetPages/, "单人线下没用目录");
  assert.match(GROUP, /h\(SettingCatalog, \{ pages: gSetPages/, "群线下没用目录");
});

test("③ 每一类都写着现在是什么状态——跟线上同一个做法", () => {
  [["单人线下", SINGLE, "offSetPages"], ["群线下", GROUP, "gSetPages"]].forEach(([zh, src, name]) => {
    const pages = src.slice(src.indexOf("const " + name), src.indexOf("];", src.indexOf("const " + name)));
    const keys = [...pages.matchAll(/\{ key: "([a-z]+)", char: "(.)"/g)];
    assert.ok(keys.length >= 4, zh + "分类太少，等于没分");
    assert.equal(keys.length, [...pages.matchAll(/state: \(\) =>/g)].length, zh + "有几类没写状态那一行");
    // 索引牌一类一个字，撞车就跟线上当初一样一眼分不出谁是谁
    const chars = keys.map(m => m[2]);
    assert.equal(new Set(chars).size, chars.length, zh + "索引牌有重复的字");
  });
});

test("④ 原来那十来块一块都没丢", () => {
  const must = [
    ["场景背景图", SINGLE], ["本场口味", SINGLE], ["单次输出上限", SINGLE],
    ["关联记忆条数", SINGLE], ["带入线上私聊条数", SINGLE], ["高级 · 最低字数目标", SINGLE],
    ["人称", SINGLE], ["让角色描写我的行动", SINGLE], ["吃入文风预设", SINGLE],
    ["自定义文风", SINGLE], ["好吃片段库", SINGLE], ["上一轮到底发生了什么", SINGLE],
    ["场景背景图", GROUP], ["本场口味", GROUP], ["入场前群聊条数", GROUP],
    ["关联记忆条数", GROUP], ["单次输出上限", GROUP], ["输出下限（约字数）", GROUP],
    ["吃入文风预设", GROUP], ["自定义文风", GROUP], ["让角色描写我的行动", GROUP]
  ];
  must.forEach(([zh, src]) => assert.ok(src.includes('"' + zh + '"'), "少了这一节：" + zh));
  // 控件本身也得跟着搬，不是只剩标题
  assert.match(SINGLE, /h\(OfflineTastePanel, \{/, "单人线下的本场口味只剩标题");
  assert.match(SINGLE, /h\(Slider, \{ value: sMemN/, "记忆那根拉条没搬过来");
  assert.match(GROUP, /h\(Slider, \{ value: sOnlineN/, "群聊条数那根拉条没搬过来");
  assert.match(SINGLE, /h\(OfflineStylePresetSection, \{/, "预设台那一节没搬过来");
});

test("⑤ 返回要分两级：在某一类里就退回目录，不是直接关掉", () => {
  [["单人线下", SINGLE, /if \(offSetTab\) \{ setOffSetTab\(""\); setOffSec\(""\); \} else setSetOpen\(false\)/],
   ["群线下", GROUP, /if \(gSetTab\) \{ setGSetTab\(""\); setGSec\(""\); \} else setSetOpen\(false\)/]]
    .forEach(([zh, src, re]) => assert.match(src, re, zh + "的返回没分两级"));
});

test("⑥ 保存那颗 ✓ 还在，存的东西一样没少", () => {
  assert.match(SINGLE, /onSaveSettings\(\{ presetOn, presetId, maxTokens: sMax, minWords: sMinW, lengthMode: sLengthMode, memN: sMemN, onlineCtxN: sOnlineN, selfP: sSelf, userP: sUser, describeMe: sDesc/,
    "单人线下保存少存了字段");
  assert.match(GROUP, /onSaveSettings\(\{ presetOn, presetId, maxTokens: sMax, minWords: sMinW, lengthMode: sLengthMode, memN: sMemN, onlineCtxN: sOnlineN, bg: sBg, describeMe: sDesc/,
    "群线下保存少存了字段");
});
