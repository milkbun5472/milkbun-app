const test = require("node:test"); const assert = require("node:assert");
const S = require("fs").readFileSync(__dirname + "/../js/cloud.js", "utf8");
const i = S.indexOf("    _fgHave: null,"), j = S.indexOf("    async apply(data) {");
const mk = () => new Function("return {" + S.slice(i, j) + "};")();
const jpg = "data:image/jpeg;base64," + "A".repeat(3000), jpg2 = "data:image/jpeg;base64," + "B".repeat(4000);
const save = () => JSON.stringify({ photos: [{ id: "p1", image: jpg }, { id: "p2", image: jpg2 }], name: "镇" });
// 测试环境里的 fetch / FileReader 桩
global.fetch = async u => ({ blob: async () => ({ size: u.length, u }) });
global.Blob = class { constructor(parts, o) { this.u = parts[0].u; this.type = o.type; this.size = 1; } };
global.FileReader = class { readAsDataURL(b) { this.result = b.u; setTimeout(() => this.onload(), 0); } };
test("推云时照片换编号、照片单传；恢复时装回原图", async () => {
  const c = mk(), cloud = new Map();
  c.mediaList = async () => new Set(); c.mediaPut = async (b, k, blob) => { cloud.set(k, blob); return true; }; c.mediaGet = async (b, k) => cloud.get(k) || null;
  const dump = { "x_fairyGarden::c1::r1": save(), x_other: '"' + jpg + '"' };
  assert.equal(await c.fgOutline(dump), 2);
  assert.ok(!dump["x_fairyGarden::c1::r1"].includes("data:image"), "存档里不该还有原图");
  assert.ok(dump.x_other.includes("data:image"), "别的键不动");
  assert.equal(cloud.size, 2);
  const back = { "x_fairyGarden::c1::r1": dump["x_fairyGarden::c1::r1"] };
  await c.fgInline(back);
  assert.deepStrictEqual(JSON.parse(back["x_fairyGarden::c1::r1"]), JSON.parse(save()));
});
test("传不上去的那张照旧原图留着；取不回就整次不恢复", async () => {
  const c = mk();
  c.mediaList = async () => new Set(); c.mediaPut = async () => false;
  const dump = { "x_fairyGarden::a": save() };
  assert.equal(await c.fgOutline(dump), 0); assert.equal(dump["x_fairyGarden::a"], save());
  const c2 = mk(); c2.mediaGet = async () => null;
  await assert.rejects(c2.fgInline({ "x_fairyGarden::a": '{"image":"fgimg:fgjabc_1"}' }), /没能从云上取回来/);
  assert.match(S, /async apply\(data\) \{\s*\n\s*\/\/[^\n]*\n\s*if \(data && typeof data === "object"\) await this\.fgInline\(data\);/);
  assert.match(S, /await this\.fgOutline\(dump\);\s*\n\s*return dump;/);
});
test("没登录／桶没开时原样传", async () => {
  const c = mk(); c.mediaList = async () => null;
  const dump = { "x_fairyGarden::a": save() };
  assert.equal(await c.fgOutline(dump), 0); assert.equal(dump["x_fairyGarden::a"], save());
});
