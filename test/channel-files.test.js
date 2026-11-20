// 频道文件（她 2026-11-20「简约版的可以聊天的，可以放点文件进去，角色大家可以改或者创建新文件，可以看到谁改了啥」）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), vm = require("vm"), path = require("path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const en = read("engine.js"), cs = read("components.js"), ap = read("app.js");
const engineCtx = () => {
  const i = en.indexOf("const CHF_HIST_CAP"), j = en.indexOf("// 频道（她 2026-11-20）：群挂着 spaceId", i);
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(en.slice(i, j) + ";this.chfLineDiff=chfLineDiff;this.chfDiffSummary=chfDiffSummary;this.chfApplyDoc=chfApplyDoc;this.chfContextBlock=chfContextBlock;", ctx);
  return ctx;
};
test("逐行对比：加的、删的、没动的分得开", () => {
  const { chfLineDiff, chfDiffSummary } = engineCtx();
  const d = chfLineDiff("周六\n去海边\n吃烧烤", "周六\n去山上\n吃烧烤\n看星星");
  assert.deepEqual(JSON.parse(JSON.stringify(d)).map(x => x.t + ":" + x.s), ["same:周六", "del:去海边", "add:去山上", "same:吃烧烤", "add:看星星"]);
  assert.equal(chfDiffSummary("a\nb", "a\nc\nd"), "加了 2 行、删了 1 行");
  assert.equal(chfDiffSummary("", "x"), "新建");
});
test("写文档：同名（不计书名号、扩展名）就是改，记一笔谁改的；没有就新建；没改字不记", () => {
  const { chfApplyDoc } = engineCtx();
  let r = chfApplyDoc([], "《行程》", "第一版", "c1", 100);
  assert.equal(r.op, "create"); assert.equal(r.files.length, 1); assert.equal(r.file.history.length, 1);
  r = chfApplyDoc(r.files, "行程.md", "第二版", "me", 200);
  assert.equal(r.op, "edit"); assert.equal(r.files.length, 1); assert.equal(r.file.updatedBy, "me");
  assert.deepEqual(JSON.parse(JSON.stringify(r.file.history)).map(x => x.by), ["c1", "me"]);
  assert.equal(r.file.history[1].before, "第一版");
  assert.equal(chfApplyDoc(r.files, "行程", "第二版", "c2", 300).op, "");
  let fs0 = r.files; for (let k = 0; k < 40; k++) fs0 = chfApplyDoc(fs0, "行程", "v" + k, "c1", 400 + k).files;
  assert.equal(fs0[0].history.length, 30);
});
test("给模型看的：列出文件和最近谁动的；正文只在聊天提到时带", () => {
  const { chfContextBlock } = engineCtx();
  const files = [{ id: "a", kind: "doc", name: "行程", text: "周六去海边", createdBy: "c1", createdTs: 1, updatedTs: 1 }, { id: "b", kind: "image", name: "合照", desc: "海边四个人", createdBy: "me", createdTs: 2, updatedTs: 2 }];
  const nameOf = id => id === "me" ? "她" : "阿屿";
  const quiet = chfContextBlock(files, "今天吃啥", nameOf);
  assert.match(quiet, /《行程》/); assert.match(quiet, /海边四个人/); assert.doesNotMatch(quiet, /周六去海边/);
  assert.match(chfContextBlock(files, "行程再看看", nameOf), /周六去海边/);
  assert.equal(chfContextBlock([], "x", nameOf), "");
});
test("接线：频道群的提示词带文件块，发言里的 file 写进频道文件并冒一行可点的提示", () => {
  assert.match(ap, /const gFileHint = group && group\.spaceId \? chfContextBlock\(/);
  assert.match(ap, /\+ gNoticeHint \+ gFileHint \+/);
  assert.match(ap, /chfApplyDoc\(loadJSON\("x_chfiles:" \+ groupId, \[\]\), item\.file\.name, item\.file\.text, spk\.id\)/);
  assert.match(ap, /kind: "chfile", fileId: r0\.file\.id/);
  assert.match(ap, /channelTabs: activeGroup\.spaceId \? h\(ChannelTabs/);
  assert.match(ap, /body = h\(ChannelFilesPage, \{/);
  assert.match(cs, /if \(m\.kind === "chfile" \|\| m\.kind === "chlink"\) return h\("div"/);
});
test("文件页渲染：索引签、三个按钮、一行一个文件", () => {
  const i = cs.indexOf("function ChannelTabs("), j = cs.indexOf("// 把已有的群放进这个频道空间", i);
  const h = (type, props, ...kids) => ({ type, props: props || {}, kids: kids.flat(Infinity).filter(x => x != null && x !== false) });
  const ctx = { h, useState: v => [v, () => {}], useRef: () => ({ current: null }), useEffect: () => {}, useTheme: () => ({ ink: "#111", sub: "#555", fog: "#999", line: "#ddd", bg: "#fff", bg2: "#f5f5f5", accent: "#46c" }),
    useIdbImgUrl: () => null, Head: "Head", PageSheet: "PageSheet", F_BODY: "s", F_DISPLAY: "s", requestAppPrompt() {}, requestAppConfirm() {}, window: {}, chfApplyDoc() {}, chfDiffSummary: () => "", chfLineDiff: () => [] };
  { const en = require("fs").readFileSync(require("path").join(__dirname, "../js/engine.js"), "utf8"); const gi = en.indexOf("function chfGallery("), gj = en.indexOf("function chfGalleryMentioned(", gi); ctx.__g = en.slice(gi, gj); }
  vm.createContext(ctx); vm.runInContext(ctx.__g + cs.slice(i, j) + ";this.P=ChannelFilesPage;", ctx);
  const tree = ctx.P({ group: { id: "g", chName: "综合" }, files: [{ id: "a", kind: "doc", name: "行程", text: "x", createdBy: "me", createdTs: 1, updatedTs: 1, history: [] }, { id: "b", kind: "image", name: "合照", imgKey: "img_chf_1", createdBy: "c1", createdTs: 2, updatedTs: 2 }],
    nameOf: id => id === "me" ? "我" : "阿屿", onSaveFiles() {}, onBack() {}, onTab() {} });
  const all = []; (function walk(n) { if (!n || typeof n !== "object") return; all.push(n); (n.kids || []).forEach(walk); if (n.type && typeof n.type === "function") walk(n.type(n.props)); })(tree);
  const wk = k => all.filter(n => n.props && n.props["data-wk"] === k);
  // 文档｜图片分两栏（她 2026-11-20）：文档那栏只列文档，图片去图片栏
  assert.equal(wk("chfrow").length, 1);
  assert.equal(wk("chfsubtab").length, 2);
  assert.equal(wk("chtab").length, 2);
  assert.equal(wk("chtab").find(n => n.props["data-part"] === "files").props["data-on"], "1");
  assert.equal(wk("chfnew").length + wk("chfupimg").length + wk("chfuptxt").length, 3);
});
test("换个频道接着说：只去同空间、他在的、能互通的频道；不记的频道进不去也出不来", () => {
  const fs = require("fs"), vm = require("vm"), en = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
  const i = en.indexOf("function chHopTargets("), j = en.indexOf("function chfContextBlock(", i);
  const ctx = {}; vm.createContext(ctx); vm.runInContext(en.slice(i, j) + ";this.T=chHopTargets;this.P=chHopPick;", ctx);
  const gs = [{ id: "a", spaceId: "s", chName: "综合", memberIds: ["x", "y"] }, { id: "b", spaceId: "s", chName: "深夜", memberIds: ["x"] },
    { id: "c", spaceId: "s", chName: "秘密", memberIds: ["x"] }, { id: "d", spaceId: "s", chName: "游戏", memberIds: ["x"], chSolo: true }, { id: "e", spaceId: "t", chName: "别处", memberIds: ["x"] }];
  const noMem = id => id === "c";
  assert.equal(JSON.stringify(ctx.T(gs[0], gs, "x", noMem).map(g => g.id)), '["b"]');
  assert.equal(ctx.T(gs[0], gs, "y", noMem).length, 0);
  assert.equal(ctx.T(gs[2], gs, "x", noMem).length, 0);
  assert.equal(ctx.P(ctx.T(gs[0], gs, "x", noMem), "#深夜").id, "b");
  assert.equal(ctx.P(ctx.T(gs[0], gs, "x", noMem), "秘密"), null);
});
test("hop 落地：那边写进几句、记未读，这边留一行 chlink，点了去那个频道", () => {
  const fs = require("fs"), ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), cs = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
  assert.match(ap, /chHopPick\(chHopTargets\(sibs0\.find/);
  assert.match(ap, /kind: "chlink", toGid: tg\.id/);
  assert.match(ap, /window\.__openChannel = gid =>/);
  assert.match(ap, /const chfPurge = gid =>/);
  assert.match(ap, /onDeleteChannel: g => \{ chfPurge\(g\.id\); deleteGroup\(g\.id\); \}/);
  assert.match(cs, /m\.kind === "chfile" \|\| m\.kind === "chlink"/);
});
test("文件名认法放宽：去标点空格整段出现，或长名字里连着三个字出现；她那句提到的那份会被点明是这份文件", () => {
  const fs = require("fs"), vm = require("vm"), en = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
  const i = en.indexOf("function chfMentioned("), j = en.indexOf("\n}\n", en.indexOf("function chfContextBlock(")) + 3;
  const ctx = {}; vm.createContext(ctx); vm.runInContext(en.slice(i, j) + ";this.m=chfMentioned;this.b=chfContextBlock;", ctx);
  assert.equal(ctx.m("今晚吃啥", "看看今晚吃啥"), true);
  assert.equal(ctx.m("周末出游行程", "把出游行程排一下"), true);
  assert.equal(ctx.m("周末行程", "周末去哪"), false);
  const out = ctx.b([{ name: "今晚吃啥", kind: "doc", text: "火锅" }], "看看今晚吃啥", null, "看看今晚吃啥");
  assert.match(out, /她刚才那句说到的《今晚吃啥》，就是上面这份文件/);
});
test("图片栏：聊天里的图只收引用、同一张只算一次、新的在前；上传的图也在；她那句说到哪张能认出来", () => {
  const fs = require("fs"), vm = require("vm"), en = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
  const i = en.indexOf("function chfGallery("), j = en.indexOf("\n}\n", en.indexOf("function chfMentioned(")) + 3;
  const ctx = {}; vm.createContext(ctx); vm.runInContext(en.slice(i, j) + ";this.g=chfGallery;this.m=chfGalleryMentioned;", ctx);
  const msgs = [
    { role: "user", kind: "photo", imageRef: "iv_a", desc: "海边的落日", ts: 1, photoMode: "real" },
    { role: "assistant", kind: "photo", imageRef: "iv_b", desc: "他在厨房煮面", senderName: "顾朝", senderId: "c1", ts: 3 },
    { role: "user", kind: "photo", imageRef: "iv_a", ts: 5 },
    { role: "assistant", content: "没图", ts: 6 },
    { role: "assistant", kind: "photo", imageRef: "iv_x", ts: 7, recalled: true }
  ];
  const files = [{ id: "f1", kind: "image", imgKey: "img_chf_1", name: "菜单", createdBy: "me", createdTs: 4 }, { id: "f2", kind: "doc", name: "行程" }];
  const out = ctx.g(msgs, files);
  assert.deepEqual(Array.from(out.map(x => x.ref)), ["img_chf_1", "iv_b", "iv_a"]);
  assert.equal(out.find(x => x.ref === "iv_b").gen, true);
  assert.equal(out.find(x => x.ref === "img_chf_1").fileId, "f1");
  assert.deepEqual(Array.from(ctx.m(out, "上次那张海边的落日好看").map(x => x.ref)), ["iv_a"]);
});
test("图片拿回聊天里：照她发照片那样落一条同一个引用；本机图库的 img_ 图也真送去给大家看；旁观频道没有这颗", () => {
  const fs = require("fs"), ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), cs = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
  assert.match(ap, /pushGroupRich\(_g\.id, \{ role: "user", kind: "photo", imageRef: g\.ref, photoMode: "real"/);
  assert.match(ap, /String\(ref\)\.indexOf\("img_"\) === 0 && typeof idbImgGet === "function"/);
  assert.match(ap, /spectate: groupSpectating\(_g\)/);
  assert.match(cs, /!spectate \? h\("button", \{ "data-wk": "chfgalrecall"/);
  assert.match(cs, /function ChfGalleryPage\(/);
});
