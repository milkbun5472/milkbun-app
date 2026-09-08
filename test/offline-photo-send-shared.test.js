const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = file => fs.readFileSync(path.join(__dirname, "..", "js", file), "utf8");
const src = read("components.js");
const start = src.indexOf("function useOfflinePhotoSend(");
const end = src.indexOf("function useOfflineCustomStyles(", start);
assert.ok(start >= 0 && end > start);
const code = src.slice(start, end);
function fixture(overrides = {}) {
  const lock = { current: false }, calls = [], notices = [];
  let sent = 0;
  const ctx = {
    useRef: () => lock,
    imgToVault: async image => { calls.push(["vault", image]); return "iv_test"; },
    rememberRealPhoto: async (...args) => calls.push(["album", ...args]),
    window: { __toast: message => notices.push(message) },
    ...overrides
  };
  vm.createContext(ctx); vm.runInContext(code, ctx);
  const props = { photoImg: "data:image/png;base64,test", photoDesc: "  窗外  ", sending: false,
    source: "offline", onSendPhoto: async photo => calls.push(["message", JSON.parse(JSON.stringify(photo))]),
    onSent: () => { sent++; } };
  return { calls, notices, sent: () => sent, render: extra => ctx.useOfflinePhotoSend({ ...props, ...extra }) };
}
test("两条会话沿用真实写入字段，来源显式区分", async () => {
  const app = read("app.js");
  assert.match(app, /window\.__toast = toast/);
  for (const writer of ["offlineSendPhoto", "groupOfflineSendPhoto"]) {
    const a = app.indexOf("const " + writer + " =");
    const b = app.indexOf("\n  });", a);
    assert.ok(a >= 0 && b > a);
    const body = app.slice(a, b);
    assert.match(body, /imageRef: photo\.imageRef/);
    assert.match(body, /desc: photo\.desc \|\| "", content: photo\.content \|\| "\[照片\]"/);
  }
  for (const source of ["offline", "group-offline"]) {
    const f = fixture(); await f.render({ source })();
    assert.deepEqual(f.calls, [
      ["vault", "data:image/png;base64,test"], ["album", "iv_test", "窗外", source],
      ["message", { kind: "photo", imageRef: "iv_test", desc: "窗外", content: "[照片] 窗外" }]
    ]);
    assert.equal(f.sent(), 1);
  }
});
test("入库未完成时连点及重新渲染都不会重复发送", async () => {
  let release, writes = 0;
  const f = fixture({ imgToVault: () => { writes++; return new Promise(r => { release = r; }); } });
  const send = f.render(), first = send();
  await send(); await f.render()();
  assert.equal(writes, 1); assert.equal(f.sent(), 0);
  release("iv_test"); await first;
  assert.equal(f.calls.filter(x => x[0] === "message").length, 1);
  assert.equal(f.sent(), 1);
});
test("发送回调还在等待时也不释放锁或清草稿", async () => {
  let release;
  const f = fixture();
  const first = f.render({ onSendPhoto: () => new Promise(r => { release = r; }) })();
  await new Promise(r => setImmediate(r));
  assert.equal(f.sent(), 0); await f.render()();
  assert.equal(f.calls.filter(x => x[0] === "vault").length, 1);
  release(); await first; assert.equal(f.sent(), 1);
});
test("异步失败保留草稿并释放锁，允许重试", async () => {
  for (const failAt of ["vault", "album", "message"]) {
    let fail = true;
    const f = fixture({
      imgToVault: async () => { if (fail && failAt === "vault") throw Error("disk"); return "iv_test"; },
      rememberRealPhoto: async () => { if (fail && failAt === "album") throw Error("album"); }
    });
    const send = f.render({ onSendPhoto: async () => { if (fail && failAt === "message") throw Error("send"); } });
    await send(); assert.equal(f.sent(), 0); assert.equal(f.notices.length, 1);
    fail = false; await send(); assert.equal(f.sent(), 1);
  }
});
test("空图、正在生成、没有发送入口时不触碰存储", async () => {
  for (const extra of [{ photoImg: "" }, { sending: true }, { onSendPhoto: null }]) {
    const f = fixture(); await f.render(extra)(); assert.deepEqual(f.calls, []); assert.equal(f.sent(), 0);
  }
});
test("不填说明仍可发送，各实例锁不串场", async () => {
  const a = fixture(), b = fixture();
  await Promise.all([a.render({ photoDesc: "  " })(), b.render()()]);
  assert.equal(a.calls[2][1].content, "[照片]");
  assert.equal(a.sent(), 1); assert.equal(b.sent(), 1);
});
test("两个页面只接公共发送链，不另写入库流程", () => {
  for (const name of ["OfflineMode", "GroupOfflineMode"]) {
    const a = src.indexOf("function " + name + "(");
    const b = src.indexOf("\nfunction ", a + 1);
    assert.ok(a >= 0 && b > a);
    const body = src.slice(a, b);
    assert.match(body, /const sendPhoto = useOfflinePhotoSend\(/);
    assert.match(body, new RegExp('source: "' + (name === "OfflineMode" ? "offline" : "group-offline") + '"'));
    assert.doesNotMatch(body, /imgToVault\(photoImg\)|rememberRealPhoto\(/);
    assert.match(body, /onSent: \(\) => \{ setPhotoImg\(""\); setPhotoDesc\(""\); setPhotoOpen\(false\); \}/);
  }
});
test("结局冲突页只保留现行实现，旧草稿不能藏进注释", () => {
  const screens = read("screens.js");
  assert.equal((screens.match(/function MemoryRepairConflictSheet\(/g) || []).length, 1);
  assert.match(screens, /disabled: !!busy \|\| !mem/);
});
