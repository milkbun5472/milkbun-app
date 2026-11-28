// 导入吃 zip（她 2026-11-28「公共的」）：一份解压，挂在 document 上，各处导入不用改
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), path = require("path"), zlib = require("zlib");
const Z = require("../js/zip-in.js");
// 手搓一个 zip：一个 deflate 的中文名 json、一个存储的 txt、一份 Mac 杂物
function mkZip(entries) {
  const locals = [], cds = []; let off = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8"), raw = Buffer.from(e.data), comp = e.deflate ? zlib.deflateRawSync(raw) : raw;
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x800, 6); lh.writeUInt16LE(e.deflate ? 8 : 0, 8);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(name.length, 26);
    const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(0x800, 8); cd.writeUInt16LE(e.deflate ? 8 : 0, 10);
    cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(raw.length, 24); cd.writeUInt16LE(name.length, 28); cd.writeUInt32LE(off, 42);
    locals.push(lh, name, comp); cds.push(cd, name); off += 30 + name.length + comp.length;
  }
  const cdBuf = Buffer.concat(cds), eo = Buffer.alloc(22); eo.writeUInt32LE(0x06054b50, 0); eo.writeUInt16LE(entries.length, 8); eo.writeUInt16LE(entries.length, 10);
  eo.writeUInt32LE(cdBuf.length, 12); eo.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, cdBuf, eo]);
}
test("解开 zip：中文名、deflate、存储都认，杂物跳过", async () => {
  const buf = mkZip([{ name: "角色卡/林晚.json", data: '{"name":"林晚"}', deflate: true }, { name: "__MACOSX/._x", data: "junk" }, { name: "readme.txt", data: "hello".repeat(40) }]);
  const out = await Z.expand([new File([buf], "包.zip", { type: "application/zip" }), new File(["x"], "a.png")]);
  assert.deepEqual(out.map(f => f.name), ["林晚.json", "readme.txt", "a.png"]);
  assert.equal(await out[0].text(), '{"name":"林晚"}');
  assert.equal(out[0].type, "application/json");
});
test("挂进 index，捕获阶段拦 change", () => {
  const idx = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"), src = fs.readFileSync(path.join(__dirname, "..", "js", "zip-in.js"), "utf8");
  assert.match(idx, /<script src="js\/zip-in\.js\?v=/);
  assert.match(src, /document\.addEventListener\("change", e => \{[\s\S]*\}, true\);/);
});
