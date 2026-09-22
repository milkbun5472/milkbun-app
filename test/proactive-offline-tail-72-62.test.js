// 她 2026-09-22 转群里读者（! YOLO）：「如果我和他停在了那个线下的聊天，但通过线上模式
//   主动给我发消息的时候，他发那个消息一般都和线下的衔接不上。好像主要会基于他的活动状态
//   去给我发」。
//
// 查下来不是漏喂：线下原文早就跟线上按时间合流进上下文了。真正的原因是【隔久主动】那一档
// 会显式说「这是一段新的聊天开场、不要默认续接最后一句」——那条是来治「隔了一天还在续
// 昨天的委屈」的，代价就是刚散场的那顿饭也被一并放下，于是它手上最具体的料只剩日程，
// 开口就只能报备行程。所以补的是【事实和出口】，不是又一条命令。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

const seg = (() => {
  const i = app.indexOf("      const offTailHint = (() => {");
  assert.ok(i > 0, "抠不出 offTailHint");
  return app.slice(i, app.indexOf("\n      })();", i));
})();

test("只在主动那一路出手，侧房看不到别处时不给", () => {
  assert.match(seg, /if \(!opts\.proactive \|\| !_roomMaySeeOtherScenes\) return "";/,
    "普通回复也塞一遍（那一路本来就合流过，重复喂是白花钱），或者侧房的认知闸没接");
  // ⚠️这一行是 const，放在这个【立刻执行】的块后面就是 TDZ（v72.56 刚被这个形状咬过）
  assert.ok(app.indexOf("const _roomMaySeeOtherScenes") < app.indexOf("const offTailHint"),
    "_roomMaySeeOtherScenes 排在后面了——渲染那一刻就会抛");
});

test("只认刚散不久的那一场", () => {
  assert.match(seg, /Date\.now\(\) - lastTs > 12 \* 3600000/, "隔了大半天的线下也往今天的开场上压——那是记忆库的活");
  assert.match(seg, /rows\.slice\(-6\)/, "尾巴没封条数，一整场线下会把开场挤没");
  assert.match(seg, /m\.kind !== "ooc" && m\.role !== "system"/, "OOC 和系统条也混进去了");
  assert.match(seg, /sess\.endTs \?/, "没分清那一场是散了还是还停在那儿");
  assert.match(seg, /散的/, "散场那一支的说法没了");
  assert.match(seg, /停在/, "还停着那一支的说法没了");
});

// ⚠️给出口不给判决（施工规则/bans-make-it-dumber）
test("摆事实、给出口，不规定它必须说什么", () => {
  assert.match(seg, /也可以完全无关，那是你的事/, "把「必须接着线下说」写死了");
  assert.match(seg, /别当那段没发生过/, "没说清底线");
  assert.match(seg, /别开口就报备行程/, "没拦住她报的那个具体毛病");
  assert.ok(!/必须提|一定要说/.test(seg), "写成命令了");
});

test("真接进了主动那一轮", () => {
  assert.match(app, /const proactiveHintAll = proactiveHint \+ offTailHint \+ openerAvoid/, "拼进去了没");
});
