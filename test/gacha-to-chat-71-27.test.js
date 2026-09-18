// 她 2026-09-18：「宝宝用了这些券之后没办法发到他聊天啊」
//
// 抽卡券兑完只是一张卡片，角色完全不知道发生过。双面券尤其怪：券是他给的，他却不认。
// ⚠️不新开一条转发路：翻手机、翻随身物、掉马券早就共用 forwardPhonePeekToChat
//   （one-public-mechanism）。原来那条链只接了掉马券一张，这次把它接全。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const app = P("js/app.js"), comp = P("js/components.js"), screens = P("js/screens.js");

const show = () => {
  const i = app.indexOf("    onGachaShow: card => {"), j = app.indexOf("    coupleExDiary:", i);
  assert.ok(i > 0 && j > i, "抠不出 onGachaShow");
  return app.slice(i, j);
};

test("接的是现成那条链，没另开一条转发路", () => {
  assert.ok(show().includes("forwardPhonePeekToChat(c, {"), "抽卡自己另写了一套发进聊天的写法");
  // 全库只有这一处在造 phonepeek 消息
  assert.equal((app.match(/kind: "phonepeek"/g) || []).length, 1, "又多出一处自己拼 phonepeek 的地方");
});

// ⚠️这一条是这次的要害：不是所有券都该走同一种戏
test("掉马券照旧是「被撞破」，其余的券是「他给的」", () => {
  const seg = show();
  assert.ok(/if \(r\.where === "drop"\) \{/.test(seg), "掉马券那一路被合并掉了");
  assert.ok(/tier: "quiet", what: "东西", lead: "\[我手上有这个\]"/.test(seg), "掉马券的戏改了");
  assert.ok(/tier: "given"/.test(seg), "别的券没有自己的那一档");
});

// given 不是 open 的同义词：open 的前提仍是【她那头看到的】，
// given 是【他自己给出去的】。混在一起，TA 会往「你怎么知道」上演。
test("given 单开一档，而且明说别往被撞破那边演", () => {
  const i = app.indexOf("const phonePeekTag = (tier, what, hiddenWhat) =>");
  const j = app.indexOf("}[tier]);", i);
  assert.ok(i > 0 && j > i, "抠不出 phonePeekTag");
  const tag = app.slice(i, j);
  assert.ok(/given: "｜（这是TA自己给她的/.test(tag), "given 那一档没了");
  assert.ok(tag.includes("不是她翻到的"), "没说清它跟 quiet 的分界");
  assert.ok(tag.includes("别往「被撞破」或者「你怎么知道」那边演"), "没给出反面，模型会滑回默认那一档");
  // 白名单放行了才算数——不然它会被静默降级成 quiet
  assert.match(app, /\["given", "open", "quiet", "hidden"\]\.includes\(peek\.tier\)/, "白名单没放行，given 会被降级成 quiet");
});

test("卡面上那行小字也要跟着改口", () => {
  assert.match(comp, /p\.tier === "given" \? characterText\(character, "他给的"\)/,
    "写成「翻他东西」等于当着她的面把这件事说反了");
});

test("按钮：有正文才出现，落了档的那几张也照样给", () => {
  const i = screens.indexOf("function GachaCard("), j = screens.indexOf("function Gacha(", i);
  assert.ok(i > 0 && j > i, "抠不出 GachaCard");
  const seg = screens.slice(i, j);
  assert.ok(seg.includes("拿去跟他说"), "没有那颗按钮");
  assert.ok(/res\.where !== "drop" && onShow && \(res\.title \|\| res\.body \|\| res\.track \|\| res\.scene\)/.test(seg),
    "没正文也摆按钮，点下去发出去的是空话");
  // 掉马券那颗照旧是它自己那句
  assert.ok(seg.includes("摆到他面前问问"), "掉马券那颗被顶掉了");
});

test("幕后那一轨要一起带过去", () => {
  const seg = show();
  // 正文是场里的他、幕后是场外的他；只带正文会把这张券最好玩的落差抹平
  assert.ok(/r\.track \? "（幕后）" \+ r\.track : ""/.test(seg), "幕后那一轨没带上");
  assert.ok(/\[r\.body,[^\]]*r\.scene\]\.filter\(Boolean\)/.test(seg), "合照券那段场景没带上");
});
