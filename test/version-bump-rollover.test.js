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

test("次版本号满 99 就进位", () => {
  assert.equal(bump("55", "99"), "56.00");
  assert.equal(bump("55", "98"), "55.99");
  assert.equal(bump("09", "07"), "09.08", "两位补零不能丢");
  assert.equal(bump("99", "99"), "100.00");
});

test("已经长出来的 55.100 要能退回正轨", () => {
  assert.equal(bump("55", "100"), "56.00", "三位的次版本号也当作满了，直接进位");
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

test("排序要把 55.100 排在 55.99 之后、56.00 之前", () => {
  const num = new Function("return " + src.match(/const num = (v => \{[^}]+\});/)[1])();
  assert.ok(num("55.99") < num("55.100"));
  assert.ok(num("55.100") < num("56.00"));
  assert.ok(num("55.09") < num("55.10"));
});
