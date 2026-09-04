// Sheet 的皮（v62.50，审计还债②的第一件）：半窗外壳原来写死 t.bg2——
// 全库九十来处半窗因此全是同一块白板，审计里「白页」和「半窗」几乎是同一件事。
// 现在给一个可选 skin 口子接父页自己的底；不传时行为一个字都不变。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js/components.js"), "utf8");
const rule = fs.readFileSync(path.join(__dirname, "..", ".claude/rules/no-half-sheet.md"), "utf8");
const cut = (s, a, b) => { const i = s.indexOf(a); return s.slice(i, s.indexOf(b, i + a.length)); };
const sheet = cut(comp, "function Sheet({", "function useKbLift()");

test("skin 口子在，且不传时一个字都不变", () => {
  assert.match(sheet, /\n  skin\n\}\) \{/, "签名里没有 skin");
  // 默认底还是 t.bg2，skin 合并在默认【之后】才能盖得住它
  assert.match(sheet, /style: Object\.assign\(\{\n      background: t\.bg2,/, "默认 t.bg2 底没了——存量九十处要变脸");
  assert.match(sheet, /\}, skinStyle \|\| \{\}\)/, "skin 没合进面板（或合在默认之前盖不住）");
  // 字符串当 background 简写；不是对象不是字符串的一律当没传
  assert.match(sheet, /typeof skin === "string" \? \{ background: skin \} : \(skin && typeof skin === "object" \? skin : null\)/,
    "字符串简写或坏值兜底没了");
});

test("handle 单独给把手，不漏进面板 style", () => {
  assert.match(sheet, /const skinHandle = sk \? sk\.handle : null;/, "把手色没抽出来");
  assert.match(sheet, /if \(k !== "handle"\) a\[k\] = sk\[k\];/, "handle 混进面板 style 了——它不是合法 CSS 属性");
  assert.match(sheet, /background: skinHandle \|\| t\.line/, "深底半窗的把手还是 t.line，会看不见");
});

test("规矩写进了 no-half-sheet.md：什么时候传、传什么、皮不是免罪符", () => {
  assert.match(rule, /可选参数 `skin`/, "规则文件没提这个口子");
  assert.match(rule, /父页有自己的材质（纸、软木、夜色、淘宝灰、绿纸论坛…）时\*\*一律传\*\*/, "没说什么时候传");
  assert.match(rule, /handle: "rgba\(…\)"/, "没说深底把手怎么办");
  assert.match(rule, /不是【免罪符】/, "没拦住「穿了皮就能滥用半窗」");
  assert.match(rule, /不传＝原样/, "没写明存量不动");
});
