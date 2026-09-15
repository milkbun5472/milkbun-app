const assert = require("assert");
const G = require("../js/group-identity-guard.js");
const members = [{ id: "a", name: "顾朝" }, { id: "b", name: "顾暮" }];

assert.deepEqual(G.aliases(members[0]), ["顾朝", "阿朝"]);
assert.equal(G.selfVocative("哎呀阿朝，你怎么又来了", members[0]), true);
assert.equal(G.selfVocative("阿暮，你看看这个", members[0]), false);

const out = G.sanitize([
  { name: "Lisa", text: "哎呀阿朝" },
  { name: "不存在的人", text: "我来说一句" },
  { name: "顾朝", text: "哎呀阿朝，你又这样" },
  { name: "顾朝", text: "阿暮，你看看", thought: "哎呀阿朝，真拿他没办法" },
  { name: "顾暮", text: "行，我看看" }
], members, "Lisa");

assert.deepEqual(out.items.map(x => x.name), ["顾朝", "顾暮"]);
assert.equal(out.items[0].thought, undefined, "仅 thought 串线时保留正常气泡、丢掉错心声");
assert.equal(out.dropped.length, 3, "用户、陌生名字、自称呼三种串线都不落盘");
assert.equal(out.thoughtsDropped.length, 1);

assert.deepEqual(G.splitBubbles("第一句。第二句！\n第三句？"), ["第一句。", "第二句！", "第三句？"]);
assert.deepEqual(G.splitBubbles("一句里有逗号，但仍然完整"), ["一句里有逗号，但仍然完整"]);
assert.deepEqual(G.splitBubbles("先等等……我想想。"), ["先等等……", "我想想。"]);

console.log("group identity guard tests passed");

// 她 2026-09-15：「群聊那个提醒说漏嘴的 toast 也去掉吧宝宝，一直误报」。
// 守卫照旧拦，只是不再弹到她眼前：被拦掉的那条本来就不会出现在屏幕上，
// 弹出来只是一句她看不懂的报警。想知道拦了什么，看这份测试，别加 toast。
{
  const app = require("fs").readFileSync("js/app.js", "utf8");
  const live = app.split("\n").map(l => l.split("//")[0]).join("\n");
  assert.ok(live.indexOf("条群聊身份串线") < 0, "那句误报的 toast 又被加回来了");
  assert.ok(app.indexOf("window.GroupIdentityGuard.sanitize(arr, members, userName(profile))") > 0,
    "守卫本身不能跟着 toast 一起被删掉——拦是要拦的，只是别吱声");
}
