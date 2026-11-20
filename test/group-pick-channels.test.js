// 挑「发到哪个群」的名单也列频道（她 2026-11-20「全app里能转发到群的是不是也得接一个能转发到频道」）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const en = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), cs = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const cut = (src, name) => { const i = src.indexOf("function " + name + "("); return src.slice(i, src.indexOf("\n}\n", i) + 3); };
test("groupPickList：普通群在前，频道写成「#频道 · 空间名」，归档的、没到点的不列，id 不变", () => {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(cut(en, "chHoursOpen") + cut(en, "groupPickList") + ";this.f=groupPickList;", ctx);
  const spaces = [{ id: "s1", name: "小窝", avatarImage: "iv_x" }];
  const gs = [{ id: "c1", spaceId: "s1", chName: "综合", name: "小窝 · #综合" }, { id: "g1", name: "老群" },
    { id: "c2", spaceId: "s1", chName: "旧", chArchived: true }, { id: "c3", spaceId: "s1", chName: "深夜", chHours: { from: 22, to: 5 } }];
  const noon = new Date(2026, 10, 20, 12, 0);
  const out = ctx.f(gs, spaces, noon);
  assert.equal(out.map(g => g.id).join(), "g1,c1");
  assert.equal(out[1].name, "#综合 · 小窝");
  assert.equal(out[1].pickSpaceAvatar, "iv_x");
  assert.equal(gs[0].name, "小窝 · #综合");   // 原来的群对象不被改
  const night = new Date(2026, 10, 20, 23, 0);
  assert.equal(ctx.f(gs, spaces, night).map(g => g.id).join(), "g1,c1,c3");
});
test("挑群的地方都过这一份：转发单子、购物、外卖、分享到群", () => {
  assert.match(cs, /function ForwardPickSheet\(\{ chars, groups: groups0,[\s\S]{0,400}groupPickList\(groups0/);
  assert.match(cs, /groupPickFace\(g, 34, t\)/);
  assert.equal((ap.match(/groups: pickGroupsOf\(groups\.filter\(imInGroup\)\)/g) || []).length, 2);
  assert.ok((ap.match(/groups: pickGroupsOf\(groups\)/g) || []).length >= 5);
  assert.match(ap, /window\.__spacesNow = spaces/);
});
