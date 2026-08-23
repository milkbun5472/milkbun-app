const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 她 2026-08-22：「同一个模型站子都在线下，没理由之前可以了突然又不行」。
// 说得对——变的是代码：Codex 的 v55.38 加了最低字数补写循环，而那次 callAI
// 外面【没有 try/catch】。第一段正文明明已经写好，补写请求一断网异常就穿出去，
// 整轮作废，界面上只剩一句 Load failed。之前没有这个循环，所以之前一直没事。

const REPAIR = (() => {
  const i = engine.indexOf("async function ensureOfflineMinimumScene");
  return engine.slice(i, engine.indexOf("\nasync function generateOffline", i));
})();

test("补写失败不许赔上已经写好的正文", () => {
  assert.match(REPAIR, /let raw;\n    try \{\n      raw = await callAI\(/, "补写调用必须包在 try 里");
  assert.match(REPAIR, /\} catch \(e\) \{[\s\S]{0,200}repairError = String/);
  assert.match(REPAIR, /问不成就停手，把已经写好的正文留住/);
  assert.match(REPAIR, /break;/, "问不成就别再撞第二次");
});

// v55.47 她试了还是丢：那是 Codex 那句「短稿不保存」的 throw 在起作用——
// 模型写了但没写够就整篇丢掉。她明确要求：宁可短也不要白写一场。
// 原意（不许把短稿伪装成达标）仍然成立，只是换个兑现方式：不是丢掉，是如实说它没写够。
test("写出来的正文一律保留，绝不因为没写够就丢", () => {
  assert.ok(!/本轮短稿未保存/.test(engine), "丢稿的 throw 不许再存在");
  assert.ok(!/throw new Error\("模型两次补写/.test(engine));
  assert.match(REPAIR, /shortCount: finalCount, shortTarget: target/);
  assert.match(REPAIR, /shortBecause: \(repairError \|\| "模型两次补写都没写够"\)/, "两种原因都要能说清");
  assert.match(REPAIR, /她 2026-08-22 明确要求：宁可短也不要白写一场/);
});

test("报数要具体：写了多少、想要多少、为什么没到", () => {
  assert.match(engine, /minimumLengthShortCount: minimumRepair\.shortCount \|\| 0/);
  assert.match(engine, /minimumLengthShortTarget: minimumRepair\.shortTarget \|\| 0/);
  assert.match(app, /这篇只写到 " \+ _got \+ " 字/);
  assert.match(app, /没到你设的 " \+ _want \+ " 字/);
  assert.match(app, /想更长就对这条点重写，或把最低字数调低一点/, "给两条能动手的路");
});

test("留了稿就要如实说，别让她以为设置没生效", () => {
  assert.match(engine, /minimumLengthShortBecause: minimumRepair\.shortBecause \|\| ""/);
  assert.match(app, /if \(res && res\.minimumLengthShortBecause\) \{/);
  assert.match(app, /正文已经保留/, "得说清没丢");
});

test("正常路径一个字没变", () => {
  // 够长时直接返回，不进循环
  assert.match(REPAIR, /if \(!target \|\| offlineVisibleCharCount\(current\) >= target\) \{\n    return \{ scene: current, attempts, applied: false \};/);
  // 补写成功仍然照旧覆盖
  assert.match(REPAIR, /else \{ notes\.push\([\s\S]{0,120}current = candidate; \}/, "补写变长了才覆盖");
  assert.match(REPAIR, /while \(attempts < 2 && offlineVisibleCharCount\(current\) < target\)/);
});

// v55.48：她发现「保留下来的比丢掉的还短」——丢掉的有 1400/1000 字，留下的只有 500。
// 病根是我 v55.45 按首轮的 4200 去压补写：补写要把【整篇原文原样吐一遍再加长】，
// 额度不够就被截断 → JSON 解析失败 → 这一次白花，而且完全静默。
test("补写额度按它真正要吐的量算，不能照抄首轮的上限", () => {
  assert.match(REPAIR, /补写要把【整篇原文原样吐一遍再加长】，比首轮更费额度/);
  assert.match(REPAIR, /const need = Math\.ceil\(\(target \+ currentCount\) \* 1\.6 \+ 1500\);/, "要把现有正文长度算进去");
  assert.match(REPAIR, /routeCanStream\(p\) \? Math\.min\(20000, want\) : Math\.min\(9000, want\)/);
  // 现有正文越长，补写需要的额度越大——这是关键性质
  const need = (target, cur) => Math.ceil((target + cur) * 1.6 + 1500);
  assert.ok(need(1500, 1400) > need(1500, 500), "正文越长越费额度");
  assert.ok(need(1500, 500) > 4200, "旧的 4200 连最轻的情况都不够宽裕");
});

test("每一次补写发生了什么都要说出来，别再静默", () => {
  assert.match(REPAIR, /const notes = \[\];/);
  assert.match(REPAIR, /没解析出正文（多半是额度不够被截断）/, "解析失败要能和「不肯写长」区分开");
  assert.match(REPAIR, /次补写只回了 " \+ gained \+ " 字，没比原来长/);
  assert.match(REPAIR, /次补写 " \+ currentCount \+ " → " \+ gained \+ " 字/, "成功也要记，才看得出补到哪一步");
  // 失败时把实况一起报给她
  assert.match(REPAIR, /\(notes\.length \? "；" \+ notes\.join\("；"\) : ""\)/);
});
