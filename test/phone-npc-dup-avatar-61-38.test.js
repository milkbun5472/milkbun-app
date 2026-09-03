// 她 2026-09-03 一次报了四件，全在【查手机·微信】这一块：
//   ①「已有npc头像会变成他自己的」
//   ②「npc还是会重复比如程策和程校尉」（外加陆闻出现两次）
//   ③ toast 说「萧成烨发了条朋友圈」，可他只是 NPC
//   ④「我看我的朋友圈…也没有这条记录」
// ③④ 是同一个病的两头：存进去了、界面认不出、只剩一条假 toast。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const { phoneDropDupWechat, phoneSamePerson } = require(path.join(root, "js/phone.js"));

const slice = (src, from, to, what) => {
  const i = src.indexOf(from);
  assert.ok(i > 0, "抠不出" + what + "：起点没了");
  const j = src.indexOf(to, i);
  assert.ok(j > i, "抠不出" + what + "：终点没了");
  return src.slice(i, j);
};

test("① 群头像的兜底不许挑到机主自己", () => {
  const seg = slice(app, "      const spectatePrivate = isSpectate", "      if (spectatePrivate) {", "群会话那一段");
  // 病根：兜底是「从 memberIds 里挑第一个有头像的」，而机主自己几乎总排在最前面，
  // 于是他手机里每个群的头像都是他自己。挑之前必须先把自己滤掉。
  assert.match(seg, /memberIds\.filter\(id => id !== char\.id\)/, "没把机主自己从候选里滤掉");
  assert.doesNotMatch(seg, /groupAvatar = group\.avatarImage \|\| group\.avatar \|\| \(memberIds\.map/,
    "群头像还在从整个 memberIds 里挑——第一个多半就是他自己");
  // 两人旁观房那一路是另一条分支：找不到对方时会掉进 groupAvatar，所以那条也得是干净的
  assert.match(seg, /avatarImage: spectatePrivate && other \? other\.avatarImage : groupAvatar/,
    "两人私聊没用对方的头像");
});

test("② 群里的真人要进避重名单——这一层写在两处，两处都得在", () => {
  // 生产端：群会话上挂出成员的所有叫法
  const seg = slice(app, "      const spectatePrivate = isSpectate", "      if (spectatePrivate) {", "群会话那一段");
  const key = (seg.match(/(\w+): others\.reduce/) || [])[1];
  assert.ok(key, "群会话没把成员名字挂出来");
  // 消费端：避重名单要真的读那一栏。⚠️名字对不上就等于没接——
  // 所以这里从生产端把栏名抠出来再去查，不写死字面量。
  const taken = slice(app, "  const phoneTakenNames = char => {", "\n  };", "phoneTakenNames");
  assert.ok(taken.includes("c." + key), "phoneTakenNames 没读群成员那一栏（生产端叫 " + key + "）");
  // 群名不是人名，不许混进避重名单
  assert.match(taken, /if \(c\.type === "group"\) return;/, "群会话名又被当成人名收进去了");
});

test("② 收进名单之后，假的那条私聊真的会被筛掉", () => {
  // phoneDropDupWechat 本来就会筛，缺的一直是「陆闻从来没进过 taken」。
  const d = { chats: [
    { type: "private", name: "陆闻", last: "假的" },
    { type: "group", name: "望江楼吃羊闲聊班", last: "真群" },
    { type: "private", name: "户部李郎中", last: "真 NPC" }
  ] };
  const out = phoneDropDupWechat(d, ["陆闻"]);
  assert.deepEqual(out.chats.map(c => c.name), ["望江楼吃羊闲聊班", "户部李郎中"],
    "该掉的没掉，或者把群/别的 NPC 误伤了");
});

test("② 存量的重复也要退得出来，不能只筛这一轮新写的", () => {
  const save = slice(app, "  const savePhoneApp = (charId, key, d) => {", "\n    setPhones(p => {", "savePhoneApp 前半");
  assert.match(save, /wxTaken = phoneTakenNames\(c0\)/, "名单没存下来给后面复用");
  assert.match(save, /dropDupWechat\(d, wxTaken\)/, "这一轮新写的没筛");
  // 合并之后再筛一次：名册每次整份重写，所以这一刀能把早就存进去的那条也清掉
  const after = slice(app, "    setPhones(p => {", "      if (key === \"wallet\")", "savePhoneApp 合并那一段");
  assert.match(after, /dropDupWechat\(merged, wxTaken\)/,
    "合并完没再筛一次——早先存进去的假会话会一直被照抄回来");
});

test("③ NPC 不许被推去发朋友圈", () => {
  const seg = slice(app, "  const tickAmbient = (charId, posted) => {", "    posted = posted || {};", "tickAmbient 开头");
  assert.match(seg, /char\.npc/, "没挡 NPC");
  // 群聊那两个调用点是 NPC 进来的路：_spoke 里有谁就 tick 谁
  assert.match(app, /_spoke\.forEach\(id => tickAmbient\(id, \{\}\)\)/, "群聊那条路没了，这条防线也就白设了");
});

test("④ 挡 NPC 的理由：它的朋友圈存了也画不出来", () => {
  // 这一条钉的是【为什么要挡】。界面认不出作者就整条丢掉，
  // 于是 toast 弹了、朋友圈里什么都没有。哪天界面改成认得出 NPC 了，
  // 这条会红，那时才该回去重新想 tickAmbient 那道闸。
  assert.match(comp, /if \(!isMine && !c\) return null;/, "朋友圈不再丢掉认不出作者的动态了");
  assert.match(app, /const liveChars = characters\.filter\(c => c && !c\.npc\);/, "liveChars 的定义变了");
});

test("程策 / 程校尉 这类同人不同叫法，名字比对本来就认不出来", () => {
  // 记一笔免得下次又当成 bug 去改 phoneSamePerson：
  // 「程」是单字，而单字不收（「川」这种谁都能撞上）——放宽它会把同姓的两个人并成一个。
  assert.equal(phoneSamePerson("程策", "程校尉"), false);
  assert.equal(phoneSamePerson("陆闻", "陆闻"), true);
  assert.equal(phoneSamePerson("Prim", "Prim Whitlock"), true);
});
