"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

// 她 2026-09-18：「还有你这个对话框挡住行动了」。
// 病根不是位置，是它【根本没被藏起来】：CSS 里给了 display:flex，
// 而 display 会把 hidden 属性自带的 display:none 压过去——那个框从头到尾都在屏幕上。
// ⚠️这种错看不出来（代码里 hidden=true 写得好好的），只能让机器扫。
test("markup 里带 hidden 的元素，CSS 不许把它的 display 写死", () => {
  const html = fs.readFileSync("apps/fairy-garden/index.html", "utf8");
  const css = fs.readFileSync("apps/fairy-garden/style.css", "utf8");
  const ids = new Set();
  for (const m of html.matchAll(/<[^>]*\bid="([A-Za-z0-9_-]+)"[^>]*>/g))
    if (/\bhidden\b/.test(m[0])) ids.add(m[1]);
  assert.ok(ids.size > 3, "一个带 hidden 的元素都没找着？选择器八成写错了");
  const bad = [];
  for (const id of ids)
    for (const m of css.matchAll(new RegExp("(^|[},;])\\s*(#" + id + ")\\s*\\{([^}]*)\\}", "gm"))) {
      const d = /display\s*:\s*([a-z-]+)/.exec(m[3]);
      if (d && d[1] !== "none" && !css.includes("#" + id + "[hidden]")) bad.push(id + " → display:" + d[1]);
    }
  assert.deepEqual(bad, [], "这几处要补一条 #xxx[hidden]{display:none}：" + bad.join("、"));
});
