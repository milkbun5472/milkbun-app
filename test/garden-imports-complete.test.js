"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// 她 2026-09-18 那一轮收冲突之后，game.mjs 掉了四个 import（NEIGHBOR_REACH、
// neighborTalkError、noteNeighborTalk、neighborView）——**6302 条测试一条都没红**，
// 是起了一次浏览器才看见的白屏。
// ⚠️病根：庭院那边的测试要么按文件抠源码比对，要么直接 import world.mjs 跑纯函数；
//   「这个名字在 game.mjs 里 import 了没有」两种都照不到。这一条专门照它。
const DIR = "apps/fairy-garden";
const worldNames = () => {
  const src = fs.readFileSync(path.join(DIR, "world.mjs"), "utf8");
  return new Set([...src.matchAll(/^export (?:const|function|let|class)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]));
};
// 这个文件自己 import 进来的名字
const imported = src => {
  const out = new Set();
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from/g))
    for (const raw of m[1].split(",")) {
      const name = raw.trim().split(/\s+as\s+/).pop().trim();
      if (name) out.add(name);
    }
  return out;
};
// 这个文件自己声明的名字（同名局部变量不算漏 import）
const declared = src => {
  const out = new Set([...src.matchAll(/(?:^|[\s;{(])(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]));
  // 形参也算这个文件自己的名字（含解构与默认值）
  for (const m of src.matchAll(/\(([^()]*)\)\s*(?:=>|\{)/g))
    for (const raw of m[1].split(","))
      { const n = raw.trim().replace(/^\{|\}$/g, "").split(/[=:]/)[0].trim(); if (/^[A-Za-z_$][\w$]*$/.test(n)) out.add(n); }
  return out;
};

test("庭院每个模块用到的 world 导出，都真的 import 了", () => {
  const world = worldNames();
  const miss = [];
  for (const file of fs.readdirSync(DIR).filter(f => f.endsWith(".mjs") && !f.endsWith(".test.mjs") && f !== "world.mjs")) {
    const src = fs.readFileSync(path.join(DIR, file), "utf8");
    const has = imported(src), mine = declared(src);
    // 只看 import 段【以外】的正文，而且【先把注释剥掉】：
    // ⚠️不剥的话，注释里那句「perform('gather') 仍是唯一的奖励写入方」会被当成用到了 perform。
    const body = src.replace(/^import[^\n]*\n/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/[^\n]*$/gm, " ")
      .replace(/([^:\\])\/\/[^\n]*$/gm, "$1 ");
    for (const name of world) {
      if (has.has(name) || mine.has(name)) continue;
      // 属性名（.foo / foo:）不算用到这个导出
      const used = new RegExp("(^|[^.\\w$'\"])" + name.replace(/\$/g, "\\$") + "\\s*\\(").test(body)
        || new RegExp("(^|[^.\\w$'\"])" + name.replace(/\$/g, "\\$") + "(?![\\w$:])").test(body);
      if (used) miss.push(file + " 用了 " + name + " 却没 import");
    }
  }
  assert.deepEqual(miss, [], miss.join("\n"));
});
