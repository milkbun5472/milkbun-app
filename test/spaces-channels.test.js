// 频道（她 2026-11-20：「放聊天右上角＋里面创建频道，样式参考 Teams」）：频道空间外面一层，底下每个频道就是一个群
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm"), path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = read("app.js"), comp = read("components.js"), engine = read("engine.js");
const slice = (src, from, to) => src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)));
test("频道是普通的群多挂 spaceId/chName/chAbout，建空间先开一个 #综合", () => {
  const c = slice(app, "const createChannel = ", "const createSpace = ");
  assert.match(c, /spaceId: sp\.id, chName:/);
  assert.match(c, /saveJSON\("x_groups", n\)/);
  assert.match(slice(app, "const createSpace = ", "const saveChannel = "), /createChannel\(sp, "综合"/);
  assert.match(app, /saveJSON\("x_spaces", n\)/);
});
test("消息列表：频道里的群不单独占行，整个空间一行；＋里有创建频道", () => {
  assert.match(comp, /groups\.filter\(g => !g\.roomOf && !g\.spaceId\)/);
  assert.match(comp, /type: "space", sp, chs, last/);
  assert.match(comp, /it\.type === "space" \? renderSpaceRow\(it\)/);
  assert.match(comp, /\["创建频道", /);
});
test("频道里的群返回空间首页；删频道也回空间首页", () => {
  assert.match(app, /if \(activeGroup\.spaceId && \(spaces \|\| \[\]\)\.some\(x => x\.id === activeGroup\.spaceId\)\) \{ setActiveSpaceId\(activeGroup\.spaceId\); setScreen\("space"\);/);
  assert.match(slice(app, "const deleteGroup = ", "const groupSysLine"), /self && self\.spaceId/);
});
test("spaceChannelBlock：说这个频道聊什么，再摆别的频道最近两句；不是频道就是空", () => {
  const src = slice(engine, "function spaceChannelBlock(", "function groupNoticeBlock(");
  const f = vm.runInNewContext("(" + src + ")");
  assert.equal(f({ id: "g1" }, [], () => []), "");
  const gs = [{ id: "a", spaceId: "s", chName: "综合", chAbout: "什么都聊" }, { id: "b", spaceId: "s", chName: "深夜", chAbout: "睡不着来这儿" }, { id: "c", spaceId: "x", chName: "别处" }];
  const chats = { b: [{ role: "assistant", senderName: "阿屿", content: "还醒着？" }, { role: "user", content: "嗯" }] };
  const out = f(gs[0], gs, id => chats[id] || [], "小麦");
  assert.match(out, /「#综合」：什么都聊/);
  assert.match(out, /#深夜（睡不着来这儿）　最近：阿屿：还醒着？／小麦：嗯/);
  assert.doesNotMatch(out, /别处/);
  // 群线上、群线下都接上
  assert.match(app, /groupNoticeBlock\(gsFor\(groupId\)\.notice\)\s*\+ spaceChannelBlock\(/);
  assert.match(app, /spaceBlock: spaceChannelBlock\(group && spaceSibs\(\)/);
  assert.match(engine, /\(ctx\.spaceBlock \|\| ""\) \+/);
});
test("SpaceView 渲染：一行一个频道，带说明、最后一句、未读点和新频道那一行", () => {
  const src = ["spaceTone", "SpaceTile", "channelLast", "SpaceView"].map(n => slice(comp, n === "spaceTone" ? "const SPACE_TONES" : "function " + n + "(", n === "SpaceView" ? "function NewGroupSheet(" : (n === "spaceTone" ? "function SpaceTile(" : n === "SpaceTile" ? "function channelLast(" : "function NewSpacePage("))).join("\n");
  const h = (type, props, ...kids) => ({ type, props: props || {}, kids: kids.flat(Infinity).filter(x => x != null && x !== false) });
  const ctx = { h, useState: v => [v, () => {}], useTheme: () => ({ ink: "#111", sub: "#555", fog: "#999", line: "#ddd", bg: "#fff", bg2: "#fff", accent: "#46c" }), msgAppBg: () => ({}), wxGrey: () => "#f7f7f7", momPaper: () => "#fff", Head: "Head", Avatar: "Avatar", IPlus: "IPlus", ChannelEditPage: "ChannelEditPage", SpaceGemsPage: "SpaceGemsPage", F_BODY: "s", F_DISPLAY: "s", fmtStamp: () => "1分钟前", window: {} };
  vm.createContext(ctx);
  { const en = require("fs").readFileSync(__dirname + "/../js/engine.js", "utf8"); vm.runInContext(en.slice(en.indexOf("const CH_ACTIVE_MAX"), en.indexOf("function chHopTargets(")), ctx); }   // 真的那份分段（engine.js）
  vm.runInContext(src + ";this.SpaceView=SpaceView;", ctx);
  const tree = ctx.SpaceView({ space: { id: "sp_1", name: "夜猫子", memberIds: ["c1"] }, channels: [{ id: "a", chName: "综合", chAbout: "什么都聊", createdTs: 1 }, { id: "b", chName: "深夜", createdTs: 2 }],
    groupChats: { a: [{ role: "assistant", senderName: "阿屿", content: "在吗", ts: 5 }] }, unreadMap: { a: 2 }, allChars: [{ id: "c1", name: "阿屿" }], userLabel: "我", onBack() {}, onOpenChannel() {}, onSaveChannel() {}, onDeleteChannel() {}, onDeleteSpace() {} });
  const all = []; (function walk(n) { if (!n || typeof n !== "object") return; all.push(n); (n.kids || []).forEach(walk); })(tree);
  const wk = k => all.filter(n => n.props["data-wk"] === k);
  // 跟消息列表同一套挂点（她 2026-11-20「美化挂点尽量互通普通聊天的」），data-part 分出频道那一份
  const wp = (k, p) => all.filter(n => n.props["data-wk"] === k && n.props["data-part"] === p);
  assert.equal(wp("mlrow", "channel").length, 2);
  assert.equal(wp("mlrow", "channel")[0].props["data-unread"], "1");
  assert.equal(wp("mlbadge", "channel").length, 1);
  assert.equal(wp("mlbadge", "channel")[0].kids[0], 2);
  assert.deepEqual(wk("chabout").map(n => n.kids[0]), ["什么都聊"]);
  assert.deepEqual(wp("mllast", "channel").map(n => n.kids[0]), ["阿屿：在吗", "还没人说话"]);
  assert.equal(wk("chnew").length, 1);   // 列表最后一行；顶栏那颗挂在 Head 的 right 上
});
test("频道空间能改名、加人、踢人：名片点进设置页，改名跟着改每个频道的群名，人增减落到每个频道", () => {
  const fs = require("fs"), cs = fs.readFileSync(__dirname + "/../js/components.js", "utf8"), ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
  assert.match(cs, /function SpaceEditPage\(/);
  assert.match(cs, /"data-wk": "spacecard", onClick: \(\) => onSaveSpace && setSpEdit\(true\)/);
  assert.doesNotMatch(cs.slice(cs.indexOf("function ChannelEditPage("), cs.indexOf("function NewGroupSheet(")), /window\.confirm/);
  const i = ap.indexOf("const saveSpace = ");
  const body = ap.slice(i, ap.indexOf("const deleteSpace = ", i));
  assert.match(body, /renameGroup\(g\.id, channelGroupName\(\{ name \}, g\.chName\)\)/);
  assert.match(body, /filter\(id => !gone\.includes\(id\)\)\.concat\(added/);
  assert.match(ap, /onSaveSpace: patch => saveSpace\(sp, patch\)/);
});
test("频道可以不互通：chSolo 的频道看不到别处，别处也看不到它", () => {
  const fs = require("fs"), vm = require("vm"), en = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
  const i = en.indexOf("function spaceChannelBlock("), j = en.indexOf("function groupNoticeBlock(", i);
  const ctx = {}; vm.createContext(ctx); vm.runInContext(en.slice(i, j) + ";this.f=spaceChannelBlock;", ctx);
  const gs = [{ id: "a", spaceId: "s", chName: "综合" }, { id: "b", spaceId: "s", chName: "秘密", chSolo: true }, { id: "c", spaceId: "s", chName: "深夜" }];
  const chats = { a: [{ role: "user", content: "早" }], b: [{ role: "user", content: "嘘" }], c: [{ role: "user", content: "困" }] };
  const of = id => chats[id];
  assert.doesNotMatch(ctx.f(gs[0], gs, of, "她"), /秘密/);
  assert.match(ctx.f(gs[0], gs, of, "她"), /深夜/);
  const solo = ctx.f(gs[1], gs, of, "她");
  assert.doesNotMatch(solo, /综合|深夜|别的频道/);
});
test("不影响记忆的频道：就是群的「记忆互通」关着，新频道默认互通；关着的当不互通、翻手机也看不到", () => {
  const fs = require("fs"), ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), cs = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
  assert.match(ap, /const channelNoMem = gid => !gsFor\(gid\)\.memoryInterop;/);
  assert.match(ap, /saveGroupSettingsRaw\(g\.id, \{ memoryInterop: !noMem \}\);/);
  assert.match(ap, /saveGroupSettingsRaw\(g\.id, \{ memoryInterop: !patch\.chNoMem \}\)/);
  assert.match(ap, /spaceBlock: spaceChannelBlock\(group && spaceSibs\(\)/);
  assert.match(ap, /!\(g\.spaceId && channelNoMem\(g\.id\)\)\)\.map\(g => \{/);
  assert.match(cs, /"data-wk": "chnomem"/);
  assert.match(cs, /chSolo: solo \|\| noMem, chNoMem: noMem/);
});
test("已有的群能收进频道空间、也能移出去：只挂上/摘下 spaceId，群原样不动", () => {
  const fs = require("fs"), ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), cs = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
  const i = ap.indexOf("const adoptGroups = ");
  const body = ap.slice(i, ap.indexOf("const deleteSpace = ", i));
  assert.match(body, /updateGroup\(g\.id, \{ spaceId: sp\.id, chName:/);
  assert.match(body, /const releaseChannel = g => \{ updateGroup\(g\.id, \{ spaceId: null \}\)/);
  assert.doesNotMatch(body, /renameGroup/);
  assert.match(ap, /onAdopt: ids => adoptGroups\(sp, ids\), onRelease: releaseChannel/);
  assert.match(cs, /function GroupAdoptPage\(/);
});
test("旁观群也能收进频道：收进来自动不互通，名字旁标「旁观」", () => {
  const fs = require("fs"), ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), cs = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
  assert.match(ap, /looseGroups: \(groups \|\| \[\]\)\.filter\(g => g && !g\.spaceId\),/);
  assert.match(ap, /\.\.\.\(groupSpectating\(g\) \? \{ chSolo: true \} : \{\}\)/);
  assert.match(cs, /spectateOf && spectateOf\(g\) \?/);
});
test("别的频道带哪几个：有这里的人在的先带，同类里按最近有人说话排", () => {
  const fs = require("fs"), vm = require("vm"), en = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
  const i = en.indexOf("function spaceChannelBlock("), j = en.indexOf("\n}\n", i) + 3;
  const ctx = {}; vm.createContext(ctx); vm.runInContext(en.slice(i, j) + ";this.f=spaceChannelBlock;", ctx);
  const gs = [{ id: "me", spaceId: "s", chName: "这里", memberIds: ["a"] }, { id: "old", spaceId: "s", chName: "老", memberIds: ["b"] }, { id: "hot", spaceId: "s", chName: "热", memberIds: ["b"] }, { id: "mate", spaceId: "s", chName: "熟", memberIds: ["a"] }];
  const chats = { old: [{ role: "user", content: "x", ts: 1 }], hot: [{ role: "user", content: "y", ts: 9 }], mate: [{ role: "user", content: "z", ts: 2 }] };
  const out = ctx.f(gs[0], gs, id => chats[id] || [], "她");
  assert.ok(out.indexOf("#熟") < out.indexOf("#热") && out.indexOf("#热") < out.indexOf("#老"));
});
