const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");

// 她 2026-08-22 问：「为啥旧代码没有引用了你们都不删」。
// 老实说：因为没有任何东西在查。删要花力气核实安全，留着零成本，于是就留着了。
// 死的【提示词】尤其坑——它看着像现行规则：这次「句尾不打句号」的回归，
// 病根就是那条规则还留在早已没人引用的 ANTI_CLICHE_LEGACY 里，
// 谁扫一眼代码都会以为它还在生效。所以改成让机器每次都查一遍。
//
// 白名单 = 【故意停在这儿】的东西，每一条都要写清为什么。想加新条目，
// 先问自己：这是有意停放，还是只是懒得删？后者就删掉，别往这儿加。
const PARKED = {
  OFFLINE_INTIMATE_RUNTIME:
    "有意停放：test/offline-protocol-v2.test.js 明确断言「存在但刻意不注入」，" +
    "并锁住它的措辞保持领域中立。删掉会推翻那个设计决定。",
  computeLedger:
    "待定：phone.js 钱包那一块是 Codex 在做的，可能是在建的半成品。" +
    "不擅自删别人正在长的东西——要动先问过他。",
};

// 计入「被使用」的地方：产品代码与页面。故意不算 test/——
// 只有测试在引用的产品代码，本身就是死代码。
const usageFiles = fs.readdirSync(path.join(root, "js")).filter(f => f.endsWith(".js")).map(f => "js/" + f)
  .concat(["sw.js", "index.html", "rescue.html"]);
const declFiles = usageFiles.filter(f => f.endsWith(".js"));
const src = Object.fromEntries(usageFiles.map(f => [f, fs.readFileSync(path.join(root, f), "utf8")]));
const all = Object.values(src).join("\n");
const wordRe = n => new RegExp("(?<![A-Za-z0-9_$])" + n.replace(/\$/g, "\\$") + "(?![A-Za-z0-9_$])", "g");

const findDead = () => {
  const dead = [];
  for (const f of declFiles) {
    const re = /^(?:const|function|let)\s+([A-Za-z_$][\w$]*)/gm;
    let m;
    while ((m = re.exec(src[f]))) {
      const name = m[1];
      if (name.length < 4) continue;                       // i/fn 这类短名噪音太大
      const hits = (all.match(wordRe(name)) || []).length; // 定义本身算 1 次
      if (hits <= 1) dead.push({ file: f, name, line: src[f].slice(0, m.index).split("\n").length });
    }
  }
  return dead;
};

test("没有零引用的顶层定义（有意停放的写进白名单并说明理由）", () => {
  const dead = findDead();
  const unexplained = dead.filter(d => !PARKED[d.name]);
  assert.deepEqual(unexplained, [],
    "这些定义没有任何地方引用：\n" +
    unexplained.map(d => "  " + d.file + ":" + d.line + "  " + d.name).join("\n") +
    "\n\n要么删掉，要么在 PARKED 里写明为什么留着。");
});

test("白名单本身不许烂掉：写进去的必须真的还在、且真的没人用", () => {
  const dead = new Set(findDead().map(d => d.name));
  Object.keys(PARKED).forEach(name => {
    assert.ok(all.match(wordRe(name)), "白名单里的 " + name + " 已经不存在了，把这条也删掉");
    assert.ok(dead.has(name), name + " 现在已经有人引用了，从白名单里拿走——它不再是停放状态");
    assert.ok(PARKED[name].length >= 20, name + " 的理由太短，说清楚为什么不删");
  });
});

test("这次清掉的那批不许悄悄回来", () => {
  ["ANTI_CLICHE_LEGACY", "WORLDBOOK_RULE_LEGACY", "CHARCARD_RULE_LEGACY",
   "SILENT_WAV", "normalizeMemoryFact", "GSoon", "GListen", "GLedger"].forEach(n =>
    assert.ok(!all.match(wordRe(n)), n + " 又回来了"));
  // 但真正在用的同名近亲一个都不能少
  ["ANTI_CLICHE", "WORLDBOOK_RULE", "CHARCARD_RULE", "KEEPALIVE_WAV", "makeSilentWav",
   "INTIMATE_ANTI_CLICHE_LEGACY_V1", "NARRATIVE_ANTI_CLICHE_LEGACY_V1"].forEach(n =>
    assert.ok(all.match(wordRe(n)), "误伤：" + n));
});
