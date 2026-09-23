const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "bump-version.mjs"), "utf8");

// 她 2026-08-25：「55.100 应该是 56.00 才对」。
// 旧写法 String(99 + 1).padStart(2,"0") === "100"——padStart 对三位数是空操作，
// 于是悄悄长出一个 55.100。

const bump = (maj, mi) => new Function("maj", "mi",
  src.slice(src.indexOf("const bumped = ()"), src.indexOf("const next = process.argv[2]"))
  + "\nreturn bumped();")(String(maj), String(mi));

// v73.301 起改成三位小数、第三位加一（她 2026-09-23）。进位点从 99 挪到 999。
test("三位小数：满 999 才进位，两位的旧号先补成三位", () => {
  assert.equal(bump("73", "30"), "73.301", "旧的两位号 73.30＝73.300，下一版 73.301");
  assert.equal(bump("73", "301"), "73.302", "别再从 73.301 跳成 74.00（演练里真跳过）");
  assert.equal(bump("73", "999"), "74.000");
  assert.equal(bump("09", "007"), "09.008", "补零不能丢");
});

// ⚠️这一条比进位本身更要命。脚本开头就写着它存在的理由是「防止版本倒退」，
// 而只吃两位的正则会把 55.100 读成 55.10 —— 下一版就发 55.11，
// 缓存指纹一口气退回四十几版之前，她手机根本刷不到新文件。
test("读版本号的正则不许把三位次版本截断成两位", () => {
  const line = src.split("\n").find(l => l.includes("const push = t =>"));
  assert.ok(line, "push 还在");
  const re = new RegExp(line.match(/replace\((\/[^/]+\/g)/)[1].slice(1, -2), "g");
  const read = t => { const out = []; String(t).replace(re, (_, a, b) => { out.push(a + "." + b); return _; }); return out; };
  assert.deepEqual(read("v55.100"), ["55.100"], "读成 55.10 就是那场倒退事故");
  assert.deepEqual(read("v55.99"), ["55.99"]);
  assert.deepEqual(read("v56.00"), ["56.00"]);
  assert.deepEqual(read("fix(x): 修好了 (v55.100)"), ["55.100"], "提交历史里的也要认");
});

// 小数部分按小数比（73.30 ＝ 73.300）。55.100 那个历史误号按小数就是 55.1——早就过去了，
//   现在的最大值在 73 往后，它排哪儿都不影响取最大。
test("排序按小数：73.30 < 73.301 < 73.31 < 74.000", () => {
  const num = new Function("return " + src.match(/const num = (v => \{[^\n]+\});/)[1])();
  assert.ok(num("73.30") < num("73.301"));
  assert.ok(num("73.301") < num("73.31"));
  assert.ok(num("73.999") < num("74.000"));
  assert.ok(num("55.09") < num("55.10"));
});
