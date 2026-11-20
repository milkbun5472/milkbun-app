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
  assert.match(cs, /const segs = spaceCatGroups\(rows, space\.cats \|\| \[\], byRecent \? lastTsOfCh : null\)/);
  assert.match(cs, /"data-wk": "charchive"/);
  assert.match(pu, /"data-kind": "space", onClick: \(\) => setSpaceOpen\(sp\.id\)/);
  assert.match(en, /!x\.chSolo && !x\.chArchived\s*\n?\s*&& \(x\.memberIds/);
});
test("让他们聊一会儿：挑频道不挑归档和没角色的，最多 3 个，冷着的机会大", () => {
  const fs = require("fs"), vm = require("vm"), en = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
  const i = en.indexOf("function spaceTalkPick("), j = en.indexOf("\n}\n", i) + 3;
  const ctx = {}; vm.createContext(ctx); vm.runInContext(en.slice(i, j) + ";this.f=spaceTalkPick;", ctx);
  const now = 100 * 3600000;
  const chs = [{ id: "a" }, { id: "b", chArchived: true }, { id: "c" }, { id: "d" }, { id: "e" }, { id: "empty" }];
  const chats = { a: [{ role: "user", ts: now - 60000 }], c: [{ role: "user", ts: now - 48 * 3600000 }] };
  const cnt = g => g.id === "empty" ? 0 : 1;
  const got = ctx.f(chs, id => chats[id] || [], cnt, 3, () => 0.5, now).map(g => g.id);
  assert.equal(got.length, 3);
  assert.ok(!got.includes("b") && !got.includes("empty"));
  // 刚聊过的 a 权重 1，冷着的 c 权重 5：随机取第一个时偏向 c
  assert.equal(ctx.f([{ id: "a" }, { id: "c" }], id => chats[id] || [], cnt, 1, () => 0.5, now)[0].id, "c");
});
test("让他们聊一会儿接线：走 replyGroup，跑完记一张 x_spaceDigest", () => {
  const ap = require("fs").readFileSync(__dirname + "/../js/app.js", "utf8");
  const i = ap.indexOf("const talkSpace = async sp =>"), body = ap.slice(i, ap.indexOf("const deleteSpace = ", i));
  assert.match(body, /spaceTalkPick\(/);
  assert.match(body, /await replyGroup\(g\.id\)/);
  assert.match(body, /saveJSON\("x_spaceDigest:" \+ sp\.id, out\)/);
  assert.match(ap, /onTalk: \(\) => talkSpace\(sp\)/);
});
test("频道默认按最近有人说话排；给不了时间就照手动顺序", () => {
  const fs = require("fs"), vm = require("vm"), en = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
  const i = en.indexOf("function spaceCatGroups("), j = en.indexOf("function chHopTargets(");
  const ctx = {}; vm.createContext(ctx); vm.runInContext(en.slice(i, j) + ";this.f=spaceCatGroups;", ctx);
  const chs = [{ id: "a", chOrder: 0 }, { id: "b", chOrder: 1 }, { id: "c", chOrder: 2 }];
  const ts = { a: 1, b: 9, c: 5 };
  assert.deepEqual(ctx.f(chs, [], g => ts[g.id]).groups[0].rows.map(g => g.id), ["b", "c", "a"]);
  assert.deepEqual(ctx.f(chs, []).groups[0].rows.map(g => g.id), ["a", "b", "c"]);
});
