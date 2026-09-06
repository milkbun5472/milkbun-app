// 她 2026-09-06：「陆衍就提到了沈屿白的羽毛球」——两人不认识、无群、无关系，
// 记忆库和世界书里也没有。
//
// ⚠️病根：crossSamenessBlocklist 把【别人说过的任何一句 6~40 字的话】原样贴进
//   这个角色的提示词，当成一张「别重样」的禁用清单。可那行注释写的是
//   「当作【已经被证明是通用模板】的句子」——**代码从来没验证过那个「已经被证明」**。
//   于是沈屿白私聊里的「刚打完羽毛球」被搬进了陆衍的提示词。
//   原注释还写着「这不是把 A 的私聊漏给 B」。是。
//   ⚠️而且是【负面清单】：跟模型说「别提这个」，它照样会想起这个。
//
// 改法不是再加一道过滤，是把它堵死在结构上：同一句话要被【两个以上不同的角色】
// 说过才算模板。一个人独有的事实，另一个人不可能独立地也说一模一样的一句。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const app = fs.readFileSync(path.resolve(__dirname, "..", "js/app.js"), "utf8");
const SEG = (() => {
  const i = app.indexOf("  // 当作「已经被证明是通用模板」的句子发给本轮"), j = app.indexOf("const crossSamenessHint");
  assert.ok(i > 0 && j > i, "抠不出那一段");
  return app.slice(i, j);
})();

const NOW = Date.UTC(2026, 8, 6, 12, 0, 0);
function load(chats, hist) {
  const sandbox = {
    chatsRef: { current: chats || {} },
    stateHistRef: { current: hist || {} },
    Date: class extends Date { static now() { return NOW; } },
    window: { ChatRooms: { personFromKey: k => String(k).split("::room::")[0] } }
  };
  sandbox.Date.now = () => NOW;
  vm.createContext(sandbox);
  vm.runInContext(SEG + "\nthis.bubbles = crossSamenessBlocklist; this.thoughts = crossThoughtBlocklist;", sandbox);
  return sandbox;
}
// ⚠️vm 里造出来的数组跨 realm，deepEqual 过不了——比字符串（这一课这个仓库交过两次学费）
const J = a => (Array.isArray(a) ? a : Array.from(a || [])).join(" | ");
const say = (t, dt) => ({ role: "assistant", content: t, ts: NOW - (dt || 60000) });
const think = (t, dt) => ({ thought: t, ts: NOW - (dt || 60000) });

test("别人独有的一句私聊原话，绝不许进另一个人的提示词", () => {
  const s = load({ c_shen: [say("刚打完羽毛球，累死了")], c_lu: [say("在忙")] });
  assert.equal(J(s.bubbles("c_lu")), "", "沈屿白的羽毛球漏进陆衍那边了");
});

test("真的通用模板才收：两个以上的人说过同一句", () => {
  const s = load({
    c_shen: [say("早点休息，别熬了")],
    c_jiang: [say("早点休息，别熬了")],
    c_lu: [say("在忙")]
  });
  assert.equal(J(s.bubbles("c_lu")), "早点休息，别熬了", "两个人都说过了，这才是模板");
});

test("除了我自己只剩一个人说过，那也不算被证明", () => {
  // 我说过 + 别人说过一次 = 两条记录，但只有一个「别人」——还不能断定它是通用的
  const s = load({ c_shen: [say("回去收拾你个小坏蛋")], c_lu: [say("回去收拾你个小坏蛋")] });
  assert.equal(J(s.bubbles("c_lu")), "");
  // 再来第三个人说，就算数了
  const s2 = load({ c_shen: [say("回去收拾你个小坏蛋")], c_lu: [say("回去收拾你个小坏蛋")], c_gu: [say("回去收拾你个小坏蛋")] });
  assert.equal(J(s2.bubbles("c_lu")), "回去收拾你个小坏蛋");
});

test("他自己侧房里说过的话不算「别人说的」", () => {
  // ⚠️chats 是按 chatKey 索引的，侧房键是「charId::room::xxx」。
  //   直接拿 id 跟 charId 比，他自己侧房那句会被当成另一个人，凑够两个人就放行了。
  const s = load({ c_lu: [say("我等你消息")], "c_lu::room::night": [say("我等你消息")] });
  assert.equal(J(s.bubbles("c_lu")), "", "把他自己侧房当成别人了");
  assert.match(SEG, /personFromKey/, "没按 chatKey 还原成人");
});

test("半小时之外的、撤回的、系统消息的、她自己说的，一概不收", () => {
  const mk = extra => Object.assign({ role: "assistant", content: "早点休息，别熬了", ts: NOW - 60000 }, extra);
  const both = row => ({ a: [row], b: [row] });
  assert.equal(J(load(both(mk({ ts: NOW - 40 * 60000 }))).bubbles("c_lu")), "", "过了半小时还收");
  assert.equal(J(load(both(mk({ recalled: true }))).bubbles("c_lu")), "", "撤回的还收");
  assert.equal(J(load(both(mk({ kind: "system" }))).bubbles("c_lu")), "", "系统消息还收");
  assert.equal(J(load(both(mk({ role: "user" }))).bubbles("c_lu")), "", "她自己说的话也收进去了");
  // 对照：正常那条要收得到，别把上面几条测成「反正都返回空」
  assert.equal(J(load(both(mk({}))).bubbles("c_lu")), "早点休息，别熬了");
});

test("太短太长都不算模板句", () => {
  const short = say("在忙"), long = say("这句话很长".repeat(12));
  assert.equal(J(load({ a: [short], b: [short] }).bubbles("c_lu")), "");
  assert.equal(J(load({ a: [long], b: [long] }).bubbles("c_lu")), "");
});

test("心声那半也一样：它比气泡更私密", () => {
  // 心声是那个人【没说出口】的东西，漏出去比气泡更糟
  const s = load({}, { c_shen: [think("她今天没提那件事，是不是还在生气")], c_lu: [think("在想别的")] });
  assert.equal(J(s.thoughts("c_lu")), "", "别人的心声漏进来了");
  const s2 = load({}, { c_shen: [think("想把她按住揉一顿")], c_jiang: [think("想把她按住揉一顿")], c_lu: [think("在想别的")] });
  assert.equal(J(s2.thoughts("c_lu")), "想把她按住揉一顿", "全员同款心声该拦住");
  // ⚠️「除了我只剩一个人」那一档，心声这半也要有——只测三个人的话这一档是空转的
  const s3 = load({}, { c_shen: [think("她今天怪怪的，是不是我说错话了")], c_lu: [think("她今天怪怪的，是不是我说错话了")] });
  assert.equal(J(s3.thoughts("c_lu")), "", "除了我只剩沈屿白一个人想过，那还不算通用");
});

test("那句「这不是把 A 的私聊漏给 B」不再作为现行说明存在", () => {
  // ⚠️现在它只出现在病史那一段里，前面带着引号、后面跟着「是。所以那句删掉了」。
  assert.equal((app.match(/这不是把 A 的私聊漏给 B/g) || []).length, 1);
  assert.match(app, /「这不是把 A 的私聊漏给 B」：是。所以那句删掉了/, "得写清它当初错在哪儿");
  assert.match(SEG, /两个以上不同的角色/, "没写清现在的判据");
});
