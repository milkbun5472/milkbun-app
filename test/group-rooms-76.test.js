// 群里的小房间（她 2026-11-13「群聊咋开房间」「弄一下吧」）：房间就是一个带 roomOf 的普通群
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const app = read("js/app.js"), comp = read("js/components.js"), studio = read("js/theme-studio.js"), manual = read("js/assistant-manual.js");
const fnBody = (src, head) => { const i = src.indexOf(head); assert.ok(i >= 0, "缺 " + head); return src.slice(i, i + 2500); };

test("开房间：照主群抄一份，挂 roomOf，两种走同一个群设置写入口", () => {
  const b = fnBody(app, "const createGroupRoom = ");
  assert.match(b, /roomOf: parent\.id/);
  assert.match(b, /saveGroupSettingsRaw\(g\.id/);
  assert.match(b, /memoryInterop: kind === "closed" \? false/);
  assert.match(app, /onNewRoom: \(name, kind\) => createGroupRoom\(/);
  assert.match(app, /onSwitchRoom: id =>/);
});

test("聊天列表和群聊列表不单独列房间，未读算进主群那行", () => {
  assert.match(comp, /groups\.filter\(g => !g\.roomOf\)\.map\(g =>/);
  assert.match(comp, /\(groups \|\| \[\]\)\.filter\(g => !g\.roomOf\)\.map\(g => h\("button"/);
  assert.match(fnBody(comp, "const renderGroupRow = "), /r\.roomOf === g\.id/);
});

test("删主群连房间一起删，确认框说有几间", () => {
  const b = fnBody(app, "const deleteGroup = ");
  assert.match(b, /g\.roomOf === groupId/);
  assert.match(comp, /间小房间也一起删掉/);
});

test("小房间的挂点都登记进美化工作室", () => {
  ["groomstrip", "groomchip", "groomnew", "groomform", "groomname", "groomkind", "groomopen", "groomentry"].forEach(wk => {
    assert.ok(comp.includes('"' + wk + '"'), "components 缺 " + wk);
    assert.ok(studio.includes('["' + wk + '"'), "theme-studio 没登记 " + wk);
  });
});

test("攻略讲的是现在有小房间", () => {
  assert.ok(manual.includes("### 群聊里的小房间"));
  assert.ok(!manual.includes("没有，小房间只在单聊里"));
});
