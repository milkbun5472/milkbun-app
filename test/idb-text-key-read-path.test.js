const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const engine = read("engine.js");

// 搬进 IDB 文字仓的键，localStorage 里那份在迁移成功后是被删掉的
// （hydrateTxtVault：核对一致才 localStorage.removeItem）。
// 谁还直接 localStorage.getItem 这些键，读出来就永远是 null。
// 她 2026-08-26 截图：记忆库满满当当，「立刻建全向量索引」却说「记忆库是空的，没什么可嵌」——
// 就是 EmbedApiConfig.runRebuild 漏了这一层，直接读的 localStorage。
function idbTextKeys() {
  const durable = engine.match(/const DURABLE_TEXT_KEYS = new Set\(\[([^\]]*)\]\)/);
  const prefixes = engine.match(/const IDB_TEXT_PREFIXES = \[([^\]]*)\]/);
  assert.ok(durable && prefixes, "常量还在原地");
  const lit = s => [...s.matchAll(/"([^"]+)"/g)].map(m => m[1]);
  return { durable: lit(durable[1]), prefixes: lit(prefixes[1]) };
}

test("IDB 文字仓的键不许直接 localStorage.getItem", () => {
  const { durable, prefixes } = idbTextKeys();
  const names = [...durable, ...prefixes];
  assert.ok(names.includes("x_memLib"), "x_memLib 归文字仓管");

  // cloud.js/engine.js 是文字仓自己的迁移与灾备实现，本来就得碰裸 localStorage
  const files = ["app.js", "screens.js", "components.js"];
  const bad = [];
  files.forEach(f => read(f).split("\n").forEach((l, i) => {
    names.forEach(n => {
      // 精确匹配键名；例如 x_coupleNotes 不能误伤仍留在 localStorage 的
      // x_coupleNoteSeen（前者只是后者的字符串前缀）。
      const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp('localStorage\\.getItem\\(\\s*["\\\']' + escaped + '["\\\']').test(l)) {
        bad.push(f + ":" + (i + 1) + " → " + l.trim().slice(0, 90));
      }
    });
  }));
  assert.deepEqual(bad, [], "这些地方要改走 loadJSON / storedJSONText：\n" + bad.join("\n"));
});

test("建全向量索引读的是 loadJSON，不是裸 localStorage", () => {
  const screens = read("screens.js");
  const i = screens.indexOf("const runRebuild = async");
  assert.ok(i > 0);
  const seg = screens.slice(i, screens.indexOf("const inSt =", i));
  assert.match(seg, /loadJSON\("x_memLib", \[\]\)/, "记忆库要走 loadJSON");
  assert.ok(!seg.includes('localStorage.getItem("x_memLib"'), "别再留一条裸读的旁路——兜底 loadJSON 内部已经有了");
  assert.match(seg, /loadJSON\("x_loreEntries", \[\]\)/, "世界书同理，别留第二处");
});

// loadJSON 是唯一该被信任的读路径：镜像没灌好时它自己会回落 localStorage，
// 所以改用它不会在迁移未完成的机器上把数据读丢。
test("loadJSON 对 IDB 键有 localStorage 兜底", () => {
  const i = engine.indexOf("function loadJSON(");
  const seg = engine.slice(i, i + 600);
  assert.match(seg, /isIdbTextKey/);
  assert.match(seg, /_txtMirror\(\)\.get\(k\)/);
  assert.match(seg, /localStorage\.getItem\(k\)/, "镜像没灌好要回落，绝不让数据凭空消失");
});
