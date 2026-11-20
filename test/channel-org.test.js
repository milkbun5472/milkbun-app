// 频道多了怎么收（她 2026-11-20）：分类分段、归档、他们自己开频道的上限，查手机里按空间摆
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), vm = require("vm");
const en = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), cs = fs.readFileSync(__dirname + "/../js/components.js", "utf8"), pu = fs.readFileSync(__dirname + "/../js/phone-ui.js", "utf8");
const ctx = {}; vm.createContext(ctx);
const a = en.indexOf("const CH_ACTIVE_MAX"), b = en.indexOf("function chHopTargets(");
vm.runInContext(en.slice(a, b) + ";this.chNewCheck=chNewCheck;this.chNewRoom=chNewRoom;this.chCatOf=chCatOf;this.spaceCatGroups=spaceCatGroups;", ctx);
const p0 = en.indexOf("function peekSpaceBlock("), p1 = en.indexOf("function chfContextBlock(");
vm.runInContext(en.slice(p0, p1) + ";this.peekSpaceBlock=peekSpaceBlock;", ctx);
test("分类分段：照 space.cats 的先后，没分类的在最后，归档的单独一摞", () => {
  const chs = [{ id: "a", chCat: "c2", createdTs: 1 }, { id: "b", createdTs: 2 }, { id: "c", chCat: "c1", createdTs: 3 }, { id: "d", chCat: "c1", createdTs: 4, chOrder: 0 }, { id: "e", chArchived: true }];
  const r = ctx.spaceCatGroups(chs, [{ id: "c1", name: "日常" }, { id: "c2", name: "剧情" }]);
  assert.deepEqual(r.groups.map(x => [x.cat ? x.cat.id : "", x.rows.map(g => g.id)]), [["c1", ["d", "c"]], ["c2", ["a"]], ["", ["b"]]]);
  assert.deepEqual(r.archived.map(g => g.id), ["e"]);
});
test("他们开频道：满 12 个、一天开过两个、名字差不多，都不开；归档的不占名额但占名字", () => {
  const sp = { id: "s" };
  const gs = Array.from({ length: 11 }, (_, i) => ({ spaceId: "s", chName: "频道" + i })).concat([{ spaceId: "s", chName: "深夜聊", chArchived: true }]);
  assert.equal(ctx.chNewCheck(sp, gs, "追剧", "2026-11-20"), true);
  assert.equal(ctx.chNewCheck(sp, gs, "#深夜聊", "2026-11-20"), false);
  assert.equal(ctx.chNewCheck(sp, gs.concat([{ spaceId: "s", chName: "再一个" }]), "追剧", "d"), false);
  assert.equal(ctx.chNewCheck({ id: "s", newChDay: { d: "d", n: 2 } }, [], "追剧", "d"), false);
  assert.equal(ctx.chNewCheck({ id: "s", newChDay: { d: "昨天", n: 2 } }, [], "追剧", "d"), true);
  assert.equal(ctx.chCatOf([{ id: "c1", name: "剧情" }], "剧情"), "c1");
  assert.equal(ctx.chCatOf([{ id: "c1", name: "剧情" }], "没有这类"), "");
});
test("他翻她手机：频道按空间摆、who 写群名、归档的不摆", () => {
  const rows = [{ g: { id: "1", spaceId: "s", chName: "综合", name: "夜猫子 · #综合" }, ms: [{ role: "user", content: "早" }], last: 5 },
    { g: { id: "2", spaceId: "s", chName: "旧", name: "夜猫子 · #旧", chArchived: true }, ms: [{ role: "user", content: "x" }], last: 9 }];
  const out = ctx.peekSpaceBlock(rows, () => "夜猫子", m => "她：" + m.content);
  assert.match(out, /频道空间「夜猫子」/);
  assert.match(out, /#综合（who：夜猫子 · #综合）/);
  assert.doesNotMatch(out, /#旧/);
});
test("接线：开频道字段、分类和归档界面、他手机里的空间行", () => {
  assert.match(ap, /item\.newChannel && typeof item\.newChannel === "object"/);
  assert.match(ap, /chNewCheck\(sp1, spaceSibs\(\), nm1, dk\)/);
  assert.match(ap, /gFileHint \+ gHopHint \+ gNewChHint/);
  assert.match(ap, /const moveChannel = \(sp, g, dir\)/);
  assert.match(ap, /peekSpaceBlock\(gAll\.filter\(x => x\.g\.spaceId\)/);
  assert.match(ap, /Object\.assign\(session, \{ spaceId: group\.spaceId/);
  assert.match(cs, /const segs = spaceCatGroups\(rows, space\.cats \|\| \[\]\)/);
  assert.match(cs, /"data-wk": "charchive"/);
  assert.match(pu, /"data-kind": "space", onClick: \(\) => setSpaceOpen\(sp\.id\)/);
  assert.match(en, /!x\.chSolo && !x\.chArchived\s*\n?\s*&& \(x\.memberIds/);
});
