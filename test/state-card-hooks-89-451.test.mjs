import { test } from "node:test"; import assert from "node:assert/strict"; import { readFileSync } from "node:fs";
const comp = readFileSync(new URL("../js/components.js", import.meta.url), "utf8");
const gaze = readFileSync(new URL("../js/gaze.js", import.meta.url), "utf8");
const studio = readFileSync(new URL("../js/theme-studio.js", import.meta.url), "utf8");
test("状态卡新挂点：心情词、好感数字第二份、水位小扣、Ta眼里空块", () => {
  assert.match(comp, /"data-wk": "statemood"/);
  assert.match(comp, /"data-wk": "stateaffval", style: \{ display: "none" \}/);
  assert.match(comp, /"data-wk": "stateheartknob", "aria-hidden": "true", style: \{ display: "none"/);
  assert.match(comp, /bottom: "calc\(var\(--sc-heart-lvl\) \* 100%\)"/);
  assert.match(gaze, /!hasAny\(charId\) \? h\("div", \{ "data-wk": "gazeempty"/);
  for (const k of ["statemood", "stateaffval", "stateheartknob", "gazeempty"]) assert.ok(studio.includes('"' + k + '"'), k + " 要进主题工作台的挂点名单");
});
test("翻旧心声那一页的挂点", () => {
  for (const k of ["statehist", "statehistbtn", "statehisthead", "statehistlist", "statehistitem", "statehistmood", "statehisttime", "statehisttext", "statehistmeta", "statehistact", "statehistwear", "statehistend"]) {
    assert.ok(comp.includes('"data-wk": "' + k + '"'), k);
    assert.ok(studio.includes('"' + k + '"'), k + " 要进挂点名单");
  }
  assert.match(comp, /"data-wk": "statehistbtn", "data-part": back \? "back" : "more"/);
});
test("位置卡挂点", () => {
  for (const k of ["geocard", "geopin", "geopinstem", "geoname", "georule", "geofoot"]) {
    assert.ok(comp.includes('"data-wk": "' + k + '"'), k);
    assert.ok(studio.includes('"' + k + '"'), k + " 要进挂点名单");
  }
});
test("卡片行也报连发首末，排版「头像只留第一条」管到卡片行", () => {
  assert.match(comp, /out = React\.cloneElement\(out, Object\.assign\(\{ "data-run": "1" \}, msgRunAttrs\(messages, row\.i, 0, true/);
  assert.match(comp, /\[data-run\]\[data-first="0"\] button\[data-wk="avatar"\]/);
});
test("卡片行的已读挂点默认藏着", () => {
  assert.match(comp, /"data-wk": "cardmeta", "data-me": row\.m\.role === "user" \? "1" : "0", style: \{ display: "none" \}/);
  assert.ok(studio.includes('"cardmeta"'));
});
