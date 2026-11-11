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
  assert.match(comp, /!row\.m\.recalled && !MSG_RUN_BREAK\[row\.m\.kind\] \? subLine\(row\.m\)/);
});
test("线下小结卡挂点；他的动描不断开一串", () => {
  for (const k of ["offlogtitle", "offlogtext", "offlogopen", "offlogredo", "offlogtranscript"]) assert.ok(comp.includes('"data-wk": "' + k + '"'), k);
  assert.match(comp, /"data-wk": "card", "data-part": "offlog"/);
  assert.match(comp, /list\[k\]\.kind === "narration" && list\[k\]\.who === "char" && m\.role === "assistant"/);
});
test("根节点挂今天的月相 data-lisa-moon", () => {
  const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(app, /setAttribute\("data-lisa-moon", String\(Math\.floor\(\(age \/ syn\) \* 8 \+ 0\.5\) % 8\)\)/);
  const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14) / 864e5;
  const ph = d => { const a = (((d / 864e5 - ref) % syn) + syn) % syn; return Math.floor((a / syn) * 8 + 0.5) % 8; };
  assert.equal(ph(Date.UTC(2024, 3, 23, 23)), 4, "2024-04-23 是满月");
  assert.equal(ph(Date.UTC(2024, 3, 8, 18)), 0, "2024-04-08 是新月");
});
