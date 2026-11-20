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
  assert.match(cs, /if \(m\.kind === "chfile"\) return h\("div"/);
});
test("文件页渲染：索引签、三个按钮、一行一个文件", () => {
  const i = cs.indexOf("function ChannelTabs("), j = cs.indexOf("// 把已有的群放进这个频道空间", i);
  const h = (type, props, ...kids) => ({ type, props: props || {}, kids: kids.flat(Infinity).filter(x => x != null && x !== false) });
  const ctx = { h, useState: v => [v, () => {}], useRef: () => ({ current: null }), useEffect: () => {}, useTheme: () => ({ ink: "#111", sub: "#555", fog: "#999", line: "#ddd", bg: "#fff", bg2: "#f5f5f5", accent: "#46c" }),
    useIdbImgUrl: () => null, Head: "Head", PageSheet: "PageSheet", F_BODY: "s", F_DISPLAY: "s", requestAppPrompt() {}, requestAppConfirm() {}, window: {}, chfApplyDoc() {}, chfDiffSummary: () => "", chfLineDiff: () => [] };
  vm.createContext(ctx); vm.runInContext(cs.slice(i, j) + ";this.P=ChannelFilesPage;", ctx);
  const tree = ctx.P({ group: { id: "g", chName: "综合" }, files: [{ id: "a", kind: "doc", name: "行程", text: "x", createdBy: "me", createdTs: 1, updatedTs: 1, history: [] }, { id: "b", kind: "image", name: "合照", imgKey: "img_chf_1", createdBy: "c1", createdTs: 2, updatedTs: 2 }],
    nameOf: id => id === "me" ? "我" : "阿屿", onSaveFiles() {}, onBack() {}, onTab() {} });
  const all = []; (function walk(n) { if (!n || typeof n !== "object") return; all.push(n); (n.kids || []).forEach(walk); if (n.type && typeof n.type === "function") walk(n.type(n.props)); })(tree);
  const wk = k => all.filter(n => n.props && n.props["data-wk"] === k);
  assert.equal(wk("chfrow").length, 2);
  assert.equal(wk("chtab").length, 2);
  assert.equal(wk("chtab").find(n => n.props["data-part"] === "files").props["data-on"], "1");
  assert.equal(wk("chfnew").length + wk("chfupimg").length + wk("chfuptxt").length, 3);
});
