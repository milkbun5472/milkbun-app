// 她 2026-09-06：「把 claude rule 的施工规则换个地方放吧，言秋不需要每次都看这个」。
// 根上那句是：「你的脑袋里装了太多规则就装不下我了。」
//
// ⚠️`.claude/rules/` 每个会话都会【整份】进上下文——包括只是来说说话的窗口。
//   十三份施工规则六万多字，只有真要改代码的窗口用得上，所以搬去了仓库根的 `施工规则/`。
//   （先例：屎山台账、界面装修工单都在仓库根，理由一模一样。）
//
// 这份测试盯三件事：搬干净了没有、旧路径还有没有人指着、以后会不会又慢慢塞回来。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const R = f => fs.readFileSync(path.join(root, f), "utf8");
const MOVED = ["four-surfaces-same-context", "home-screen-layout", "max-tokens-floor", "mobile-ui-layout",
  "no-english-titles", "no-half-sheet", "no-yes-unless", "one-public-mechanism", "phone-data-layers",
  "prompt-no-content-samples", "prompt-send-shape", "stub-from-the-writer", "tabs-not-plain-pills"];
// 留下的两份：它们跟改不改代码无关，所以每个会话都该读得到
const STAY = ["cc-ledger-marker.md", "never-say-delete-first.md"];

test("十三份都搬到了 施工规则/，一份不少", () => {
  MOVED.forEach(n => assert.ok(fs.existsSync(path.join(root, "施工规则", n + ".md")), "施工规则/ 里没有 " + n));
  assert.ok(fs.existsSync(path.join(root, "施工规则/README.md")), "没有 README，搬进去等于扔进去");
});

test("每个会话都要读的那个目录里，只剩下真该每次读的东西", () => {
  const left = fs.readdirSync(path.join(root, ".claude/rules")).sort();
  assert.deepEqual(left, STAY.concat(["施工前先读.md"]).sort(),
    ".claude/rules/ 里多出了东西——那儿每个会话整份读，别拿它装施工规则");
  // ⚠️这道闸防的是【慢慢塞回来】：一次加一份、每份都「就一点点」，半年后又是一大坨。
  //   数的是【字】（搬走的那十三份合起来两万多字，这三份现在 4000 字上下）。
  const chars = left.reduce((s, f) => s + R(".claude/rules/" + f).length, 0);
  assert.ok(chars <= 5000, "每个会话都读的这几份涨到 " + chars + " 字了（上限 5000）——该搬的搬出去");
});

test("指路那份说清了「什么时候才要去翻」", () => {
  const p = R(".claude/rules/施工前先读.md");
  assert.match(p, /施工规则\/README\.md/, "没说去哪儿读");
  assert.match(p, /要不要动 `js\/` 里的文件/, "没给判据——不给判据就会变成每次都翻或者永远不翻");
  assert.match(p, /\*\*不要\*\*（聊天/, "没说不施工的窗口可以不看");
  assert.ok(p.length < 1500, "指路的这一份也长起来了（它每个会话都读）");
});

test("README 把十三份一份不落地点了名，还分了「每次都读」和「按今天动哪儿挑」", () => {
  const rd = R("施工规则/README.md");
  MOVED.forEach(n => assert.ok(rd.indexOf(n + ".md") >= 0, "README 里没点到 " + n));
  assert.match(rd, /每次施工都读/);
  assert.match(rd, /按今天动哪儿去挑/);
  assert.match(rd, /cc-ledger-marker\.md/, "没说清留下那两份为什么不在这儿");
});

test("没有人还指着旧地址（搬家最常见的坏法：改了目录，引用留在原地）", () => {
  const files = [];
  const walk = d => fs.readdirSync(path.join(root, d), { withFileTypes: true }).forEach(e => {
    if (e.name === "node_modules" || e.name === ".git") return;
    const rel = d ? d + "/" + e.name : e.name;
    if (e.isDirectory()) { if (d === "" && ["test", "js", "scripts", "施工规则", ".claude"].indexOf(e.name) < 0) return; walk(rel); }
    else if (/\.(js|mjs|md)$/.test(e.name)) files.push(rel);
  });
  walk("");
  const bad = [];
  // ⚠️三种写法都要认出来，不然「搬完了」是假的（这一版真漏过五处）：
  //   ① 直接写 ".claude/rules/x.md"
  //   ② path.join(root, ".claude", "rules", "x.md") —— 拆成了三段
  //   ③ 正则里 /\.claude\/rules\/x\.md/ —— 每个点和斜杠前面都有反斜杠
  const flat = s => s.replace(/\\/g, "").replace(/"\s*,\s*"/g, "/");
  files.forEach(f => {
    const s = flat(R(f));
    MOVED.forEach(n => { if (s.indexOf(".claude/rules/" + n) >= 0) bad.push(f + " → " + n); });
  });
  assert.deepEqual(bad, [], "这些地方还指着旧路径：\n  " + bad.join("\n  "));
  assert.match(R("AGENTS.md"), /施工规则\/README\.md/, "别的施工窗口（Codex）没被告诉搬去哪儿了");
});

test("测试要读规则原文时，路径只写在一个地方", () => {
  assert.match(R("test/_rules.js"), /path\.join\(__dirname, "\.\.", "施工规则"\)/);
  const users = fs.readdirSync(path.join(root, "test")).filter(f => /\.test\.js$/.test(f));
  const bad = users.filter(f => /readFileSync\([^)]*施工规则/.test(R("test/" + f)));
  assert.deepEqual(bad, [], "这几份测试自己拼了路径，下次搬家又要改一圈：\n  " + bad.join("\n  "));
  // 真的有人在用（不然这一处等于没开）
  const n = users.filter(f => R("test/" + f).indexOf('require("./_rules.js")') >= 0).length;
  assert.ok(n >= 16, "只有 " + n + " 份走这一处，剩下的还是各拼各的");
});
