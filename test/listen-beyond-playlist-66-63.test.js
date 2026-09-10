// 她 2026-09-11 两条：
//  ①「这张卡是你心里的底子…」那句禁令删掉——「有时候又可以接话，应该是模型问题。
//    不然一堆禁令会变笨的」。卡末尾那段守则本来就管着这件事，再加一句是同一件事说两遍。
//  ②「一起听的歌现在是直接把歌单塞进上下文但是不聊歌的时候这块基本上没用，
//    而且只说了他的歌单里有的，我想的是他知道他歌单有啥，但是他也可以推荐新的
//    不在歌单里的根据自己的品味」。
//
// ⚠️查下来【能力一直都在】：songSwitch 在歌单里找不到就会去网易云搜来放（v?? 她要的
//   「他自己搜歌」）。是提示词把他框死的——两处都只报了「歌单里可放的歌」。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.resolve(__dirname, "..", "js/app.js"), "utf8");

test("① 那句多余的禁令删掉了，不是留着再补一句", () => {
  assert.ok(app.indexOf("不是这一轮的话题") < 0, "那句又加回来了");
  assert.ok(app.indexOf("先接住他们刚说的那句") < 0);
  // 真正治病的那一条还得在：卡末尾那段守则不许再被腰斩
  const seg = app.slice(app.indexOf("      gzSeg: (() => {"), app.indexOf("      sbSeg: (() =>", app.indexOf("      gzSeg: (() => {")));
  assert.match(seg, /cap: GROUP_GAZE_CAP/, "封顶又改回整段 slice 了");
  assert.ok(seg.indexOf(".slice(0, GROUP_GAZE_CAP)") < 0);
});

test("② 歌单外的歌也能推：两处都说清了", () => {
  // 切歌那一条
  const sw = app.slice(app.indexOf("const listenHint = isListenPartner"), app.indexOf("// 一起听邀请"));
  assert.match(sw, /\*\*不在歌单里的照样能放\*\*：直接把歌名写进 songSwitch 就行，会去搜。/);
  assert.match(sw, /别被这张单子框住——想放什么按你自己的品味来。/);
  // ⚠️只对着【发出去的那几句】断言：注释里那句是病历，连注释一起匹配的话越写清楚越红
  const swCode = sw.split("\n").map(l => l.split("//")[0]).join("\n");
  assert.ok(swCode.indexOf("歌单里可放的歌") < 0, "「可放的歌」那个说法还在——读起来就是只能从这几首里挑");
  // 上下文那一条
  const ll = app.slice(app.indexOf("    listenLog: (() => {"), app.indexOf("    groupEcho:"));
  assert.match(ll, /\*\*歌单里的和歌单外的都行\*\*——按你自己的品味挑/);
  assert.ok(ll.indexOf("可自然提起其中某首") < 0, "「其中某首」把他框在单子里了");
  // ⚠️能力本来就有：这两句说的不是新功能，是把已有的那条路告诉他
  assert.match(app, /const s = await neteaseSearchOne\(want, \{ throwOnError: true \}\)/, "搜歌那条路没了，那上面两句就成了空头支票");
});

test("② 不聊歌的时候不铺开歌名（十轮里九轮用不上的层不该常驻）", () => {
  const ll = app.slice(app.indexOf("    listenLog: (() => {"), app.indexOf("    groupEcho:"));
  assert.match(ll, /const talkingMusic = \(\(\) => \{[\s\S]{0,400}?MUSIC_TALK\.test/, "没有「这一轮在不在聊音乐」这道闸");
  assert.match(ll, /talkingMusic\s*\n?\s*\?\s*"，里面有："/, "聊到音乐时也不铺歌名了");
  assert.match(ll, /: "（" \+ songs\.length \+ " 首）。"/, "不聊音乐时还在铺整张单子");
  // 正一起听时一定铺开（他得答得出在放什么）
  assert.match(ll, /if \(L\.partnerId === char\.id && player\.songId && player\.songId !== KEEPALIVE_ID\) return true;/);
  // ⚠️不铺名字的那一档绝不许说「你清楚里面有什么」——那正是逼他现编一个「我歌单里那首X」
  // ⚠️同上，只对着发出去的那几句断言（注释里写着这条教训本身）
  const llCode = ll.split("\n").map(l => l.split("//")[0]).join("\n");
  assert.ok(llCode.indexOf("你清楚里面有什么") < 0, "不给名字却说他清楚，等于请他编一个");
});

test("② 那道闸别把「听」这种词算进去", () => {
  assert.match(app, /const MUSIC_TALK = \/歌\|音乐\|专辑\|歌手\|旋律\|唱\|乐队\|playlist\|单曲\|循环\|耳机\|一起听\/i;/);
  const re = /歌|音乐|专辑|歌手|旋律|唱|乐队|playlist|单曲|循环|耳机|一起听/i;
  ["听说他明天来", "你听话", "我听见了"].forEach(t => assert.equal(re.test(t), false, "「" + t + "」不该算聊音乐"));
  ["这首歌真好听", "推首歌", "耳机借我", "在听什么音乐"].forEach(t => assert.equal(re.test(t), true, "「" + t + "」该算聊音乐"));
  // ⚠️常量放在 ctxFor 外面：每轮重编一个正则是白花的
  // ⚠️必须排在 ctxFor 【前面】：排后面就是 TDZ 的形状（这个仓库踩过好几次）
  assert.ok(app.indexOf("const MUSIC_TALK") < app.indexOf("const ctxFor = "), "排到 ctxFor 后面去了——TDZ 的形状");
});
