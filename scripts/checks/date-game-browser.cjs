"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), http = require("node:http");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const dir = path.resolve(__dirname, "../.."), evidence = process.env.DATE_EVIDENCE || "/tmp/date-game-evidence";
fs.mkdirSync(evidence, { recursive: true });
const server = http.createServer((req, res) => {
  const file = path.resolve(dir, "." + decodeURIComponent(new URL(req.url, "http://local").pathname === "/" ? "/index.html" : new URL(req.url, "http://local").pathname));
  if (!file.startsWith(dir + path.sep)) { res.writeHead(403); return res.end(); }
  try { const ext = path.extname(file); res.setHeader("Content-Type", ({ ".js": "text/javascript", ".html": "text/html", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".webp": "image/webp" })[ext] || "application/octet-stream"); res.end(fs.readFileSync(file)); }
  catch { res.writeHead(404); res.end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    const url = "http://127.0.0.1:" + server.address().port;
    await page.goto(url + "/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.Games && window.DateGame && window.txtVaultState?.().done);
    await page.evaluate(() => {
      window.dateCalls = []; window.dateSaveCalls = []; window.failReply = true; window.failSave = false;
      window.callAI = async (api, sys, msgs, opts) => {
        dateCalls.push({ sys, msgs, maxTokens: opts.maxTokens }); await new Promise(r => setTimeout(r, 70));
        const v = JSON.parse(sys.split("【你实际能看见的这一局】\n")[1].split("\n")[0]);
        if (failReply) { failReply = false; return JSON.stringify({ place: "missing", accept: true, pose: 2, row: 1, hint: "配合提示", say: "测试回复" }); }
        if (v.phase === "guess") return JSON.stringify({ guess: "photo", say: "猜好了，等你翻牌。" });
        return JSON.stringify({ place: v.proposal || v.places[0].id, accept: true, pose: 2, row: 1, hint: "合照准备歪头；抓钩在第二排，左右由你来。", say: "这一站我也想去。" });
      };
      saveJSON("x_dateTestMainline", { memory: "不改这一条", affinity: 17 });
      const orig = window.saveJSON;
      window.saveJSON = (key, val) => { dateSaveCalls.push(key); if (failSave && key === "x_gamesSave") return false; return orig(key, val); };
      const el = document.createElement("div"); el.id = "date-test-root"; el.style.cssText = "position:fixed;inset:0;z-index:999999;height:100dvh;display:flex;flex-direction:column"; document.body.append(el);
      window.dateRoot = ReactDOM.createRoot(el);
      window.mountDate = (dark = false) => {
        const theme = dark ? { ...DEFAULT_THEME, bg: "#25222a", bg2: "#302b34", ink: "#f0e7e8", sub: "#cbc0c4", fog: "#b3a5ae", line: "#645b68", tint: "#b892a0" } : DEFAULT_THEME;
        dateRoot.render(React.createElement(ThemeContext.Provider, { value: theme }, React.createElement(Games, {
          characters: [{ id: "date-person", name: "同行测试", persona: "PERSONA_BEGIN" + "角色人设全文".repeat(1200) + "PERSONA_END", avatar: "🌿" }], profile: { name: "测试用户", avatar: "🐥" }, active: { fixture: true },
          worldbookFor: () => "WORLD_BOOK_SENTINEL", recentChatFor: () => "RECENT_SENTINEL", toast: () => {}, isEngineer: () => false,
          keepGameMemory: () => { throw Error("不该调用回忆"); }, sendGameReport: () => { throw Error("不该写聊天"); }, sendGameReportGroup: () => { throw Error("不该写群"); }, onBack: () => {}
        })));
      }; mountDate();
    });
    const root = page.locator("#date-test-root"), part = k => root.locator('[data-part="' + k + '"]');
    await root.locator("[data-wk=gamelid]").filter({ hasText: "各怀心思的约会" }).click();
    await part("partner").click(); await part("start").click();
    await page.waitForFunction(() => loadJSON("x_gamesSave", {}).date);
    const first = await page.evaluate(() => loadJSON("x_gamesSave", {}).date.state);
    // Invalid response: budget, task and route unchanged; retry stays on the exact pending request.
    await root.locator('[data-part=place][data-id=photo]').click(); await part("send").click(); await part("retry-ai").waitFor();
    let snap = await page.evaluate(() => loadJSON("x_gamesSave", {}).date.state);
    assert.equal(snap.money, first.money); assert.equal(snap.minutes, first.minutes); assert.deepEqual(snap.missions, first.missions); assert.equal(snap.pending.proposedId, "photo");
    await part("retry-ai").click(); await part("accept").waitFor();
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
      const layout = await root.evaluate(el => ({ overflow: el.scrollWidth > innerWidth, head: el.querySelector("[data-wk=head]")?.getBoundingClientRect().toJSON(), composer: el.querySelector("[data-wk=datecomposer]")?.getBoundingClientRect().toJSON() }));
      assert.equal(layout.overflow, false); assert.ok(layout.head && layout.head.top >= 0); assert.ok(layout.composer.bottom <= (width === 320 ? 568 : 844));
      await page.screenshot({ path: path.join(evidence, "route-" + width + ".png") });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await part("accept").click();
    await part("aim").fill("1"); await part("shoot").click(); await part("retry-activity").click();
    await part("aim").fill("2"); await part("shoot").click();
    snap = await page.evaluate(() => loadJSON("x_gamesSave", {}).date.state);
    assert.equal(snap.minutes, 145); assert.equal(snap.money, 155); assert.equal(snap.events.at(-1).match, true);
    // Back to shelf and resume the exact secret cards and activity evidence.
    await root.locator('[data-wk=head] button').first().click(); await root.locator('[data-wk=gameopenbtn][data-part=go]').click();
    const resumed = await page.evaluate(() => loadJSON("x_gamesSave", {}).date.state); assert.deepEqual(resumed, snap);
    await part("next").click(); await part("accept").waitFor();
    await root.locator('[data-part=place][data-id=arcade]').click(); await part("chat").fill("我们去抓玩偶吧"); await part("send").click(); await part("accept").waitFor();
    await part("accept").click();
    const target = await page.evaluate(() => loadJSON("x_gamesSave", {}).date.state.toys[1]);
    await part("aim").fill(String(target)); await page.screenshot({ path: path.join(evidence, "claw.png") }); await part("claw").click();
    assert.equal(await page.evaluate(() => loadJSON("x_gamesSave", {}).date.state.events.at(-1).win), true);
    // Real writer failure: show it and preserve live state for a save-only retry (no model call).
    await page.evaluate(() => { failSave = true; }); await part("close").click(); await part("retry-save").waitFor();
    const calls = await page.evaluate(() => dateCalls.length); await page.evaluate(() => { failSave = false; }); await part("retry-save").click();
    assert.equal(await page.evaluate(() => dateCalls.length), calls);
    await part("guess-ai").click(); await root.locator('[data-part^="guess-"]').filter({ hasText: "没猜出来" }).click(); await part("reveal").click();
    await root.locator('[data-part=result]').waitFor(); snap = await page.evaluate(() => loadJSON("x_gamesSave", {}).date.state);
    assert.equal(snap.phase, "finished"); assert.ok(!await root.locator('[data-wk=gamekeepmem]').count()); assert.ok(!await root.locator('[data-wk=gamereport]').count());
    await page.screenshot({ path: path.join(evidence, "result.png") });
    const requests = await page.evaluate(() => dateCalls);
    for (const call of requests) {
      assert.match(call.sys, /PERSONA_BEGIN[\s\S]*PERSONA_END/); assert.match(call.sys, /WORLD_BOOK_SENTINEL/);
      assert.ok(!call.sys.includes('"missions"')); assert.ok(!call.sys.includes('"userGuess"'));
      assert.deepEqual(call.msgs, [{ role: "user", content: "轮到你了。" }]); assert.equal(call.maxTokens, 65000);
    }
    assert.deepEqual(await page.evaluate(() => loadJSON("x_dateTestMainline")), { memory: "不改这一条", affinity: 17 });
    assert.ok((await page.evaluate(() => dateSaveCalls)).filter(k => k === "x_gamesSave").length >= 12);
    // Full page reload verifies IndexedDB, rather than the component's live state.
    await page.waitForTimeout(300); await page.reload({ waitUntil: "domcontentloaded" }); await page.waitForFunction(() => window.txtVaultState?.().done);
    assert.deepEqual(await page.evaluate(() => loadJSON("x_gamesSave", {}).date.state), snap);
    assert.deepEqual(errors, []);
    console.log("PASS native shelf/setup, 320/390/430px, invalid AI/retry, actual range controls, photo+claw, back/resume, save failure, guess+reveal, full IDB reload, no mainline writes or page errors");
  } finally { if (browser) await browser.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
