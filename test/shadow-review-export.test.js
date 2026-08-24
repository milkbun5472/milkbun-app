const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "shadow-review.js"), "utf8");

test("原生壳导出会把文件名和完整正文交给系统分享桥", async () => {
  let payload = null;
  const window = {
    webkit: { messageHandlers: { nativeExport: { postMessage: async value => {
      payload = value;
      return { ok: true };
    } } } }
  };
  vm.runInNewContext(source, { window, navigator: {}, document: {}, URL, Blob, File });
  const mode = await window.ShadowReview._saveText("audit.json", "{\"ok\":true}", "application/json");
  assert.equal(mode, "native");
  assert.deepEqual({ ...payload }, {
    filename: "audit.json",
    text: "{\"ok\":true}",
    mime: "application/json"
  });
});

test("原生分享桥拒绝时不能继续假报导出成功", async () => {
  const window = {
    webkit: { messageHandlers: { nativeExport: { postMessage: async () => ({ ok: false }) } } }
  };
  vm.runInNewContext(source, { window, navigator: {}, document: {}, URL, Blob, File });
  await assert.rejects(() => window.ShadowReview._saveText("audit.json", "{}"), /没有打开/);
});

test("人格审计会导出现役 jiwen 五轴但不泄露聊天正文", async () => {
  const stored = {
    ayu: {
      connection: 0.4567, pride: 0.1, valence: -0.2345, arousal: 0.6, immersion: 0.25,
      lastTick: "2026-08-24T12:00:00.000Z", userStatus: "busy",
      lastActivity: { type: "reading", label: "不能进审计的书名", at: "2026-08-24T11:00:00.000Z" },
      lastChatAnalysis: "不能进审计的聊天分析", lastChatMessageId: "secret-message-id"
    }
  };
  const window = {
    localStorage: { getItem: key => key === "x_jiwen" ? JSON.stringify(stored) : null },
    __jiwen: {
      ayu: {
        state: stored.ayu,
        triggers: [{ action: "contact", reason: "private" }, { action: "unknown", text: "private" }]
      }
    }
  };
  vm.runInNewContext(source, { window, navigator: {}, document: {}, URL, Blob, File, console });
  const audit = await window.ShadowReview.build([{ id: "ayu", name: "阿屿" }], "test");
  assert.equal(audit.innerLife.jiwenLive.mode, "live");
  assert.equal(audit.innerLife.jiwenLive.affectsLiveBehavior, true);
  assert.deepEqual(Array.from(audit.innerLife.jiwenLive.characters[0].triggerActions), ["contact"]);
  assert.equal(audit.innerLife.jiwenLive.characters[0].axes.connection, 0.457);
  assert.deepEqual({ ...audit.innerLife.jiwenLive.characters[0].lastActivity }, {
    type: "reading", at: "2026-08-24T11:00:00.000Z"
  });
  assert.equal(audit.innerLife.legacyNineDrivesStatus.mode, "retired_shadow");
  const text = JSON.stringify(audit);
  assert.equal(text.includes("不能进审计"), false);
  assert.equal(text.includes("secret-message-id"), false);
});
