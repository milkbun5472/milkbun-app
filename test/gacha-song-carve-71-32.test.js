// 她 2026-09-18：「还有点歌也没接网易云，应该要可以刻到情侣空间唱片」
//
// ⚠️「搜云村 + 刻进唱片」这件事【早就有一支】：discAdd。聊天里 carve 那条能力、
//   唱片架手动加，都从它那儿过。抽卡这边只是没接上（one-public-mechanism）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const app = P("js/app.js"), screens = P("js/screens.js"), gacha = P("js/gacha.js");

const carve = () => {
  const i = app.indexOf("    onGachaCarve: async card => {"), j = app.indexOf("    coupleExDiary:", i);
  assert.ok(i > 0 && j > i, "抠不出 onGachaCarve");
  return app.slice(i, j);
};

test("接的是现成那一支 discAdd，没另写一套搜歌", () => {
  const seg = carve();
  assert.ok(/await discAdd\(c\.id, q,/.test(seg), "抽卡自己另写了一套搜云村的写法");
  assert.ok(!/neteaseSearchOne/.test(seg), "绕过 discAdd 直接搜了——那样封面、去重、存档一样都不会有");
  // discAdd 那一支还在，而且仍旧是它去搜云村、取真歌名真歌手
  assert.match(app, /const discAdd = async \(cid, query, note\) => \{/);
  assert.match(app, /const sr = await neteaseSearchOne\(query, \{ throwOnError: true \}\);/);
});

// ⚠️跟 carve 那条同一个道理：搜不到就什么都没发生，这时候说「刻好了」就是骗她
test("刻上了才盖戳", () => {
  const seg = carve();
  assert.ok(/if \(!sg\) return;/.test(seg), "没搜到也盖戳了——唱片架上根本没有这首");
  assert.ok(seg.indexOf("if (!sg) return;") < seg.indexOf("gachaStamp("), "盖戳排在判定前面");
  assert.ok(/gachaStamp\(card\.id, \{ \.\.\.r, carved: \{ title: sg\.title, artist: sg\.artist/.test(seg),
    "戳上记的不是云村搜回来的真歌名");
});

// 正文里那首歌的名字多半带着书名号、带着一整句话，直接拿去搜什么都搜不到
test("额外要一栏【搜索用】的歌名歌手，而且只对点歌那一张要", () => {
  assert.match(app, /const _gSongAsk = card => card && card\.kind === "song"/);
  assert.match(app, /只写「歌名 歌手」，不要书名号、不要别的话/);
  // 只给点歌那一张：别的券多一个字段就是白让模型多想一件事
  assert.match(app, /: "";/, "_gSongAsk 对别的券该返回空串");
  assert.match(app, /card\.kind === "song"\n\s*\? "\{\\"title\\":\\"一行小标题\\",\\"body\\":\\"正文\\",\\"song\\":\\"歌名 歌手\\"\}"/,
    "schemaHint 没分岔——别的券也被要了 song");
  // 取回来要洗掉书名号和多余空白，不然还是搜不到
  assert.match(app, /replace\(\/\[《》"'\]\/g, " "\)\.replace\(\/\\s\+\/g, " "\)\.trim\(\)\.slice\(0, 60\)/);
});

// 两条路都要有：书房那一支（言秋自己写）和代笔那一支
test("书房那一支也要这一栏，不然只有一半的券刻得成", () => {
  const i = app.indexOf('if (card.act === "make") {'), j = app.indexOf("gachaKeep(char, card.kind, got.title, got.body);\n        return got;", i);
  assert.ok(i > 0 && j > i, "抠不出 make 那一段");
  const seg = app.slice(i, j);
  assert.equal((seg.match(/card\.kind === "song" \? \{ song:/g) || []).length, 2, "两条路里有一条没取 song");
  assert.ok(seg.includes("expect: _gSongExpect(card)"), "书房那一支的 expect 没跟着分岔");
  assert.ok((seg.match(/_gSongAsk\(card\)/g) || []).length === 2, "两条路里有一条没加那句要求");
});

test("按钮：刻过了就不再给按钮，改成一行小字", () => {
  const i = screens.indexOf("function GachaCard("), j = screens.indexOf("function Gacha(", i);
  const seg = screens.slice(i, j);
  assert.ok(/res\.song && !res\.carved && onCarve \? h\("button"/.test(seg),
    "刻过还亮着按钮——同一首刻两遍唱片架会去重，看着像没生效");
  assert.ok(seg.includes("刻进我们的唱片"), "没有那颗按钮");
  assert.ok(/res\.carved \? h\("div"/.test(seg), "刻过之后没有任何交代");
  assert.ok(seg.includes("已刻进你俩的唱片 · "), "小字没写清刻的是哪一首");
});

test("那张券自己还是那张券：卡表没被动", () => {
  assert.match(gacha, /\{ id: "s_song",\s+r: "SR", act: "make", kind: "song"/);
  // 卡表里不许出现云村/搜索这类实现细节——那是 app 那头的事
  const i = gacha.indexOf('{ id: "s_song"'), j = gacha.indexOf('{ id: "s_look"', i);
  assert.ok(!/netease|云村|搜索/.test(gacha.slice(i, j)), "卡表沾上了实现细节");
});

test("一路传下去了，没在半道掉一层", () => {
  assert.ok(app.includes("onGachaCarve: async card"), "app 那头没有");
  assert.ok(/onGachaTitle, onGachaShoot, onGachaCarve, land,/.test(screens), "Us 的参数表里没接住");
  assert.ok(screens.includes("onCarve: onGachaCarve"), "没传给 Gacha");
  assert.equal((screens.match(/onCarve: onCarve/g) || []).length, 2, "两处 GachaCard 里有一处没传");
  assert.ok(/function GachaCard\(\{ card, busy, onRedeem, onShow, onTitle, onShoot, onCarve,/.test(screens), "GachaCard 没收这个参数");
});
