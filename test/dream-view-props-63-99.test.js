// 梦页面一进去就白屏（她 2026-09-05：「梦境一旦想进入角色的梦页面就崩了」）。
//
// 病根：幕文旁边那颗朗读点要拿角色的音色，写的是 props.characters.find(...)，
// 而 Dream 渲染 DreamView 的那一处【压根没传 characters】——undefined.find() 当场抛，
// 整页白。useTtsPlayer() 永远返回一个对象，所以那个分支【每次都走】：
// 这一页从 v59.88（2026-09-01）起就是进一次崩一次。
//
// 又是「一层写在两处，第二处没跟上」：一处用、一处传。所以这条测试不钉那一行，
// 钉的是【两处对得上】——下次谁再加一个 props.xxx 忘了传，它当场红。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "dream.js"), "utf8");

function bodyOf(name, endMark) {
  const i = src.indexOf("  function " + name + "(props) {");
  assert.ok(i > 0, "找不到 " + name);
  const j = src.indexOf(endMark, i + 10);
  assert.ok(j > i, "抠不出 " + name);
  return src.slice(i, j);
}

test("DreamView 用到的每一个 props，Dream 都真的传了", () => {
  const dv = bodyOf("DreamView", "  window.Dream = Dream;");
  const used = [...new Set([...dv.matchAll(/props\.([A-Za-z_]\w*)/g)].map(m => m[1]))].sort();
  const i = src.indexOf("h(DreamView, {");
  assert.ok(i > 0, "找不到渲染 DreamView 那一处");
  const call = src.slice(i, src.indexOf("      });", i));
  const passed = new Set([...call.matchAll(/(\w+):/g)].map(m => m[1]));
  const missing = used.filter(k => !passed.has(k));
  assert.deepEqual(missing, [], "这几个 props 用了但没人传，运行到那一行就是 undefined：" + missing.join("、"));
  // 那一条真正的病照旧钉死：音色是按角色取的，不是随便抓一个
  assert.match(dv, /spk: \(props\.characters \|\| \[\]\)\.find\(c => c\.id === s\.charId\)/);
  assert.ok(used.indexOf("characters") >= 0 && passed.has("characters"));
});

test("整页别再因为一个空数组塌掉：props 上的 find/map 都带兜底", () => {
  // ⚠️白屏和「少一颗按钮」的差别就在这一个 || []：
  //   前者她要退出去重开，后者她可能都注意不到。
  const bad = [...src.matchAll(/props\.(\w+)\.(find|map|filter|some|forEach|slice)\(/g)].map(m => m[0]);
  assert.deepEqual(bad, [], "这几处没兜底：" + bad.join("、"));
});
