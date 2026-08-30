const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const JS = path.join(__dirname, "..", "js");
const read = f => fs.readFileSync(path.join(JS, f), "utf8");
const grab = (src, a, b, why) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i >= 0 && j > i, "抠不出：" + why); return src.slice(i, j); };

// 她 2026-08-30：「导出全部数据这里导不出来，没有文件出来但是显示已导出数据」。
// iOS 的 PWA 里 <a download> 是不作数的，所以【存文件只许有一条路】：engine.js 的 saveTextFile。
test("全 js 目录里只许有一个下载 <a>，就是 engine.js 的 saveFile", () => {
  const hits = [];
  for (const f of fs.readdirSync(JS).filter(x => x.endsWith(".js"))) {
    read(f).split("\n").forEach((line, i) => { if (/\.download\s*=/.test(line)) hits.push(f + ":" + (i + 1) + "  " + line.trim()); });
  }
  assert.equal(hits.length, 1, "存文件只许有一条路（window.saveTextFile / saveFile），别处自己写 <a download> 在 iOS PWA 上会静默失败：\n" + hits.join("\n"));
  assert.ok(hits[0].startsWith("engine.js:"), "唯一那处得住在 engine.js：" + hits[0]);
  const eng = read("engine.js");
  const fnStart = eng.lastIndexOf("async function saveFile", eng.indexOf(".download ="));
  assert.ok(fnStart >= 0, "那处 <a download> 不在 saveFile 里面");
});

test("engine.js 里那一份：<a> 必须先插进文档再点，revoke 必须延后", () => {
  const src = grab(read("engine.js"), "async function saveFile", "\nif (typeof window", "saveFile");
  assert.match(src, /document\.body\.appendChild\(a\)[\s\S]{0,40}a\.click\(\)/, "点之前没把 <a> 插进文档——Safari 里点了等于没点");
  assert.match(src, /setTimeout\([\s\S]{0,60}revokeObjectURL/, "revokeObjectURL 没延后——下载还没开始链接就失效了");
});

// 真跑一遍，别只看长相
function runSaveTextFile(env) {
  const eng = read("engine.js");
  const src = grab(eng, "async function saveTextFile", "\nif (typeof window", "saveTextFile+saveFile");
  const clicks = [];
  const revoked = [];
  const doc = {
    body: { appendChild(a) { a.__inDoc = true; } },
    contains: a => !!a.__inDoc,
    createElement: () => ({ style: {}, click() { clicks.push({ inDoc: !!this.__inDoc }); }, remove() {} })
  };
  const timers = [];
  const fn = new Function("window", "navigator", "document", "File", "URL", "setTimeout",
    src + "\nreturn saveTextFile;")(
    env.window || {}, env.navigator, doc,
    class { constructor(parts, name, o) { this.name = name; this.type = (o || {}).type; this.size = String(parts[0] || "").length; } },
    { createObjectURL: () => "blob:x", revokeObjectURL: u => revoked.push(u) },
    (f, ms) => timers.push(ms));
  return { fn, clicks, revoked, timers };
}

test("有分享面板就走分享面板；用户取消要如实说取消", async () => {
  const shared = [];
  const a = runSaveTextFile({ navigator: { share: async d => { shared.push(d.files[0].name); }, canShare: () => true } });
  assert.equal(await a.fn("x.json", "{}", "application/json"), "share");
  assert.deepEqual(shared, ["x.json"]);
  assert.equal(a.clicks.length, 0, "分享成功了还去点下载链接");

  const err = new Error("canceled"); err.name = "AbortError";
  const b = runSaveTextFile({ navigator: { share: async () => { throw err; }, canShare: () => true } });
  assert.equal(await b.fn("x.json", "{}", "application/json"), "cancel", "用户取消不许当成导出成功");
  assert.equal(b.clicks.length, 0, "取消之后不该偷偷再下载一次");
});

test("没有分享面板就退回下载，而且点的时候 <a> 得在文档里", async () => {
  const c = runSaveTextFile({ navigator: {} });
  assert.equal(await c.fn("x.json", "{}", "application/json"), "download");
  assert.deepEqual(c.clicks, [{ inDoc: true }], "点的时候 <a> 不在文档里——Safari 什么都不会发生");
  assert.equal(c.revoked.length, 0, "同步就 revoke 了，下载会拿到失效链接");
  assert.ok(c.timers[0] >= 1000, "revoke 的延时太短");
});

test("分享面板吃不下这个文件时，还得退回下载（大备份就是这种）", async () => {
  const d = runSaveTextFile({ navigator: { share: async () => { throw new Error("Permission denied"); }, canShare: () => true } });
  assert.equal(await d.fn("big.json", "{}", "application/json"), "download");
  assert.deepEqual(d.clicks, [{ inDoc: true }]);
});

test("导出全部数据不再无条件报「已导出」", () => {
  const src = grab(read("app.js"), "const doExport = async () => {", "const doImport =", "doExport");
  assert.match(src, /saveTextFile\(/, "doExport 没走公共的存文件路径");
  assert.match(src, /catch[\s\S]{0,120}toast\(/, "导出失败的时候没有告诉她失败了");
  assert.match(src, /cancel[\s\S]{0,120}toast\(|toast\([^)]*取消/, "用户取消的时候还在说已导出");
});

// 拿不到她那份布局，主屏的毛病就只能靠猜。这条路不许依赖导出文件。
test("主屏布局排查：读盘、说清楚 app 现在在哪儿", () => {
  const src = grab(read("screens.js"), "  const build = () => {\n    let L = {}, F = {};", "  const go = async () => {", "HomeLayoutProbe.build");
  const store = {
    x_homeLayout: JSON.stringify({ 0: ["f_1", "cast", "sp_0_1"], 1: ["phone"] }),
    x_homeFolders: JSON.stringify({ f_1: { name: "杂物", keys: ["shop", "dwell"] }, f_2: { name: "飘着的", keys: ["memo"] } })
  };
  const build = new Function("localStorage", "JSON", src + "\nreturn build;")({ getItem: k => store[k] || null }, JSON);
  const out = build();
  assert.match(out, /第1页\(2\)：f_1 cast/, "补位不该算进去，也该按页说清楚");
  assert.match(out, /文件夹「杂物」：shop dwell/, "得看得出东西还在文件夹里");
  assert.match(out, /文件夹「飘着的」（没摆在任何页上）/, "文件夹自己掉了页也得点出来");
  const raw = JSON.parse(out.slice(out.indexOf("{")));
  assert.deepEqual(raw.x_homeFolders.f_1.keys, ["shop", "dwell"], "原始 JSON 得原样带上，不然我这边还是得猜");
});
