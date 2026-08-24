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
